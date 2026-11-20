import { createHash, randomUUID } from "node:crypto";
import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";
import { compatibleUnits } from "../inventory/recipes.js";

type Db = ReturnType<typeof tenantDatabase>;
type Unit = "unidad" | "kg" | "g" | "l" | "ml";
export type Settlement = { id: string; tableId: string; expectedVersion: number; payment: "Efectivo" | "Tarjeta" | "Transferencia"; expectedShiftId?: string };
export class SettlementError extends Error { constructor(public readonly reason: "missing" | "version" | "empty" | "stock" | "precision" | "invalid" | "idempotency" | "cash" | "cancelled" | "operator", message: string) { super(message); } }
export function parseSettlement(value: unknown): Settlement | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validId(input.id) || !validId(input.tableId) || typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !["Efectivo", "Tarjeta", "Transferencia"].includes(String(input.payment))) return null;
  if (input.expectedShiftId !== undefined && !validId(input.expectedShiftId)) return null;
  return { id: input.id, tableId: input.tableId, expectedVersion: input.expectedVersion, payment: input.payment as Settlement["payment"], ...(input.expectedShiftId !== undefined ? { expectedShiftId: input.expectedShiftId as string } : {}) };
}
const factor: Record<Unit, number> = { unidad: 1, kg: 1000, g: 1, l: 1000, ml: 1 };

/** Confirma una cuenta guardada en el servidor; la identificación de cafetería se resuelve antes de llamar a esta función. */
export async function settleTable(db: Db, input: Settlement, verified?: { operatorId: string; pinHash: string }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction((tx) => settleTableInTransaction(tx, input, verified), { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}

export async function settleTableInTransaction(tx: Prisma.TransactionClient, input: Settlement, verified?: { operatorId: string; pinHash: string }, occurredAt?: string) {
  const hash = createHash("sha256").update(JSON.stringify(occurredAt ? { ...input, occurredAt } : input)).digest("hex");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
  const attempts = await tx.$queryRaw<Array<{ table_id: string; status: string }>>`INSERT INTO settlement_attempts (id, table_id, status) VALUES (${input.id}::uuid, ${input.tableId}::uuid, 'pending') ON CONFLICT (id) DO UPDATE SET id = settlement_attempts.id RETURNING table_id, status`;
  if (attempts[0].table_id !== input.tableId) throw new SettlementError("idempotency", "El identificador corresponde a otra mesa.");
  if (attempts[0].status === "cancelled") throw new SettlementError("cancelled", "El intento anterior se canceló. Volvé a iniciar el cobro.");
  const existing = await tx.sale.findUnique({ where: { id: input.id } });
  if (existing) {
    if (existing.payloadHash !== hash) throw new SettlementError("idempotency", "El identificador ya corresponde a otro cobro.");
    if (attempts[0].status !== "completed") await tx.settlementAttempt.update({ where: { id: input.id }, data: { status: "completed" } });
    return { saleId: existing.id, total: existing.total.toString(), replayed: true };
  }
  if (attempts[0].status === "completed") throw new SettlementError("idempotency", "El cobro registrado no está disponible.");
  const shifts = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM cash_shifts WHERE closed_at IS NULL FOR UPDATE`;
  if (!shifts.length) throw new SettlementError("cash", "Abrí la caja antes de cobrar.");
  const cashShiftId = shifts[0].id;
  if (input.expectedShiftId && input.expectedShiftId !== cashShiftId) throw new SettlementError("cash", "El turno de caja cambió. Revisá el cobro antes de continuar.");
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM dining_tables WHERE id = ${input.tableId}::uuid FOR UPDATE`;
  if (!locked.length) throw new SettlementError("missing", "La mesa no existe.");
  const table = await tx.diningTable.findUniqueOrThrow({ where: { id: input.tableId }, include: { sector: true, operator: { select: { name: true } }, items: { include: { product: { include: { category: true } } } } } });
  if (verified) {
    if (table.operatorId !== verified.operatorId) throw new SettlementError("operator", "El responsable de la cuenta cambió.");
    await tx.$queryRaw`SELECT id FROM employees WHERE id = ${verified.operatorId}::uuid FOR SHARE`;
    const employee = await tx.employee.findUnique({ where: { id: verified.operatorId }, select: { active: true, deletedAt: true, pinHash: true } });
    if (!employee || !employee.active || employee.deletedAt || employee.pinHash !== verified.pinHash) throw new SettlementError("operator", "El responsable o su código cambió. Volvé a verificar.");
  }
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
  const sale = await tx.sale.create({ data: { id: input.id, tableId: table.id, tableName: `${table.sector.name} · Mesa ${table.number}`, payloadHash: hash, guests: table.guests, subtotal, discount, total: subtotal - discount, payment: input.payment, cashShiftId, operatorId: table.operatorId, operatorName: table.operator?.name ?? null, items, ...(occurredAt ? { createdAt: new Date(occurredAt) } : {}) } });
  if (ingredientIds.length) await tx.ingredientSaleMovement.createMany({ data: ingredientIds.map((ingredientId) => ({ saleId: sale.id, ingredientId, quantity: usage.get(ingredientId)!.quantity, unit: usage.get(ingredientId)!.unit })) });
  await tx.settlementAttempt.update({ where: { id: input.id }, data: { status: "completed" } });
  await tx.cashShift.update({ where: { id: cashShiftId }, data: { version: { increment: 1 } } });
  await tx.diningTableItem.deleteMany({ where: { tableId: table.id } });
  await tx.diningTable.update({ where: { id: table.id }, data: { guests: 0, billRequested: false, discount: 0, operatorId: null, version: { increment: 1 } } });
  return { saleId: sale.id, total: sale.total.toString(), replayed: false };
}

/** Resuelve un resultado incierto y bloquea la llegada tardía del mismo cobro. */
export async function reconcileSettlement(db: Db, id: string, tableId: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    await tx.$executeRaw`INSERT INTO settlement_attempts (id, table_id, status) VALUES (${id}::uuid, ${tableId}::uuid, 'pending') ON CONFLICT (id) DO NOTHING`;
    const rows = await tx.$queryRaw<Array<{ table_id: string; status: string }>>`SELECT table_id, status FROM settlement_attempts WHERE id = ${id}::uuid FOR UPDATE`;
    if (rows[0].table_id !== tableId) throw new SettlementError("idempotency", "El identificador corresponde a otra mesa.");
    const sale = await tx.sale.findUnique({ where: { id } });
    if (sale) {
      if (sale.tableId !== tableId) throw new SettlementError("idempotency", "El identificador corresponde a otra mesa.");
      if (rows[0].status !== "completed") await tx.settlementAttempt.update({ where: { id }, data: { status: "completed" } });
      return { status: "completed" as const, total: sale.total.toString() };
    }
    if (rows[0].status === "completed") throw new SettlementError("idempotency", "El cobro registrado no está disponible.");
    if (rows[0].status !== "cancelled") await tx.settlementAttempt.update({ where: { id }, data: { status: "cancelled" } });
    return { status: "cancelled" as const };
  });
}
