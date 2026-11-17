import { createHash, randomUUID } from "node:crypto";
import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";
import { compatibleUnits } from "../inventory/recipes.js";

type Db = ReturnType<typeof tenantDatabase>;
type Unit = "unidad" | "kg" | "g" | "l" | "ml";
export type Settlement = { id: string; tableId: string; expectedVersion: number; payment: "Efectivo" | "Tarjeta" | "Transferencia" };
export class SettlementError extends Error { constructor(public readonly reason: "missing" | "version" | "empty" | "stock" | "precision" | "invalid" | "idempotency", message: string) { super(message); } }
export function parseSettlement(value: unknown): Settlement | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validId(input.id) || !validId(input.tableId) || typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !["Efectivo", "Tarjeta", "Transferencia"].includes(String(input.payment))) return null;
  return { id: input.id, tableId: input.tableId, expectedVersion: input.expectedVersion, payment: input.payment as Settlement["payment"] };
}
const factor: Record<Unit, number> = { unidad: 1, kg: 1000, g: 1, l: 1000, ml: 1 };

/** Confirma una cuenta guardada en el servidor; la identificación de cafetería se resuelve antes de llamar a esta función. */
export async function settleTable(db: Db, input: Settlement) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const existing = await tx.sale.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.payloadHash !== hash) throw new SettlementError("idempotency", "El identificador ya corresponde a otro cobro.");
      return { saleId: existing.id, total: existing.total.toString(), replayed: true };
    }
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM dining_tables WHERE id = ${input.tableId}::uuid FOR UPDATE`;
    if (!locked.length) throw new SettlementError("missing", "La mesa no existe.");
    const table = await tx.diningTable.findUniqueOrThrow({ where: { id: input.tableId }, include: { sector: true, items: { include: { product: { include: { category: true } } } } } });
    if (table.version !== input.expectedVersion) throw new SettlementError("version", "La mesa cambió. Actualizá antes de cobrar.");
    if (!table.items.length) throw new SettlementError("empty", "La mesa no tiene productos.");
    const productIds = [...new Set(table.items.map((item) => item.productId))].sort();
    await tx.$queryRaw`SELECT id FROM inventory_recipes WHERE product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
    const recipes = await tx.inventoryRecipe.findMany({ where: { productId: { in: productIds } }, include: { ingredients: { include: { ingredient: true } } } });
    const usage = new Map<string, { quantity: InstanceType<typeof Prisma.Decimal>; unit: Unit; name: string }>();
    for (const item of table.items) {
      const recipe = recipes.find((entry) => entry.productId === item.productId);
      for (const line of recipe?.ingredients ?? []) {
        const from = line.unit as Unit, to = line.ingredient.unit as Unit;
        if (!factor[from] || !factor[to] || !compatibleUnits(from, to)) throw new SettlementError("invalid", "La receta tiene unidades incompatibles.");
        const amount = line.quantity.mul(factor[from]).div(factor[to]).mul(item.quantity);
        const previous = usage.get(line.ingredientId);
        usage.set(line.ingredientId, { quantity: (previous?.quantity ?? new Prisma.Decimal(0)).plus(amount), unit: to, name: line.ingredient.name });
      }
    }
    const ingredientIds = [...usage.keys()].sort();
    if (ingredientIds.length) await tx.$queryRaw`SELECT id FROM inventory_ingredients WHERE id IN (${Prisma.join(ingredientIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    for (const ingredientId of ingredientIds) {
      const amount = usage.get(ingredientId)!;
      if (amount.quantity.decimalPlaces() > 6) throw new SettlementError("precision", `La cantidad de ${amount.name} supera la precisión admitida.`);
      const updated = await tx.inventoryIngredient.updateMany({ where: { id: ingredientId, unit: amount.unit, quantity: { gte: amount.quantity } }, data: { quantity: { decrement: amount.quantity }, version: { increment: 1 } } });
      if (!updated.count) throw new SettlementError("stock", `Stock insuficiente o unidad modificada: ${amount.name}.`);
    }
    await tx.$queryRaw`SELECT id FROM catalog_products WHERE id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    for (const productId of productIds) {
      const count = table.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
      const stock = await tx.productStock.findUnique({ where: { productId } });
      if (!stock?.enabled) continue;
      if (stock.quantity < count) throw new SettlementError("stock", "No hay suficiente stock del producto.");
      const balance = stock.quantity - count;
      await tx.productStock.update({ where: { productId }, data: { quantity: balance, version: { increment: 1 } } });
      await tx.productStockMovement.create({ data: { id: randomUUID(), payloadHash: hash, productId, kind: "salida", amount: count, balance, note: `Venta ${input.id}` } });
    }
    const subtotal = table.items.reduce((sum, item) => sum + BigInt(item.quantity) * BigInt(item.unitPrice - item.unitDiscount), 0n);
    const discount = BigInt(table.discount);
    if (discount > subtotal) throw new SettlementError("invalid", "El descuento supera el subtotal.");
    const items = table.items.map((item) => ({ productId: item.productId, name: item.product.name, category: item.product.category.name, quantity: item.quantity, unitPrice: item.unitPrice, unitDiscount: item.unitDiscount, note: item.note }));
    const sale = await tx.sale.create({ data: { id: input.id, tableId: table.id, tableName: `${table.sector.name} · Mesa ${table.number}`, payloadHash: hash, guests: table.guests, subtotal, discount, total: subtotal - discount, payment: input.payment, items } });
    if (ingredientIds.length) await tx.ingredientSaleMovement.createMany({ data: ingredientIds.map((ingredientId) => ({ saleId: sale.id, ingredientId, quantity: usage.get(ingredientId)!.quantity, unit: usage.get(ingredientId)!.unit })) });
    await tx.diningTableItem.deleteMany({ where: { tableId: table.id } });
    await tx.diningTable.update({ where: { id: table.id }, data: { guests: 0, billRequested: false, discount: 0, version: { increment: 1 } } });
    return { saleId: sale.id, total: sale.total.toString(), replayed: false };
  }, { isolationLevel: "Serializable" });
}
