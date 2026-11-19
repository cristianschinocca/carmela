import { createHash } from "node:crypto";
import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";
import { AccountError, parseAccountChange, type AccountChange } from "./account.js";

type Db = ReturnType<typeof tenantDatabase>;
type Change = Omit<AccountChange, "id">;
export type AccountBatch = { id: string; accounts: Change[] };
export function parseAccountBatch(value: unknown): AccountBatch | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validId(input.id) || !Array.isArray(input.accounts) || input.accounts.length !== 2) return null;
  const accounts: Change[] = [];
  const lineIds = new Set<string>();
  for (const item of input.accounts) {
    if (!item || typeof item !== "object") return null;
    const account = parseAccountChange({ ...(item as Record<string, unknown>), id: input.id });
    if (!account || accounts.some((entry) => entry.tableId === account.tableId)) return null;
    for (const line of account.items) { if (lineIds.has(line.id)) return null; lineIds.add(line.id); }
    const { id: _id, ...change } = account;
    accounts.push(change);
  }
  return { id: input.id, accounts };
}
/** Un traslado modifica las dos cuentas en una sola transacción y con una clave de reintento. */
export async function saveAccountBatch(db: Db, input: AccountBatch) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const prior = await tx.accountBatchOperation.findUnique({ where: { id: input.id } });
    if (prior) {
      if (prior.payloadHash !== hash) throw new AccountError("idempotency", "La operación ya corresponde a otros datos.");
      return { versions: prior.versions as Record<string, number>, replayed: true };
    }
    const ids = input.accounts.map((account) => account.tableId).sort();
    const tables = await tx.$queryRaw<Array<{ id: string; version: number }>>`SELECT id, version FROM dining_tables WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    if (tables.length !== ids.length) throw new AccountError("missing", "Una mesa ya no existe.");
    for (const account of input.accounts) if (tables.find((table) => table.id === account.tableId)?.version !== account.expectedVersion) throw new AccountError("version", "Una mesa cambió. Actualizá antes de trasladar la cuenta.");
    const operatorIds = [...new Set(input.accounts.flatMap((account) => account.operatorId ? [account.operatorId] : []))].sort();
    if (operatorIds.length) {
      await tx.$queryRaw`SELECT id FROM employees WHERE id IN (${Prisma.join(operatorIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
      if (await tx.employee.count({ where: { id: { in: operatorIds }, active: true, deletedAt: null } }) !== operatorIds.length) throw new AccountError("operator", "Un responsable ya no está disponible en esta cafetería.");
    }
    const previousItems = await tx.diningTableItem.findMany({ where: { tableId: { in: ids } } });
    const totals = (lines: Array<{ productId: string; unitPrice: number; unitDiscount: number; quantity: number }>) => {
      const result = new Map<string, number>();
      for (const line of lines) {
        const key = `${line.productId}:${line.unitPrice}:${line.unitDiscount}`;
        result.set(key, (result.get(key) ?? 0) + line.quantity);
      }
      return result;
    };
    const before = totals(previousItems), after = totals(input.accounts.flatMap((account) => account.items));
    if (before.size !== after.size || [...before].some(([key, count]) => after.get(key) !== count)) throw new AccountError("product", "El traslado debe conservar los productos y sus precios.");
    const currentTables = await tx.diningTable.findMany({ where: { id: { in: ids } }, select: { discount: true } });
    if (currentTables.reduce((sum, table) => sum + table.discount, 0) !== input.accounts.reduce((sum, account) => sum + account.discount, 0)) throw new AccountError("product", "El traslado debe conservar los descuentos.");
    const products = [...new Set(input.accounts.flatMap((account) => account.items.map((item) => item.productId)))];
    if (products.length && await tx.catalogProduct.count({ where: { id: { in: products } } }) !== products.length) throw new AccountError("product", "Un producto ya no existe en el catálogo.");
    await tx.diningTableItem.deleteMany({ where: { tableId: { in: ids } } });
    const items = input.accounts.flatMap((account) => account.items.map((item) => ({ ...item, tableId: account.tableId })));
    if (items.length) await tx.diningTableItem.createMany({ data: items });
    const versions: Record<string, number> = {};
    for (const account of input.accounts) {
      const table = await tx.diningTable.update({ where: { id: account.tableId }, data: { guests: account.guests, billRequested: account.billRequested, discount: account.discount, ...(account.operatorId !== undefined ? { operatorId: account.operatorId } : {}), version: { increment: 1 } } });
      versions[table.id] = table.version;
    }
    await tx.accountBatchOperation.create({ data: { id: input.id, payloadHash: hash, versions } });
    return { versions, replayed: false };
  });
}
