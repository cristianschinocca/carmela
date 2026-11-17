import { strict as assert } from "node:assert";
import { test } from "node:test";
import { catalogClient } from "../../../web/src/features/catalog/catalogClient.js";

test("el cliente consulta todas las páginas del catálogo de la cafetería solicitada", async () => {
  const previous = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(String(input));
    const first = paths.length === 1;
    return new Response(JSON.stringify({ items: [{ id: first ? "a" : "b" }], nextOffset: first ? 100 : null }), { status: 200 });
  };
  try {
    const products = await catalogClient.products("cafe-a");
    assert.equal(products.length, 2);
    assert.deepEqual(paths, ["/api/workspaces/cafe-a/catalog/products?offset=0", "/api/workspaces/cafe-a/catalog/products?offset=100"]);
  } finally { globalThis.fetch = previous; }
});

test("el cliente informa el rechazo del servidor", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Sin acceso" }), { status: 403 });
  try { await assert.rejects(catalogClient.categories("cafe-a"), /Sin acceso/); }
  finally { globalThis.fetch = previous; }
});
