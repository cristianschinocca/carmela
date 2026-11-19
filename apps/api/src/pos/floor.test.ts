import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { parseSector, parseTable } from "./floor.js";
test("valida sectores, posiciones y mesas", () => {
  const sector = { name: "Salón", description: "", kind: "tables", position: 0, layout: { x: 0, y: 0, width: 0.75, height: 300 } };
  assert.ok(parseSector(sector));
  assert.equal(parseSector({ ...sector, layout: { ...sector.layout, x: 0.5 } }), null);
  assert.equal(parseSector({ ...sector, kind: "otro" }), null);
  const table = { sectorId: randomUUID(), number: 1, name: "Mesa 1", x: 30, y: 40, slot: 0 };
  assert.ok(parseTable(table));
  assert.equal(parseTable({ ...table, number: 0 }), null);
  assert.equal(parseTable({ ...table, x: Infinity }), null);
  assert.equal(parseTable({ ...table, slot: 256 }), null);
});
