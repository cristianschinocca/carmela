import type { tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";

type Db = ReturnType<typeof tenantDatabase>;
export class CounterError extends Error {}
export function parseCounterOpen(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!validId(v.id) || !validId(v.operatorId) || typeof v.employeePin !== "string" || !/^\d{4}$/.test(v.employeePin)) return null;
  return { id: v.id, operatorId: v.operatorId, employeePin: v.employeePin };
}

/** La mesa se crea junto con su responsable. El ID permite reintentar sin duplicarla. */
export async function openCounter(db: Db, input: { id: string; operatorId: string }, pinHash: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM floor_revision WHERE id = 'floor' FOR UPDATE`;
    const sector = await tx.floorSector.findUnique({ where: { clientKey: "counter" } });
    if (!sector) throw new CounterError("El plano no tiene un mostrador configurado.");
    const previous = await tx.diningTable.findUnique({ where: { id: input.id } });
    if (previous) {
      if (previous.sectorId !== sector.id || previous.operatorId !== input.operatorId) throw new CounterError("La operación ya corresponde a otra cuenta.");
      return { clientKey: previous.clientKey!, replayed: true };
    }
    await tx.$queryRaw`SELECT id FROM employees WHERE id = ${input.operatorId}::uuid FOR SHARE`;
    const employee = await tx.employee.findUnique({ where: { id: input.operatorId }, select: { active: true, deletedAt: true, pinHash: true } });
    if (!employee?.active || employee.deletedAt || employee.pinHash !== pinHash) throw new CounterError("El responsable o su código cambió. Volvé a verificar.");
    const occupied = await tx.diningTable.findMany({ where: { sectorId: sector.id, OR: [{ guests: { gt: 0 } }, { billRequested: true }, { items: { some: {} } }] }, select: { slot: true } });
    if (occupied.length >= 50) throw new CounterError("El mostrador ya tiene 50 cuentas abiertas.");
    const used = new Set(occupied.map((table) => table.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const max = await tx.diningTable.aggregate({ where: { sectorId: sector.id }, _max: { number: true } });
    const number = (max._max.number ?? 0) + 1;
    if (number > 2147483647) throw new CounterError("No se pueden crear más cuentas de mostrador.");
    const clientKey = `counter-${input.id}`;
    await tx.diningTable.create({ data: { id: input.id, clientKey, sectorId: sector.id, name: `Mesa ${number}`, number, slot, guests: 1, operatorId: input.operatorId } });
    return { clientKey, replayed: false };
  });
}
