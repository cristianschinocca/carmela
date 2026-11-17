import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { applyProductStockChange, parseStockChange, StockConflict } from "./productStock.js";

test("valida cantidades enteras y versiones", () => {
  const input = { id: randomUUID(), productId: randomUUID(), kind: "entrada", amount: 10, minimum: 2, enabled: true, expectedVersion: 0, note: "" };
  assert.ok(parseStockChange(input));
  for (const change of [{ amount: -1 }, { amount: 0.5 }, { expectedVersion: -1 }, { productId: "bad" }]) assert.equal(parseStockChange({ ...input, ...change }), null);
});

test("movimientos son atómicos, idempotentes y detectan modificaciones concurrentes", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const category = await db.catalogCategory.create({ data: { name: `test-${randomUUID()}` } });
    const product = await db.catalogProduct.create({ data: { name: "Prueba", price: 100, categoryId: category.id } });
    const base = { id: randomUUID(), productId: product.id, kind: "entrada" as const, amount: 10, minimum: 2, enabled: true, expectedVersion: 0, note: "" };
    const result = await Promise.all([applyProductStockChange(db, base), applyProductStockChange(db, base)]);
    assert.deepEqual(result.map((item) => item.replayed).sort(), [false, true]);
    assert.equal((await db.productStock.findUniqueOrThrow({ where: { productId: product.id } })).quantity, 10);
    await assert.rejects(applyProductStockChange(db, { ...base, amount: 20 }), (error) => error instanceof StockConflict && error.reason === "idempotency");
    const attempts = await Promise.allSettled([applyProductStockChange(db, { ...base, id: randomUUID(), expectedVersion: 1 }), applyProductStockChange(db, { ...base, id: randomUUID(), expectedVersion: 1 })]);
    assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal((await db.productStock.findUniqueOrThrow({ where: { productId: product.id } })).quantity, 20);
    await assert.rejects(applyProductStockChange(db, { ...base, id: randomUUID(), kind: "salida", amount: 21, expectedVersion: 2 }), (error) => error instanceof StockConflict && error.reason === "negative");
    assert.equal(await db.productStockMovement.count({ where: { productId: product.id } }), 2);
  } finally { await closeDatabases(); }
});
