import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { parseFloor, readFloor, saveFloor, FloorConflict } from "./floorSync.js";
const floor = () => ({ id: randomUUID(), expectedVersion: 0, sectors: [{ id: "salon", label: "Salón", description: "Interior", limit: 60, columns: 9, start: 1, minHeight: 186, layout: { x: 0, y: 20, width: 0.75, height: 300 } }], tables: [{ id: "mesa-1", area: "salon", name: "Mesa 1", x: 30, y: 40, slot: 0 }] });
test("valida el plano y evita números duplicados", () => {
  const value = floor(); assert.ok(parseFloor(value));
  assert.equal(parseFloor({ ...value, tables: [...value.tables, { ...value.tables[0], id: "mesa-2" }] }), null);
  assert.equal(parseFloor({ ...value, tables: [{ ...value.tables[0], name: "Mesa 61" }] }), null);
  assert.equal(parseFloor({ ...value, tables: [...value.tables, { ...value.tables[0], id: "mesa-2", name: "Mesa 2" }] }), null);
});
test("guarda el plano atómicamente y protege cuentas y versiones", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const first = parseFloor(floor())!;
    assert.equal((await saveFloor(db, first)).version, 1);
    assert.equal((await saveFloor(db, first)).replayed, true);
    const initial = await readFloor(db);
    assert.equal(initial.tables[0].x, 30);
    assert.deepEqual((initial.sectors[0] as { layout: unknown }).layout, { x: 0, y: 20, width: 0.75, height: 300 });
    await assert.rejects(saveFloor(db, { ...first, id: randomUUID() }), FloorConflict);
    const moved = { ...first, id: randomUUID(), expectedVersion: 1, tables: first.tables.map((t) => ({ ...t, x: 90 })) };
    assert.equal((await saveFloor(db, moved)).version, 2);
    assert.equal((await readFloor(db)).tables[0].x, 90);
    const added = { ...moved, id: randomUUID(), expectedVersion: 2, tables: [...moved.tables, { id: "mesa-2", name: "Mesa 2", area: "salon", x: 120, y: 40, slot: 1, number: 2 }] };
    assert.equal((await saveFloor(db, added)).version, 3);
    const swapped = { ...added, id: randomUUID(), expectedVersion: 3, tables: added.tables.map((t) => t.id === "mesa-1" ? { ...t, name: "Mesa 2", number: 2 } : { ...t, name: "Mesa 1", number: 1 }) };
    assert.equal((await saveFloor(db, swapped)).version, 4);
    const table = await db.diningTable.findFirstOrThrow({ where: { clientKey: "mesa-1" } });
    await db.diningTable.update({ where: { id: table.id }, data: { guests: 2 } });
    await assert.rejects(saveFloor(db, { ...swapped, id: randomUUID(), expectedVersion: 4, tables: [] }), FloorConflict);
    assert.equal((await readFloor(db)).tables.length, 2);
  } finally { await closeDatabases(); }
});
