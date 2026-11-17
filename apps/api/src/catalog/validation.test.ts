import { strict as assert } from "node:assert";
import { test } from "node:test";
import { categoryInput, importInput, productInput } from "./validation.js";

test("valida productos y descarta importes, categorías e imágenes inválidas", () => {
  const product = { name: " Café ", categoryId: "550e8400-e29b-41d4-a716-446655440000", description: "", price: 2000, image: "", available: true, onlineVisible: true, position: 0 };
  assert.equal(productInput(product)?.name, "Café");
  for (const change of [{ price: -1 }, { price: 1.5 }, { price: 2147483648 }, { categoryId: "otra" }, { image: "javascript:alert(1)" }, { available: "true" }]) {
    assert.equal(productInput({ ...product, ...change }), null);
  }
});

test("la importación exige IDs únicos y categorías válidas", () => {
  const product = { id: 42, name: "Café", category: "Café", description: "", price: 100, image: "", available: true };
  assert.equal(importInput({ categories: ["Café"], products: [product] })?.products[0].legacyId, 42);
  assert.equal(importInput({ categories: ["Café"], products: [product, product] }), null);
  assert.equal(importInput({ categories: ["Café"], products: [{ ...product, category: "Té" }] }), null);
  assert.equal(importInput({ categories: ["Café", "café"], products: [] }), null);
  assert.equal(importInput({ categories: ["Café"], products: [{ ...product, id: 1000000000000000 }] }), null);
});

test("valida nombre y posición de categoría", () => {
  assert.deepEqual(categoryInput({ name: " Café ", position: 0 }), { name: "Café", position: 0 });
  assert.equal(categoryInput({ name: " ", position: 0 }), null);
  assert.equal(categoryInput({ name: "Café", position: -1 }), null);
});
