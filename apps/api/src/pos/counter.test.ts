import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCounterOpen } from "./counter.js";
const id = "550e8400-e29b-41d4-a716-446655440000";
test("valida identidad, responsable y PIN antes de abrir mostrador", () => {
  assert.deepEqual(parseCounterOpen({ id, operatorId: id, employeePin: "1937" }), { id, operatorId: id, employeePin: "1937" });
  assert.equal(parseCounterOpen({ id, operatorId: id, employeePin: "123" }), null);
  assert.equal(parseCounterOpen({ id, operatorId: "otro", employeePin: "1937" }), null);
  assert.equal(parseCounterOpen({ id: "otro", operatorId: id, employeePin: "1937" }), null);
});

import { randomUUID } from "node:crypto";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { openCounter } from "./counter.js";
import { parseFloor, readFloor, saveFloor } from "./floorSync.js";

test("abre mostrador sin duplicar y conserva sus cuentas al guardar el plano", { skip: !process.env.TENANT_DB_COUNTER_TEST_URL }, async () => {
  const db = tenantDatabase("counter_test");
  try {
    const floor = parseFloor({ id: randomUUID(), expectedVersion: 0, sectors: [{ id: "counter", label: "Mostrador", description: "Atención rápida", limit: 50, columns: 3, start: 1, minHeight: 186 }], tables: [] })!;
    await saveFloor(db, floor);
    const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: "test-hash", pinLookup: randomUUID() } });
    const input = { id: randomUUID(), operatorId: employee.id };
    const [first, replay] = await Promise.all([openCounter(db, input, "test-hash"), openCounter(db, input, "test-hash")]);
    assert.equal(first.clientKey, replay.clientKey);
    assert.equal(Number(first.replayed) + Number(replay.replayed), 1);
    const second = await openCounter(db, { id: randomUUID(), operatorId: employee.id }, "test-hash");
    assert.notEqual(first.clientKey, second.clientKey);
    assert.equal((await readFloor(db)).tables.length, 2);
    await saveFloor(db, { ...floor, id: randomUUID(), expectedVersion: 1 });
    const tables = (await readFloor(db)).tables;
    assert.equal(tables.length, 2);
    assert.deepEqual(tables.map((table) => table.name), ["Mesa 1", "Mesa 2"]);
    await db.diningTable.update({ where: { id: input.id }, data: { guests: 0, operatorId: null } });
    assert.equal((await readFloor(db)).tables.length, 1);
    const next = await openCounter(db, { id: randomUUID(), operatorId: employee.id }, "test-hash");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { clientKey: next.clientKey } })).number, 3);
    await assert.rejects(openCounter(db, { id: randomUUID(), operatorId: employee.id }, "wrong-hash"));
  } finally { await closeDatabases(); }
});
