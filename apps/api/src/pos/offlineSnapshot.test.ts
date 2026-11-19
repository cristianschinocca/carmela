import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { readOfflineInventory } from "./offlineSnapshot.js";

test("la copia separa caja, stock y cantidades exactas de recetas", { skip: !process.env.TENANT_DB_OFFLINE_TEST_URL }, async () => {
  const db = tenantDatabase("offline_test");
  const shift = await db.cashShift.create({ data: { id: randomUUID(), openingAmount: 5000n, openedBy: "owner" } });
  await db.cashMovement.create({ data: { id: randomUUID(), shiftId: shift.id, kind: "gasto", direction: "out", amount: 500n, payment: "Efectivo", concept: "Insumos", party: "", receipt: "", createdBy: "owner" } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: "Tostado", categoryId: category.id, price: 2300 } });
  await db.productStock.create({ data: { productId: product.id, enabled: true, quantity: 3 } });
  const ingredient = await db.inventoryIngredient.create({ data: { name: randomUUID(), unit: "kg", quantity: "0.6", minimum: 0 } });
  await db.inventoryRecipe.create({ data: { name: "Tostado", productId: product.id, ingredients: { create: { ingredientId: ingredient.id, quantity: "200", unit: "g" } } } });
  await db.sale.create({ data: { id: randomUUID(), tableId: randomUUID(), tableName: "Mesa 1", payloadHash: "x".repeat(64), guests: 1, subtotal: 2300n, discount: 0n, total: 2300n, payment: "Efectivo", cashShiftId: shift.id, items: [] } });
  const data = await readOfflineInventory(db);
  assert.deepEqual(data.cash, { id: shift.id, version: 0, expectedAmount: "6800" });
  assert.equal(data.ingredients[0].quantity, "0.6");
  assert.equal(data.recipes[0].ingredients[0].quantity, "200");
  assert.equal(data.recipes[0].ingredients[0].unit, "g");
  assert.equal(data.productStock[0].quantity, 3);
  assert.equal(JSON.stringify(data).includes("owner"), false);
});
after(async () => { await closeDatabases(); });
