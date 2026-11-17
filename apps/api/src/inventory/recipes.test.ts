import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compatibleUnits, parseIngredient, parseRecipe } from "./recipes.js";
const id = "550e8400-e29b-41d4-a716-446655440000";
test("valida cantidades, unidades y relaciones duplicadas", () => {
  assert.ok(parseIngredient({ name: "Jamón", unit: "kg", quantity: 10, minimum: 2 }));
  assert.equal(parseIngredient({ name: "Jamón", unit: "kg", quantity: -1, minimum: 2 }), null);
  assert.equal(parseIngredient({ name: "Jamón", unit: "kg", quantity: 0.0000001, minimum: 2 }), null);
  assert.ok(parseRecipe({ name: "Sándwich", productId: id, ingredients: [{ ingredientId: id, quantity: 200, unit: "g" }] }));
  assert.equal(parseRecipe({ name: "Sándwich", productId: id, ingredients: [{ ingredientId: id, quantity: 1, unit: "g" }, { ingredientId: id, quantity: 1, unit: "g" }] }), null);
  assert.equal(compatibleUnits("kg", "g"), true);
  assert.equal(compatibleUnits("kg", "ml"), false);
});

test("las relaciones de receta protegen productos e insumos", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const { randomUUID } = await import("node:crypto");
  const { tenantDatabase, closeDatabases } = await import("@mistro/db/tenant");
  const db = tenantDatabase("catalog_test");
  try {
    const category = await db.catalogCategory.create({ data: { name: `prueba-${randomUUID()}` } });
    const product = await db.catalogProduct.create({ data: { categoryId: category.id, name: "Prueba", price: 1 } });
    const ingredient = await db.inventoryIngredient.create({ data: { name: `jamón-${randomUUID()}`, unit: "kg", quantity: 10, minimum: 2 } });
    const recipe = await db.inventoryRecipe.create({ data: { name: "Prueba", productId: product.id, ingredients: { create: [{ ingredientId: ingredient.id, quantity: 200, unit: "g" }] } }, include: { ingredients: true } });
    assert.equal(recipe.ingredients[0].quantity.toString(), "200");
    await assert.rejects(db.inventoryIngredient.delete({ where: { id: ingredient.id } }));
    await assert.rejects(db.catalogProduct.delete({ where: { id: product.id } }));
    await db.inventoryRecipe.delete({ where: { id: recipe.id } });
    await db.inventoryIngredient.delete({ where: { id: ingredient.id } });
    await db.catalogProduct.delete({ where: { id: product.id } });
    await db.catalogCategory.delete({ where: { id: category.id } });
  } finally { await closeDatabases(); }
});
