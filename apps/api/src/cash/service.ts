import { createHash } from "node:crypto";
import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
type Movement = { kind: "gasto" | "proveedor" | "empleado" | "retiro" | "ajuste"; direction: "in" | "out"; amount: number; payment: "Efectivo" | "Tarjeta" | "Transferencia"; concept: string; party: string; receipt: string; employeeId?: string; employeePayment?: { type: string; periodStart: string; periodEnd: string; paidAt: string } };
type Operation = { id: string; action: "open"; openingAmount: number } | { id: string; action: "record"; shiftId: string; expectedVersion: number; movementId: string; movement: Movement } | { id: string; action: "edit"; shiftId: string; expectedVersion: number; movementId: string; movementVersion: number; movement: Movement } | { id: string; action: "void"; shiftId: string; expectedVersion: number; movementId: string; movementVersion: number } | { id: string; action: "close"; shiftId: string; expectedVersion: number; countedAmount: number; differenceReason: string };
const integer = (x: unknown, min = 0): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= 1_000_000_000_000;
const text = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length <= max;
const date = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) && new Date(`${x}T00:00:00Z`).toISOString().startsWith(x);
function parseMovement(value: unknown): Movement | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!['gasto','proveedor','empleado','retiro','ajuste'].includes(String(v.kind)) || !['in','out'].includes(String(v.direction)) || !integer(v.amount, 1) || !['Efectivo','Tarjeta','Transferencia'].includes(String(v.payment)) || !text(v.concept, 200) || !text(v.party, 120) || !text(v.receipt, 120) || !v.concept.trim()) return null;
  if (v.kind !== 'ajuste' && v.direction !== 'out' || (v.kind === 'ajuste' || v.kind === 'retiro') && v.payment !== 'Efectivo' || (v.kind === 'proveedor' || v.kind === 'retiro') && !v.party.trim()) return null;
  let employeePayment: Movement['employeePayment'];
  if (v.kind === 'empleado') {
    if (!validId(v.employeeId) || !v.employeePayment || typeof v.employeePayment !== 'object') return null;
    const p = v.employeePayment as Record<string, unknown>;
    if (!['Sueldo','Adelanto','Otro'].includes(String(p.type)) || !date(p.periodStart) || !date(p.periodEnd) || !date(p.paidAt) || p.periodStart > p.periodEnd) return null;
    employeePayment = { type: p.type as string, periodStart: p.periodStart, periodEnd: p.periodEnd, paidAt: p.paidAt };
  } else if (v.employeeId != null || v.employeePayment != null) return null;
  return { kind: v.kind as Movement['kind'], direction: v.direction as Movement['direction'], amount: v.amount, payment: v.payment as Movement['payment'], concept: v.concept.trim(), party: v.party.trim(), receipt: v.receipt.trim(), ...(employeePayment ? { employeeId: v.employeeId as string, employeePayment } : {}) };
}
export function parseCashOperation(value: unknown): Operation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!validId(v.id)) return null;
  if (v.action === 'open') return integer(v.openingAmount) ? { id: v.id, action: 'open', openingAmount: v.openingAmount } : null;
  if (!validId(v.shiftId) || !integer(v.expectedVersion) || v.expectedVersion >= 2147483647) return null;
  if (v.action === 'close') return integer(v.countedAmount) && text(v.differenceReason, 500) ? { id: v.id, action: 'close', shiftId: v.shiftId, expectedVersion: v.expectedVersion, countedAmount: v.countedAmount, differenceReason: v.differenceReason.trim() } : null;
  if (!validId(v.movementId)) return null;
  if (v.action === 'void') return integer(v.movementVersion) ? { id: v.id, action: 'void', shiftId: v.shiftId, expectedVersion: v.expectedVersion, movementId: v.movementId, movementVersion: v.movementVersion } : null;
  const movement = parseMovement(v.movement);
  if (!movement) return null;
  if (v.action === 'record') return { id: v.id, action: 'record', shiftId: v.shiftId, expectedVersion: v.expectedVersion, movementId: v.movementId, movement };
  if (v.action === 'edit' && integer(v.movementVersion)) return { id: v.id, action: 'edit', shiftId: v.shiftId, expectedVersion: v.expectedVersion, movementId: v.movementId, movementVersion: v.movementVersion, movement };
  return null;
}
export class CashConflict extends Error {}
export async function cashOperation(db: Db, actorId: string, input: Operation) {
  const hash = createHash('sha256').update(JSON.stringify({ actorId, input })).digest('hex');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const previous = await tx.cashOperation.findUnique({ where: { id: input.id } });
    if (previous) {
      if (previous.payloadHash !== hash || previous.actorId !== actorId) throw new CashConflict('La operación ya fue usada con otros datos.');
      return { ...(previous.result as { shiftId: string; version: number }), replayed: true };
    }
    let shiftId: string, version: number;
    if (input.action === 'open') {
      const shift = await tx.cashShift.create({ data: { id: input.id, openingAmount: BigInt(input.openingAmount), openedBy: actorId } });
      shiftId = shift.id; version = shift.version;
    } else {
      await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id = ${input.shiftId}::uuid FOR UPDATE`;
      const shift = await tx.cashShift.findUnique({ where: { id: input.shiftId } });
      if (!shift || shift.closedAt || shift.version !== input.expectedVersion) throw new CashConflict('La caja cambió o ya está cerrada. Actualizá los datos.');
      if (input.action === 'close') {
        const movements = await tx.cashMovement.findMany({ where: { shiftId: shift.id, voidedAt: null, payment: 'Efectivo' } });
        const sales = await tx.sale.aggregate({ where: { cashShiftId: shift.id, payment: 'Efectivo' }, _sum: { total: true } });
        const expected = movements.reduce((sum, item) => sum + (item.direction === 'in' ? item.amount : -item.amount), shift.openingAmount + (sales._sum.total ?? 0n));
        if (expected !== BigInt(input.countedAmount) && input.differenceReason.length < 3) throw new CashConflict('Indicá el motivo de la diferencia.');
        await tx.cashShift.update({ where: { id: shift.id }, data: { closedAt: new Date(), closedBy: actorId, expectedAmount: expected, countedAmount: BigInt(input.countedAmount), differenceReason: input.differenceReason || null, version: { increment: 1 } } });
      } else {
        if (input.action !== 'void' && input.movement.employeeId) {
          await tx.$queryRaw`SELECT id FROM employees WHERE id = ${input.movement.employeeId}::uuid FOR SHARE`;
          const employee = await tx.employee.findFirst({ where: { id: input.movement.employeeId, active: true, deletedAt: null }, select: { id: true, name: true } });
          if (!employee) throw new CashConflict('El empleado no está disponible en esta cafetería.');
          if (input.movement.party !== employee.name) throw new CashConflict('El nombre del empleado cambió. Actualizá antes de guardar.');
        }
        if (input.action === 'record') {
          const m = input.movement;
          await tx.cashMovement.create({ data: { ...m, amount: BigInt(m.amount), employeePayment: m.employeePayment ?? Prisma.DbNull, id: input.movementId, shiftId: shift.id, createdBy: actorId } });
        } else {
          const old = await tx.cashMovement.findFirst({ where: { id: input.movementId, shiftId: shift.id, version: input.movementVersion, voidedAt: null } });
          if (!old) throw new CashConflict('El movimiento cambió o ya está anulado.');
          if (input.action === 'void') await tx.cashMovement.update({ where: { id: old.id }, data: { voidedAt: new Date(), version: { increment: 1 } } });
          else { const m = input.movement; await tx.cashMovement.update({ where: { id: old.id }, data: { ...m, amount: BigInt(m.amount), employeeId: m.employeeId ?? null, employeePayment: m.employeePayment ?? Prisma.DbNull, version: { increment: 1 } } }); }
        }
        await tx.cashShift.update({ where: { id: shift.id }, data: { version: { increment: 1 } } });
      }
      shiftId = shift.id; version = shift.version + 1;
    }
    const result = { shiftId, version };
    await tx.cashOperation.create({ data: { id: input.id, payloadHash: hash, actorId, payload: input, result } });
    return { ...result, replayed: false };
  }, { timeout: 15000 });
}
export async function readCash(db: Db) {
  const shift = await db.cashShift.findFirst({ where: { closedAt: null }, include: { movements: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } });
  if (!shift) return null;
  const sales = await db.sale.aggregate({ where: { cashShiftId: shift.id, payment: 'Efectivo' }, _sum: { total: true } });
  const expected = shift.movements.filter((item) => !item.voidedAt && item.payment === 'Efectivo').reduce((sum, item) => sum + (item.direction === 'in' ? item.amount : -item.amount), shift.openingAmount + (sales._sum.total ?? 0n));
  return { ...shift, openingAmount: shift.openingAmount.toString(), expectedAmount: expected.toString(), countedAmount: null, cashSales: (sales._sum.total ?? 0n).toString(), salesIncluded: true, movements: shift.movements.map((item) => ({ ...item, amount: item.amount.toString() })) };
}
