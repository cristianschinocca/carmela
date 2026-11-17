import { createHash } from "node:crypto";
import type { tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
export type StockChange = { id: string; productId: string; kind: "entrada" | "salida" | "ajuste"; amount: number; minimum: number; enabled: boolean; expectedVersion: number; note: string };

export function parseStockChange(value: unknown): StockChange | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const integer = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 2147483646;
  if (!validId(v.id) || !validId(v.productId) || (v.kind !== "entrada" && v.kind !== "salida" && v.kind !== "ajuste") ||
      !integer(v.amount) || !integer(v.minimum) || !integer(v.expectedVersion) || typeof v.enabled !== "boolean" || typeof v.note !== "string" || v.note.length > 500) return null;
  return { id: v.id, productId: v.productId, kind: v.kind, amount: v.amount as number, minimum: v.minimum as number, enabled: v.enabled, expectedVersion: v.expectedVersion as number, note: v.note.trim() };
}

export class StockConflict extends Error { constructor(public readonly reason: "idempotency" | "version" | "negative" | "missing") { super(reason); } }

export async function applyProductStockChange(db: Db, input: StockChange) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const previous = await tx.productStockMovement.findUnique({ where: { id: input.id } });
    if (previous) {
      if (previous.payloadHash !== hash) throw new StockConflict("idempotency");
      return { balance: previous.balance, replayed: true };
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM catalog_products WHERE id = ${input.productId}::uuid FOR UPDATE`;
    if (!rows.length) throw new StockConflict("missing");
    const stock = await tx.productStock.findUnique({ where: { productId: input.productId } });
    if ((stock?.version ?? 0) !== input.expectedVersion) throw new StockConflict("version");
    const current = stock?.quantity ?? 0;
    const next = input.kind === "ajuste" ? input.amount : input.kind === "entrada" ? current + input.amount : current - input.amount;
    if (!Number.isSafeInteger(next) || next < 0 || next > 2147483647) throw new StockConflict("negative");
    await tx.productStock.upsert({ where: { productId: input.productId }, create: { productId: input.productId, quantity: next, minimum: input.minimum, enabled: input.enabled, version: 1 }, update: { quantity: next, minimum: input.minimum, enabled: input.enabled, version: { increment: 1 } } });
    await tx.productStockMovement.create({ data: { id: input.id, payloadHash: hash, productId: input.productId, kind: input.kind, amount: input.amount, balance: next, note: input.note } });
    return { balance: next, replayed: false };
  });
}
