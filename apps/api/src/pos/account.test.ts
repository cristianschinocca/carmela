import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { AccountError, parseAccountChange, saveTableAccount } from "./account.js";
import { settleTable } from "./settlement.js";
import { readAccounts } from "./accountsRead.js";

const input = () => ({ id: randomUUID(), tableId: randomUUID(), expectedVersion: 0, guests: 2, billRequested: false, discount: 0, items: [{ id: randomUUID(), productId: randomUUID(), quantity: 1, unitPrice: 1000, unitDiscount: 0, note: "" }] });
test("valida cantidad, descuento, versiones e identificadores únicos", () => {
  const value = input();
  assert.ok(parseAccountChange(value));
  assert.equal(parseAccountChange({ ...value, discount: 1001 }), null);
  assert.equal(parseAccountChange({ ...value, items: [...value.items, value.items[0]] }), null);
  assert.equal(parseAccountChange({ ...value, items: [{ ...value.items[0], quantity: 0 }] }), null);
  assert.equal(parseAccountChange({ ...value, expectedVersion: -1 }), null);
  assert.equal(parseAccountChange({ ...value, operatorId: "bad-id" }), null);
});
test("guarda la cuenta de forma atómica, idempotente y con control de versiones", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    await db.cashShift.create({ data: { id: randomUUID(), openedBy: "test", openingAmount: 0 } });
    const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: "test" } });
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { name: "Producto", price: 1000, categoryId: category.id } });
    const sector = await db.floorSector.create({ data: { name: "Salón" } });
    const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, clientKey: "mesa-1" } });
    const first = { ...input(), operatorId: employee.id, tableId: table.id, items: [{ ...input().items[0], productId: product.id }] };
    const [a, b] = await Promise.all([saveTableAccount(db, first), saveTableAccount(db, first)]);
    assert.deepEqual([a.replayed, b.replayed].sort(), [false, true]);
    assert.equal(await db.diningTableItem.count({ where: { tableId: table.id } }), 1);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).operatorId, employee.id);
    const accounts = await readAccounts(db);
    assert.equal(accounts[0].clientKey, "mesa-1");
    assert.equal(accounts[0].operator?.id, employee.id);
    assert.equal(accounts[0].items[0].productLegacyId, Number(product.legacyId));
    assert.equal(JSON.stringify(accounts).includes("pinHash"), false);
    await assert.rejects(saveTableAccount(db, { ...first, guests: 3 }), (error) => error instanceof AccountError && error.reason === "idempotency");
    await assert.rejects(saveTableAccount(db, { ...first, id: randomUUID(), expectedVersion: 1, operatorId: randomUUID() }), (error) => error instanceof AccountError && error.reason === "operator");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).version, 1);
    const attempts = await Promise.allSettled([2, 3].map((guests) => saveTableAccount(db, { ...first, id: randomUUID(), expectedVersion: 1, guests })));
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    const sale = await settleTable(db, { id: randomUUID(), tableId: table.id, expectedVersion: 2, payment: "Efectivo" });
    assert.equal(sale.total, "1000");
    const recorded = await db.sale.findUniqueOrThrow({ where: { id: sale.saleId } });
    assert.equal(recorded.operatorId, employee.id); assert.equal(recorded.operatorName, "Ana");
    await assert.rejects(saveTableAccount(db, { ...first, id: randomUUID(), expectedVersion: 2 }), (error) => error instanceof AccountError && error.reason === "version");
    assert.equal(await db.diningTableItem.count({ where: { tableId: table.id } }), 0);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).operatorId, null);
  } finally { await closeDatabases(); }
});
