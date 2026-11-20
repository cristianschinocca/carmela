import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { AccountError, saveTableAccountInTransaction, type AccountChange } from "./account.js";
import { settleTableInTransaction, type Settlement } from "./settlement.js";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
type RecipeVersion = { productId: string; recipeId: string | null; version: number | null };

export function parseRecipeVersions(value: unknown): RecipeVersion[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const seen = new Set<string>();
  const result: RecipeVersion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !validId(entry.productId) || seen.has(entry.productId) || !((entry.recipeId === null && entry.version === null) || (validId(entry.recipeId) && Number.isSafeInteger(entry.version) && entry.version >= 0 && entry.version <= 2147483647))) return null;
    seen.add(entry.productId); result.push({ productId: entry.productId, recipeId: entry.recipeId, version: entry.version });
  }
  return result;
}

/** La cuenta, la venta y sus efectos en caja y stock se confirman o revierten juntos. */
export async function settleOfflineAccount(db: Db, account: AccountChange, settlement: Settlement, versions: RecipeVersion[], occurredAt: string, verified: { operatorId: string; pinHash: string }) {
  if (!account.items.length || !account.operatorId || account.operatorId !== verified.operatorId || account.tableId !== settlement.tableId || settlement.expectedVersion !== account.expectedVersion + 1 || !settlement.expectedShiftId) {
    throw new AccountError("version", "Los datos de la cuenta y del cobro no coinciden.");
  }
  const time = Date.parse(occurredAt);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== occurredAt || time > Date.now() + 300_000) throw new AccountError("version", "La fecha del cobro no es válida. Revisá el reloj del dispositivo.");
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${settlement.id}, 0))`;
        const shifts = await tx.$queryRaw<Array<{ id: string; opened_at: Date }>>`SELECT id, opened_at FROM cash_shifts WHERE closed_at IS NULL FOR UPDATE`;
        const rows = await tx.$queryRaw<Array<{ operator_id: string | null }>>`SELECT operator_id FROM dining_tables WHERE id = ${account.tableId}::uuid FOR UPDATE`;
        if (!rows.length) throw new AccountError("missing", "La mesa no existe.");
        const sale = await tx.sale.findUnique({ where: { id: settlement.id }, select: { operatorId: true } });
        if (!sale && shifts[0]?.id === settlement.expectedShiftId && time < shifts[0].opened_at.getTime()) throw new AccountError("version", "El cobro es anterior a la apertura de caja. Revisá el reloj del dispositivo.");
        if (sale ? sale.operatorId !== verified.operatorId : rows[0].operator_id !== null && rows[0].operator_id !== verified.operatorId) {
          throw new AccountError("operator", "El responsable de la cuenta cambió.");
        }
        const productIds = [...new Set(account.items.map((item) => item.productId))].sort();
        const expected = new Map(versions.map((entry) => [entry.productId, entry]));
        if (expected.size !== versions.length || expected.size !== productIds.length || productIds.some((id) => !expected.has(id))) throw new AccountError("version", "Faltan versiones de recetas para verificar el cobro.");
        if (!sale) {
          await tx.$queryRaw`SELECT id FROM inventory_recipes WHERE product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
          const recipes = await tx.inventoryRecipe.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true, version: true } });
          const current = new Map(recipes.map((entry) => [entry.productId, entry]));
          if (productIds.some((id) => (current.get(id)?.id ?? null) !== expected.get(id)!.recipeId || (current.get(id)?.version ?? null) !== expected.get(id)!.version)) throw new AccountError("version", "Una receta cambió desde la última conexión. Revisá la venta pendiente.");
        }
        await saveTableAccountInTransaction(tx, account, verified.pinHash);
        return settleTableInTransaction(tx, settlement, verified, occurredAt);
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}
