import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { parseSettlement, settleTable, SettlementError } from "./settlement.js";

test("valida los datos del cobro", () => {
  const request = { id: randomUUID(), tableId: randomUUID(), expectedVersion: 0, payment: "Efectivo" };
  assert.ok(parseSettlement(request));
  assert.equal(parseSettlement({ ...request, payment: "Otro" }), null);
  assert.equal(parseSettlement({ ...request, expectedVersion: -1 }), null);
});

test("cobra una sola vez y descuenta insumos compartidos y stock en una transacción", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { name: "Sándwich", price: 1000, categoryId: category.id } });
    const product2 = await db.catalogProduct.create({ data: { name: "Tostado", price: 1500, categoryId: category.id } });
    const ingredient = await db.inventoryIngredient.create({ data: { name: randomUUID(), unit: "kg", quantity: 1, minimum: 0 } });
    await db.inventoryRecipe.create({ data: { name: "Uno", productId: product.id, ingredients: { create: [{ ingredientId: ingredient.id, quantity: 200, unit: "g" }] } } });
    await db.inventoryRecipe.create({ data: { name: "Dos", productId: product2.id, ingredients: { create: [{ ingredientId: ingredient.id, quantity: 300, unit: "g" }] } } });
    await db.productStock.create({ data: { productId: product.id, quantity: 10, minimum: 0, enabled: true } });
    const sector = await db.floorSector.create({ data: { name: "Salón" } });
    const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, guests: 2, discount: 100, items: { create: [{ productId: product.id, quantity: 2, unitPrice: 1000 }, { productId: product2.id, quantity: 1, unitPrice: 1500 }] } } });
    const request = { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: "Efectivo" as const };
    const result = await settleTable(db, request);
    assert.equal(result.total, "3400");
    assert.equal((await db.inventoryIngredient.findUniqueOrThrow({ where: { id: ingredient.id } })).quantity.toString(), "0.3");
    assert.equal((await db.productStock.findUniqueOrThrow({ where: { productId: product.id } })).quantity, 8);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id }, include: { items: true } })).items.length, 0);
    assert.equal((await settleTable(db, request)).replayed, true);
    await assert.rejects(settleTable(db, { ...request, payment: "Tarjeta" }), (error) => error instanceof SettlementError && error.reason === "idempotency");
    const second = await db.diningTable.create({ data: { sectorId: sector.id, number: 2, items: { create: [{ productId: product2.id, quantity: 2, unitPrice: 1500 }] } } });
    await assert.rejects(settleTable(db, { ...request, id: randomUUID(), tableId: second.id }), (error) => error instanceof SettlementError && error.reason === "stock");
    assert.equal((await db.inventoryIngredient.findUniqueOrThrow({ where: { id: ingredient.id } })).quantity.toString(), "0.3");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: second.id }, include: { items: true } })).items.length, 1);
    assert.equal(await db.sale.count({ where: { id: request.id } }), 1);
  } finally { await closeDatabases(); }
});

test("dos mesas no pueden consumir simultáneamente el mismo stock", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { name: "Producto", price: 500, categoryId: category.id } });
    const ingredient = await db.inventoryIngredient.create({ data: { name: randomUUID(), unit: "kg", quantity: 0.3, minimum: 0 } });
    await db.inventoryRecipe.create({ data: { name: "Prueba", productId: product.id, ingredients: { create: [{ ingredientId: ingredient.id, quantity: 300, unit: "g" }] } } });
    const sector = await db.floorSector.create({ data: { name: "Salón" } });
    const tables = await Promise.all([1, 2].map((number) => db.diningTable.create({ data: { sectorId: sector.id, number, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 500 }] } } })));
    const results = await Promise.allSettled(tables.map((table) => settleTable(db, { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: "Efectivo" })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await db.inventoryIngredient.findUniqueOrThrow({ where: { id: ingredient.id } })).quantity.toString(), "0");
    assert.equal(await db.diningTableItem.count({ where: { tableId: { in: tables.map((table) => table.id) } } }), 1);
  } finally { await closeDatabases(); }
});

test("el reintento simultáneo de un cobro no duplica la venta", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { name: "Producto", price: 500, categoryId: category.id } });
    const sector = await db.floorSector.create({ data: { name: "Salón" } });
    const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 500 }] } } });
    const input = { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: "Efectivo" as const };
    const results = await Promise.allSettled([settleTable(db, input), settleTable(db, input)]);
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.equal(await db.sale.count({ where: { id: input.id } }), 1);
    assert.equal((await settleTable(db, input)).replayed, true);
  } finally { await closeDatabases(); }
});
