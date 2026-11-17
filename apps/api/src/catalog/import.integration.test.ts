import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import { tenantDatabase, closeDatabases } from "@mistro/db/tenant";

const databaseUrl = process.env.TENANT_DB_CATALOG_TEST_URL;
test("importación transaccional conserva IDs y admite reintentos", { skip: !databaseUrl }, async () => {
  if (!databaseUrl) return;
  const { createCatalogRoutes } = await import("./routes.js");
  const db = tenantDatabase("catalog_test");
  const app = express(); app.use(express.json());
  app.use("/:workspaceId/catalog", createCatalogRoutes({
    getSession: async () => ({ user: { id: "test" } }),
    getAccess: async () => ({ db, role: "owner" }),
    allowedOrigin: () => true,
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Servidor no disponible");
  const url = `http://127.0.0.1:${address.port}/test/catalog/import`;
  const key = randomUUID();
  const body = { categories: ["Café"], products: [{ id: 42, name: "Café", category: "Café", description: "", price: 100, image: "", available: true }] };
  const send = (data: unknown, id: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": id }, body: JSON.stringify(data) });
  try {
    assert.equal((await send({ ...body, products: [{ ...body.products[0], price: -1 }] }, key)).status, 400);
    assert.equal(await db.catalogProduct.count(), 0);
    const concurrent = await Promise.all([send(body, key), send(body, key)]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 201]);
    assert.equal((await db.catalogProduct.findFirstOrThrow()).legacyId, 42n);
    assert.equal((await send(body, key)).status, 200);
    assert.equal((await send({ ...body, products: [{ ...body.products[0], price: 200 }] }, key)).status, 409);
    assert.equal((await send(body, randomUUID())).status, 409);
    assert.equal(await db.catalogProduct.count(), 1);
    const product = await db.catalogProduct.findFirstOrThrow();
    const orderUrl = `http://127.0.0.1:${address.port}/test/catalog/order/products`;
    const reorder = (ids: string[]) => fetch(orderUrl, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
    assert.equal((await reorder([randomUUID()])).status, 409);
    assert.equal((await reorder([product.id])).status, 204);
    const category = await db.catalogCategory.findFirstOrThrow();
    const productsUrl = `http://127.0.0.1:${address.port}/test/catalog/products`;
    const data = { name: "Té", categoryId: category.id, description: "", price: 200, image: "", available: true, onlineVisible: true, position: 1 };
    const saved = await fetch(productsUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    assert.equal(saved.status, 201);
    const created = await saved.json() as { id: string; legacyId: number };
    assert.ok(Number.isSafeInteger(created.legacyId));
    const updated = await fetch(`${productsUrl}/${created.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, price: 300 }) });
    assert.equal(updated.status, 200);
    assert.equal((await db.catalogProduct.findUniqueOrThrow({ where: { id: created.id } })).price, 300);
    assert.equal((await fetch(`${productsUrl}/${created.id}`, { method: "DELETE" })).status, 204);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closeDatabases();
  }
});
