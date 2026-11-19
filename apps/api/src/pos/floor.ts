import { validId } from "../catalog/validation.js";
const safeInt = (value: unknown, max: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
const coordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000;
const text = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || !!value.trim());

type Layout = { x: number; y: number; width: number; height: number };
function parseLayout(value: unknown): Layout | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!coordinate(v.x) || !coordinate(v.y) || !coordinate(v.width) || !coordinate(v.height) || v.width < 0.16 || v.width > 1 || v.x + v.width > 1.000001 || v.height < 140 || v.height > 3000) return undefined;
  return { x: v.x, y: v.y, width: v.width, height: v.height };
}
export function parseSector(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const layout = parseLayout(v.layout);
  if (!text(v.name, 120, true) || !text(v.description, 160) || (v.kind !== "tables" && v.kind !== "counter") || !safeInt(v.position, 10000) || layout === undefined) return null;
  return { name: v.name.trim(), description: v.description.trim(), kind: v.kind, position: v.position, layout };
}
export function parseTable(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!validId(v.sectorId) || !safeInt(v.number, 2147483647) || v.number < 1 || !text(v.name, 120, true) || !coordinate(v.x) || !coordinate(v.y) || !(v.slot === null || safeInt(v.slot, 255))) return null;
  return { sectorId: v.sectorId, number: v.number, name: v.name.trim(), x: v.x, y: v.y, slot: v.slot };
}
export const validFloorVersion = (value: unknown): value is number => safeInt(value, 2147483646);
