import { createHash } from "node:crypto";
import { Prisma, type tenantDatabase } from "@mistro/db/tenant";
import { validId } from "../catalog/validation.js";
import { parseSector, parseTable } from "./floor.js";

type Db = ReturnType<typeof tenantDatabase>;
type Sector = { id: string; label: string; description: string; limit: number; columns: number; start: number; minHeight: number; layout?: { x: number; y: number; width: number; height: number }; autoFit?: boolean };
type Table = { id: string; name: string; area: string; x: number; y: number; slot: number | null; number: number };
type FloorChange = { id: string; expectedVersion: number; sectors: Sector[]; tables: Table[] };
const key = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const int = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
export class FloorConflict extends Error {}
export function parseFloor(value: unknown): FloorChange | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!validId(v.id) || !int(v.expectedVersion, 0, 2147483646) || !Array.isArray(v.sectors) || !v.sectors.length || v.sectors.length > 20 || !Array.isArray(v.tables) || v.tables.length > 1200) return null;
  const sectors: Sector[] = [];
  for (const item of v.sectors) {
    if (!item || typeof item !== "object") return null;
    const s = item as Record<string, unknown>;
    if (!key(s.id) || typeof s.label !== "string" || typeof s.description !== "string" || !int(s.columns, 3, 12) || !int(s.start, 1, 12) || !int(s.limit, 1, 60) || !int(s.minHeight, 140, 3000) || (s.autoFit !== undefined && typeof s.autoFit !== "boolean")) return null;
    const parsed = parseSector({ name: s.label, description: s.description, kind: s.id === "counter" ? "counter" : "tables", position: sectors.length, layout: s.layout ?? null });
    if (!parsed || sectors.some((x) => x.id === s.id)) return null;
    sectors.push({ id: s.id, label: parsed.name, description: parsed.description, limit: s.limit, columns: s.columns, start: s.start, minHeight: s.minHeight, ...(parsed.layout ? { layout: parsed.layout } : {}), ...(s.autoFit !== undefined ? { autoFit: s.autoFit } : {}) });
  }
  const tables: Table[] = [];
  for (const item of v.tables) {
    if (!item || typeof item !== "object") return null;
    const t = item as Record<string, unknown>;
    const number = typeof t.name === "string" ? Number(t.name.match(/\d+/)?.[0]) : NaN;
    const sector = sectors.find((s) => s.id === t.area);
    if (!key(t.id) || !sector || sector.id === "counter" || !int(number, 1, 60) || !parseTable({ sectorId: "550e8400-e29b-41d4-a716-446655440000", number, name: t.name, x: t.x, y: t.y, slot: t.slot ?? null }) || tables.some((x) => x.id === t.id || (x.area === t.area && (x.number === number || (t.slot != null && x.slot === t.slot))))) return null;
    tables.push({ id: t.id, area: sector.id, name: t.name as string, number, x: t.x as number, y: t.y as number, slot: (t.slot ?? null) as number | null });
  }
  if (sectors.some((s) => tables.filter((t) => t.area === s.id).length > s.limit)) return null;
  return { id: v.id, expectedVersion: v.expectedVersion, sectors, tables };
}
export async function readFloor(db: Db) {
  const [revision, sectors] = await db.$transaction([db.floorRevision.findUnique({ where: { id: "floor" } }), db.floorSector.findMany({ orderBy: { position: "asc" }, include: { tables: { orderBy: [{ slot: "asc" }, { number: "asc" }], include: { items: { select: { id: true }, take: 1 } } } } })], { isolationLevel: "RepeatableRead" });
  if (sectors.some((sector) => !sector.clientKey || !sector.config || sector.tables.some((table) => !table.clientKey))) throw new FloorConflict("Hay mesas del servidor que requieren migración antes de usar este plano.");
  return { version: revision?.version ?? 0, initialized: sectors.length > 0, sectors: sectors.map((sector) => sector.config), tables: sectors.flatMap((sector) => sector.tables.filter((table) => sector.kind !== "counter" || table.items.length > 0 || table.guests > 0 || table.billRequested).map((table) => ({ id: table.clientKey, area: sector.clientKey, name: table.name, x: table.x, y: table.y, slot: table.slot, hasAccount: table.items.length > 0 || table.guests > 0 || table.billRequested }))) };
}
export async function saveFloor(db: Db, input: FloorChange) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO floor_revision (id, version) VALUES ('floor', 0) ON CONFLICT (id) DO NOTHING`;
    await tx.$queryRaw`SELECT id FROM floor_revision WHERE id = 'floor' FOR UPDATE`;
    const previous = await tx.floorOperation.findUnique({ where: { id: input.id } });
    if (previous) { if (previous.payloadHash !== hash) throw new FloorConflict("La operación corresponde a otros datos."); return { version: previous.resultVersion, replayed: true }; }
    const revision = await tx.floorRevision.findUniqueOrThrow({ where: { id: "floor" } });
    if (revision.version !== input.expectedVersion) throw new FloorConflict("El plano cambió en otra terminal. Actualizá antes de guardar.");
    await tx.$queryRaw`SELECT id FROM dining_tables ORDER BY id FOR UPDATE`;
    const existing = await tx.floorSector.findMany({ include: { tables: { include: { items: { select: { id: true }, take: 1 } } } } });
    if (existing.some((s) => !s.clientKey || !s.config || s.tables.some((t) => !t.clientKey))) throw new FloorConflict("Hay mesas del servidor que requieren migración antes de guardar el plano.");
    const counter = existing.find((s) => s.clientKey === "counter");
    if (counter?.tables.length && !input.sectors.some((sector) => sector.id === "counter")) throw new FloorConflict("No se puede eliminar el mostrador con cuentas registradas.");
    const allTables = existing.filter((s) => s.clientKey !== "counter").flatMap((s) => s.tables);
    const removed = allTables.filter((t) => !input.tables.some((entry) => entry.id === t.clientKey));
    if (removed.some((t) => t.items.length || t.guests > 0 || t.billRequested)) throw new FloorConflict("No se puede eliminar una mesa con cuenta abierta.");
    for (const table of removed) await tx.diningTable.delete({ where: { id: table.id } });
    for (const table of allTables.filter((t) => !removed.includes(t))) {
      const next = input.tables.find((t) => t.id === table.clientKey)!;
      if ((table.items.length || table.guests > 0 || table.billRequested) && existing.find((s) => s.id === table.sectorId)?.clientKey !== next.area) throw new FloorConflict("No se puede mover de sector una mesa con cuenta abierta.");
    }
    const renumbered = allTables.filter((table) => {
      const next = input.tables.find((entry) => entry.id === table.clientKey);
      return next && (table.number !== next.number || existing.find((sector) => sector.id === table.sectorId)?.clientKey !== next.area);
    });
    for (const [index, table] of renumbered.entries()) await tx.diningTable.update({ where: { id: table.id }, data: { number: 1000000000 + index } });
    const sectorIds = new Map<string, string>();
    for (const [position, sector] of input.sectors.entries()) {
      const old = existing.find((s) => s.clientKey === sector.id);
      const data = { name: sector.label, description: sector.description, kind: sector.id === "counter" ? "counter" : "tables", position, layout: sector.layout ?? Prisma.DbNull, config: sector as Prisma.InputJsonValue };
      const saved = old ? await tx.floorSector.update({ where: { id: old.id }, data: { ...data, version: { increment: 1 } } }) : await tx.floorSector.create({ data: { ...data, clientKey: sector.id } });
      sectorIds.set(sector.id, saved.id);
    }
    for (const table of input.tables) {
      const old = allTables.find((t) => t.clientKey === table.id);
      const data = { name: table.name, sectorId: sectorIds.get(table.area)!, number: table.number, x: table.x, y: table.y, slot: table.slot };
      if (old) {
        if (old.name !== data.name || old.sectorId !== data.sectorId || old.number !== data.number || old.x !== data.x || old.y !== data.y || old.slot !== data.slot)
          await tx.diningTable.update({ where: { id: old.id }, data: { ...data, version: { increment: 1 } } });
      } else await tx.diningTable.create({ data: { ...data, clientKey: table.id } });
    }
    for (const sector of existing.filter((s) => !sectorIds.has(s.clientKey!))) await tx.floorSector.delete({ where: { id: sector.id } });
    const result = await tx.floorRevision.update({ where: { id: "floor" }, data: { version: { increment: 1 } } });
    await tx.floorOperation.create({ data: { id: input.id, payloadHash: hash, resultVersion: result.version } });
    return { version: result.version, replayed: false };
  });
}
