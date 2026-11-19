import { createHash, timingSafeEqual } from "node:crypto";
import type { tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
export function parseTerminal(value: unknown): { deviceId: string; token: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  return validId(input.deviceId) && typeof input.token === "string" && /^[a-f0-9]{64}$/.test(input.token) ? { deviceId: input.deviceId, token: input.token } : null;
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function belongsTo(terminal: { deviceId: string; tokenHash: string }, identity: { deviceId: string; token: string } | null) {
  if (!identity || terminal.deviceId !== identity.deviceId) return false;
  const actual = Buffer.from(terminal.tokenHash, "hex"), candidate = Buffer.from(hash(identity.token), "hex");
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}
export async function readTerminal(db: Db, identity: { deviceId: string; token: string } | null) {
  const terminal = await db.offlineTerminal.findUnique({ where: { id: "terminal" } });
  return terminal ? { registered: true, isCurrent: belongsTo(terminal, identity), registeredAt: terminal.registeredAt } : { registered: false, isCurrent: false, registeredAt: null };
}
export async function registerTerminal(db: Db, actorId: string, identity: { deviceId: string; token: string }) {
  await db.offlineTerminal.createMany({ data: [{ id: "terminal", deviceId: identity.deviceId, tokenHash: hash(identity.token), registeredBy: actorId }], skipDuplicates: true });
  const terminal = await readTerminal(db, identity);
  if (!terminal.isCurrent) throw new Error("Ya hay otra PC registrada para esta cafetería.");
  return terminal;
}
