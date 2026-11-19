import { createHash } from "node:crypto";
import type { tenantDatabase } from "@mistro/db/tenant";
import { verifyPin } from "./employee.js";

type Db = ReturnType<typeof tenantDatabase>;
/** Comparte el límite de intentos del fichaje para impedir su evasión entre endpoints. */
export async function verifyEmployeeCode(db: Db, actorId: string, employeeId: number, pin: string) {
  const guardId = createHash("sha256").update(actorId).digest("hex");
  return db.$transaction(async (tx) => {
    const now = new Date();
    await tx.$executeRaw`INSERT INTO attendance_guards (id, attempts, window_start) VALUES (${guardId}, 0, ${now}) ON CONFLICT (id) DO NOTHING`;
    const [guard] = await tx.$queryRaw<Array<{ attempts: number; window_start: Date; blocked_until: Date | null }>>`SELECT attempts, window_start, blocked_until FROM attendance_guards WHERE id = ${guardId} FOR UPDATE`;
    if (guard.blocked_until && guard.blocked_until > now) return "blocked" as const;
    const employee = await tx.employee.findUnique({ where: { legacyId: BigInt(employeeId) }, select: { active: true, deletedAt: true, pinHash: true } });
    const valid = await verifyPin(pin, employee?.pinHash);
    if (!valid || !employee?.active || employee.deletedAt) {
      const expired = now.getTime() - guard.window_start.getTime() >= 300_000;
      const attempts = (expired ? 0 : guard.attempts) + 1;
      const blockedUntil = attempts >= 5 ? new Date(now.getTime() + 60_000) : null;
      await tx.attendanceGuard.update({ where: { id: guardId }, data: { attempts: blockedUntil ? 0 : attempts, windowStart: expired || blockedUntil ? now : guard.window_start, blockedUntil } });
      return blockedUntil ? "blocked" as const : "invalid" as const;
    }
    await tx.attendanceGuard.update({ where: { id: guardId }, data: { attempts: 0, windowStart: now, blockedUntil: null } });
    return "valid" as const;
  }, { timeout: 15000 });
}
