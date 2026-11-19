import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { settleTable } from "./settlement.js";
import { AccountError } from "./account.js";
import { parseAccountBatch, saveAccountBatch } from "./accountBatch.js";

test("valida que el traslado comprenda dos mesas y artículos únicos", () => {
  const id = randomUUID(), tableId = randomUUID(), item = { id: randomUUID(), productId: randomUUID(), quantity: 1, unitPrice: 100, unitDiscount: 0, note: "" };
  const account = { tableId, expectedVersion: 0, guests: 2, billRequested: false, discount: 0, items: [item] };
  assert.ok(parseAccountBatch({ id, accounts: [account, { ...account, tableId: randomUUID(), items: [] }] }));
  assert.equal(parseAccountBatch({ id, accounts: [account, account] }), null);
  assert.equal(parseAccountBatch({ id, accounts: [account, { ...account, tableId: randomUUID() }] }), null);
});
test("traslada en forma atómica y conserva cantidades, descuentos y versiones", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    await db.cashShift.create({ data: { id: randomUUID(), openedBy: "test", openingAmount: 0 } });
    const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: "test" } });
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { categoryId: category.id, name: "Café", price: 100 } });
    const sector = await db.floorSector.create({ data: { name: "Salón" } });
    const [a, b] = await Promise.all([1, 2].map((number) => db.diningTable.create({ data: { number, sectorId: sector.id } })));
    await db.diningTable.update({ where: { id: a.id }, data: { operatorId: employee.id } });
    const item = await db.diningTableItem.create({ data: { tableId: a.id, productId: product.id, quantity: 2, unitPrice: 100 } });
    const input = parseAccountBatch({ id: randomUUID(), accounts: [
      { tableId: a.id, expectedVersion: 0, guests: 0, discount: 0, billRequested: false, operatorId: null, items: [] },
      { tableId: b.id, expectedVersion: 0, guests: 2, discount: 0, billRequested: false, operatorId: employee.id, items: [{ id: item.id, productId: product.id, quantity: 2, unitPrice: 100, unitDiscount: 0, note: "" }] },
    ] })!;
    const first = await saveAccountBatch(db, input);
    assert.equal(first.versions[a.id], 1); assert.equal(first.versions[b.id], 1);
    assert.equal((await db.diningTableItem.findUniqueOrThrow({ where: { id: item.id } })).tableId, b.id);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: a.id } })).operatorId, null);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: b.id } })).operatorId, employee.id);
    assert.equal((await saveAccountBatch(db, input)).replayed, true);
    const tampered = { ...input, id: randomUUID(), accounts: input.accounts.map((account) => ({ ...account, expectedVersion: 1, items: account.items.map((line) => ({ ...line, quantity: 3 })) })) };
    await assert.rejects(saveAccountBatch(db, tampered), (error) => error instanceof AccountError && error.reason === "product");
    assert.equal((await db.diningTableItem.findUniqueOrThrow({ where: { id: item.id } })).quantity, 2);
    const reverse = { id: randomUUID(), accounts: [
      { ...input.accounts[0], expectedVersion: 1, guests: 2, items: input.accounts[1].items },
      { ...input.accounts[1], expectedVersion: 1, guests: 0, items: [] },
    ] };
    const saleId = randomUUID();
    const results = await Promise.allSettled([saveAccountBatch(db, reverse), settleTable(db, { id: saleId, tableId: b.id, expectedVersion: 1, payment: "Efectivo" })]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const sold = await db.sale.count({ where: { id: saleId } });
    const remaining = await db.diningTableItem.count({ where: { id: item.id } });
    assert.equal(sold + remaining, 1);
  } finally { await closeDatabases(); }
});
