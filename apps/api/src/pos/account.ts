import { createHash } from "node:crypto";
import type { Prisma, tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
type Item = { id: string; productId: string; quantity: number; unitPrice: number; unitDiscount: number; note: string };
export type AccountChange = { id: string; tableId: string; expectedVersion: number; guests: number; billRequested: boolean; discount: number; operatorId?: string | null; items: Item[] };
export class AccountError extends Error { constructor(public readonly reason: "missing" | "version" | "idempotency" | "product" | "operator", message: string) { super(message); } }
const integer = (value: unknown, max: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;

export function parseAccountChange(value: unknown): AccountChange | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validId(input.id) || !validId(input.tableId) || !integer(input.expectedVersion, 2147483646) || !integer(input.guests, 1000) || typeof input.billRequested !== "boolean" || !integer(input.discount, 2147483647) || !Array.isArray(input.items) || input.items.length > 500) return null;
  if (input.operatorId !== undefined && input.operatorId !== null && !validId(input.operatorId)) return null;
  const items: Item[] = [];
  let subtotal = 0n;
  for (const entry of input.items) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    if (!validId(item.id) || !validId(item.productId) || !integer(item.quantity, 10000) || item.quantity === 0 || !integer(item.unitPrice, 2147483647) || !integer(item.unitDiscount, 2147483647) || item.unitDiscount > item.unitPrice || typeof item.note !== "string" || item.note.length > 500 || items.some((line) => line.id === item.id)) return null;
    items.push({ id: item.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, unitDiscount: item.unitDiscount, note: item.note });
    subtotal += BigInt(item.quantity) * BigInt(item.unitPrice - item.unitDiscount);
  }
  if (BigInt(input.discount) > subtotal || (!items.length && input.billRequested)) return null;
  return { id: input.id, tableId: input.tableId, expectedVersion: input.expectedVersion, guests: input.guests, billRequested: input.billRequested, discount: input.discount, ...(input.operatorId !== undefined ? { operatorId: input.operatorId as string | null } : {}), items };
}

/** Guarda una cuenta entera bajo la versión de la mesa y una clave de reintento. */
export async function saveTableAccount(db: Db, input: AccountChange, verifiedPinHash?: string) {
  return db.$transaction((tx) => saveTableAccountInTransaction(tx, input, verifiedPinHash));
}

export async function saveTableAccountInTransaction(tx: Prisma.TransactionClient, input: AccountChange, verifiedPinHash?: string) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
  const previous = await tx.tableAccountOperation.findUnique({ where: { id: input.id } });
  if (previous) {
    if (previous.payloadHash !== hash) throw new AccountError("idempotency", "La operación ya corresponde a otros datos.");
    return { version: previous.resultVersion, replayed: true };
  }
  const tables = await tx.$queryRaw<Array<{ version: number }>>`SELECT version FROM dining_tables WHERE id = ${input.tableId}::uuid FOR UPDATE`;
  if (!tables.length) throw new AccountError("missing", "La mesa no existe.");
  if (tables[0].version !== input.expectedVersion) throw new AccountError("version", "La mesa cambió. Actualizá antes de guardar.");
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  if (productIds.length && await tx.catalogProduct.count({ where: { id: { in: productIds } } }) !== productIds.length) throw new AccountError("product", "Un producto ya no existe en el catálogo.");
  if (input.operatorId) {
    await tx.$queryRaw`SELECT id FROM employees WHERE id = ${input.operatorId}::uuid FOR SHARE`;
    const operator = await tx.employee.findFirst({ where: { id: input.operatorId, active: true, deletedAt: null }, select: { id: true, pinHash: true } });
    if (!operator || verifiedPinHash && operator.pinHash !== verifiedPinHash) throw new AccountError("operator", "El responsable o su código cambió. Volvé a verificar.");
  }
  await tx.diningTableItem.deleteMany({ where: { tableId: input.tableId } });
  if (input.items.length) await tx.diningTableItem.createMany({ data: input.items.map((item) => ({ ...item, tableId: input.tableId })) });
  const table = await tx.diningTable.update({ where: { id: input.tableId }, data: { guests: input.guests, billRequested: input.billRequested, discount: input.discount, ...(input.operatorId !== undefined ? { operatorId: input.operatorId } : {}), version: { increment: 1 } } });
  await tx.tableAccountOperation.create({ data: { id: input.id, tableId: input.tableId, payloadHash: hash, resultVersion: table.version } });
  return { version: table.version, replayed: false };
}
