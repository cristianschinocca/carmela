import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inventoryClient } from "../../../web/src/features/inventory/inventoryClient.js";

test("consulta todas las páginas de stock de una cafetería", async () => {
  const previous = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(String(input));
    return new Response(JSON.stringify({ items: [{ productId: String(paths.length) }], nextOffset: paths.length === 1 ? 100 : null }), { status: 200 });
  };
  try {
    assert.equal((await inventoryClient.products("cafe-a")).length, 2);
    assert.deepEqual(paths, ["/api/workspaces/cafe-a/inventory/products?offset=0", "/api/workspaces/cafe-a/inventory/products?offset=100"]);
  } finally { globalThis.fetch = previous; }
});

test("un conflicto del servidor se muestra al llamador", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "El stock cambió" }), { status: 409 });
  try {
    await assert.rejects(inventoryClient.move("cafe-a", { id: "id", productId: "p", kind: "ajuste", amount: 1, minimum: 0, enabled: true, expectedVersion: 0, note: "" }), /El stock cambió/);
  } finally { globalThis.fetch = previous; }
});

test("un conflicto conserva el código HTTP", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "El stock cambió" }), { status: 409 });
  try {
    await assert.rejects(inventoryClient.move("cafe-a", { id: "id", productId: "p", kind: "ajuste", amount: 1, minimum: 0, enabled: true, expectedVersion: 0, note: "" }), (error: unknown) => error instanceof Error && "status" in error && error.status === 409);
  } finally { globalThis.fetch = previous; }
});
