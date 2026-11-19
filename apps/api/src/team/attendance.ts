import { createHash } from "node:crypto";
import type { tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";
import { pinLookup, verifyPin } from "./employee.js";

type Db = ReturnType<typeof tenantDatabase>;
type Input = { id: string; pin: string };
type Result = { status: "completed"; name: string; kind: "Entrada" | "Salida"; at: string; replayed: boolean } | { status: "invalid" | "blocked" | "cancelled" | "conflict"; retryAfter?: number };
export function parseClock(value: unknown): Input | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  return validId(input.id) && typeof input.pin === "string" && /^\d{4}$/.test(input.pin) ? { id: input.id, pin: input.pin } : null;
}
const completed = (row: { employeeName: string | null; kind: string | null; occurredAt: Date | null }, replayed: boolean): Result => ({ status: "completed", name: row.employeeName!, kind: row.kind as "Entrada" | "Salida", at: row.occurredAt!.toISOString(), replayed });

/** Un PIN solo permanece en memoria; la operación y sus reintentos se identifican sin almacenarlo. */
export async function clockEmployee(db: Db, workspaceId: string, actorId: string, input: Input): Promise<Result> {
  const lookup = pinLookup(input.pin, workspaceId);
  const payloadHash = createHash("sha256").update(`${actorId}\0${lookup}`).digest("hex");
  const guardId = createHash("sha256").update(actorId).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const now = new Date();
    await tx.$executeRaw`INSERT INTO attendance_guards (id, attempts, window_start) VALUES (${guardId}, 0, ${now}) ON CONFLICT (id) DO NOTHING`;
    const guards = await tx.$queryRaw<Array<{ attempts: number; window_start: Date; blocked_until: Date | null }>>`SELECT attempts, window_start, blocked_until FROM attendance_guards WHERE id = ${guardId} FOR UPDATE`;
    const guard = guards[0];
    if (guard.blocked_until && guard.blocked_until > now) return { status: "blocked", retryAfter: Math.max(1, Math.ceil((guard.blocked_until.getTime() - now.getTime()) / 1000)) };
    const fail = async (): Promise<Result> => {
      const expired = now.getTime() - guard.window_start.getTime() >= 5 * 60 * 1000;
      const attempts = (expired ? 0 : guard.attempts) + 1;
      const blockedUntil = attempts >= 5 ? new Date(now.getTime() + 60_000) : null;
      await tx.attendanceGuard.update({ where: { id: guardId }, data: { attempts: blockedUntil ? 0 : attempts, windowStart: expired || blockedUntil ? now : guard.window_start, blockedUntil } });
      return blockedUntil ? { status: "blocked", retryAfter: 60 } : { status: "invalid" };
    };
    const previous = await tx.attendanceOperation.findUnique({ where: { id: input.id } });
    if (previous) {
      if (previous.actorId !== actorId || (previous.status === "completed" && previous.payloadHash !== payloadHash)) return fail();
      return previous.status === "cancelled" ? { status: "cancelled" } : completed(previous, true);
    }
    const rows = await tx.$queryRaw<Array<{ id: string; name: string; pin_hash: string; active: boolean; deleted_at: Date | null; clocked_in: boolean }>>`SELECT id, name, pin_hash, active, deleted_at, clocked_in FROM employees WHERE pin_lookup = ${lookup} FOR UPDATE`;
    const employee = rows[0];
    const valid = await verifyPin(input.pin, employee?.pin_hash);
    if (!valid || !employee?.active || employee.deleted_at) {
      return fail();
    }
    await tx.attendanceGuard.update({ where: { id: guardId }, data: { attempts: 0, windowStart: now, blockedUntil: null } });
    const kind = employee.clocked_in ? "Salida" : "Entrada";
    await tx.employee.update({ where: { id: employee.id }, data: { clockedIn: !employee.clocked_in, clockedInAt: employee.clocked_in ? null : now, version: { increment: 1 } } });
    await tx.attendanceOperation.create({ data: { id: input.id, status: "completed", payloadHash, employeeId: employee.id, employeeName: employee.name, kind, occurredAt: now, actorId } });
    return { status: "completed", name: employee.name, kind, at: now.toISOString(), replayed: false };
  }, { timeout: 15000 });
}
/** Cierra un intento incierto para que un pedido demorado no pueda fichar después. */
export async function reconcileClock(db: Db, actorId: string, id: string): Promise<Result> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    const previous = await tx.attendanceOperation.findUnique({ where: { id } });
    if (previous) {
      if (previous.actorId !== actorId) return { status: "conflict" };
      return previous.status === "cancelled" ? { status: "cancelled" } : completed(previous, true);
    }
    await tx.attendanceOperation.create({ data: { id, status: "cancelled", actorId } });
    return { status: "cancelled" };
  });
}
