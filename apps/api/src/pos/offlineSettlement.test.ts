import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { parseRecipeVersions, settleOfflineAccount } from "./offlineSettlement.js";
import { AccountError } from "./account.js";
import { SettlementError } from "./settlement.js";

test("valida identificadores y versiones de recetas", () => {
  const productId = randomUUID(), recipeId = randomUUID();
  assert.ok(parseRecipeVersions([{ productId, recipeId, version: 0 }]));
  assert.ok(parseRecipeVersions([{ productId, recipeId: null, version: null }]));
  assert.equal(parseRecipeVersions([{ productId, recipeId: null, version: 0 }]), null);
  assert.equal(parseRecipeVersions([{ productId, recipeId, version: 0 }, { productId, recipeId, version: 0 }]), null);
});

test("sincroniza cuenta y cobro de forma atómica y sin duplicados", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  try {
    const shift = await db.cashShift.findFirst({ where: { closedAt: null } }) ?? await db.cashShift.create({ data: { id: randomUUID(), openedBy: "test", openingAmount: 0 } });
    const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: "test", pinLookup: randomUUID() } });
    const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
    const product = await db.catalogProduct.create({ data: { name: "Café", price: 1000, categoryId: category.id } });
    const ingredient = await db.inventoryIngredient.create({ data: { name: randomUUID(), unit: "l", quantity: 1, minimum: 0 } });
    const recipe = await db.inventoryRecipe.create({ data: { name: "Café", productId: product.id, ingredients: { create: [{ ingredientId: ingredient.id, unit: "ml", quantity: 200 }] } } });
    const sector = await db.floorSector.create({ data: { name: randomUUID() } });
    const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1 } });
    const account = { id: randomUUID(), tableId: table.id, expectedVersion: 0, guests: 2, billRequested: false, discount: 0, operatorId: employee.id, items: [{ id: randomUUID(), productId: product.id, quantity: 2, unitPrice: 1000, unitDiscount: 0, note: "" }] };
    const payment = { id: randomUUID(), tableId: table.id, expectedVersion: 1, payment: "Efectivo" as const, expectedShiftId: shift.id };
    const verified = { operatorId: employee.id, pinHash: "test" };
    const occurredAt = new Date().toISOString();
    const versions = [{ productId: product.id, recipeId: recipe.id, version: 0 }];
    await assert.rejects(settleOfflineAccount(db, account, { ...payment, expectedShiftId: randomUUID() }, versions, occurredAt, verified), (error) => error instanceof SettlementError && error.reason === "cash");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).version, 0);
    assert.equal(await db.tableAccountOperation.count({ where: { id: account.id } }), 0);
    assert.equal(await db.sale.count({ where: { id: payment.id } }), 0);
    await assert.rejects(settleOfflineAccount(db, account, payment, [{ ...versions[0], version: 1 }], occurredAt, verified), (error) => error instanceof AccountError && error.reason === "version");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).version, 0);
    assert.equal(await db.sale.count({ where: { id: payment.id } }), 0);
    const attempts = await Promise.allSettled([settleOfflineAccount(db, account, payment, versions, occurredAt, verified), settleOfflineAccount(db, account, payment, versions, occurredAt, verified)]);
    assert.ok(attempts.some((result) => result.status === "fulfilled" && result.value.total === "2000"));
    assert.equal((await settleOfflineAccount(db, account, payment, versions, occurredAt, verified)).replayed, true);
    assert.equal(await db.sale.count({ where: { id: payment.id } }), 1);
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: payment.id } })).createdAt.toISOString(), occurredAt);
    await assert.rejects(settleOfflineAccount(db, { ...account, guests: 3 }, payment, versions, occurredAt, verified), (error) => error instanceof AccountError && error.reason === "idempotency");
    assert.equal((await db.inventoryIngredient.findUniqueOrThrow({ where: { id: ingredient.id } })).quantity.toString(), "0.6");
    const second = await db.diningTable.create({ data: { sectorId: sector.id, number: 2 } });
    const excessive = { ...account, id: randomUUID(), tableId: second.id, items: [{ ...account.items[0], id: randomUUID(), quantity: 4 }] };
    const secondPayment = { ...payment, id: randomUUID(), tableId: second.id };
    await assert.rejects(settleOfflineAccount(db, excessive, secondPayment, versions, occurredAt, verified), (error) => error instanceof SettlementError && error.reason === "stock");
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: second.id }, include: { items: true } })).items.length, 0);
    assert.equal(await db.tableAccountOperation.count({ where: { id: excessive.id } }), 0);
    assert.equal(await db.sale.count({ where: { id: secondPayment.id } }), 0);
    await db.inventoryRecipe.update({ where: { id: recipe.id }, data: { version: { increment: 1 } } });
    await assert.rejects(settleOfflineAccount(db, excessive, secondPayment, versions, occurredAt, verified), (error) => error instanceof AccountError && error.reason === "version");
    assert.equal((await settleOfflineAccount(db, account, payment, versions, occurredAt, verified)).replayed, true);
    await db.inventoryRecipe.update({ where: { id: recipe.id }, data: { version: 0 } });
    const other = await db.employee.create({ data: { name: "Luis", role: "Mozo", active: true, pinHash: "other", pinLookup: randomUUID() } });
    await db.diningTable.update({ where: { id: second.id }, data: { operatorId: other.id } });
    await assert.rejects(settleOfflineAccount(db, excessive, secondPayment, versions, occurredAt, verified), (error) => error instanceof AccountError && error.reason === "operator");
    assert.equal(await db.tableAccountOperation.count({ where: { id: excessive.id } }), 0);
  } finally { await closeDatabases(); }
});
