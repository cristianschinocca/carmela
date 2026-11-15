import { materializeTableSlots, tablePosition, type Line, type Table } from "./floorModel";

export const lineUnitPrice = (line: Line, productPrice: number) => Math.max(0, (line.unitPrice ?? productPrice) - (line.unitDiscount ?? 0));
export const sameLinePrice = (a: Line, b: Line) => a.unitPrice === b.unitPrice && (a.unitDiscount || 0) === (b.unitDiscount || 0);
export const makeCounterTable = (tables: Table[], id = `counter-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`): Table => {
  const occupied = new Set(materializeTableSlots(tables).filter((table) => table.area === "counter").map((table) => table.slot));
  let slot = 0;
  while (occupied.has(slot)) slot++;
  return { id, name: "Mostrador", area: "counter", guests: 2, items: [], discount: 0, billRequested: false, slot, ...tablePosition(slot, "counter") };
};
