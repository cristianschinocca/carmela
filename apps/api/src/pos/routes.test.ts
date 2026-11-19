import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "a-test-secret-with-more-than-32-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
const { createPosRoutes } = await import("./routes.js");
const { centralDb } = await import("@mistro/db/central");
const fakeDb = { floorSector: { findMany: async () => [{ name: "Salón" }] }, diningTable: { findMany: async () => [] } };
let server: Server;
let base: string;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/:workspaceId/pos", createPosRoutes({
    getSession: async (cookie) => cookie ? { user: { id: cookie } } : null,
    getAccess: async (user, workspace) => workspace === user ? { db: fakeDb, role: user === "owner" ? "owner" : "member" } as unknown as NonNullable<Awaited<ReturnType<typeof import("../db/tenantAccess.js").tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === "http://localhost:5174",
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Servidor no disponible");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await centralDb.$disconnect(); });
test("el POS valida sesión, cafetería, permisos y origen", async () => {
  assert.equal((await fetch(`${base}/owner/pos/tables`)).status, 401);
  assert.equal((await fetch(`${base}/owner/pos/floor`)).status, 401);
  assert.equal((await fetch(`${base}/owner/pos/accounts`)).status, 401);
  assert.equal((await fetch(`${base}/owner/pos/offline-snapshot`)).status, 401);
  assert.equal((await fetch(`${base}/otro/pos/offline-snapshot`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/pos/offline-snapshot`, { headers: { cookie: "member" } })).status, 403);
  assert.equal((await fetch(`${base}/otro/pos/accounts`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/pos/accounts`, { headers: { cookie: "member" } })).status, 403);
  assert.equal((await fetch(`${base}/otro/pos/floor`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/pos/floor`, { method: "PUT", headers: { cookie: "member", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/otro/pos/tables`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/owner/pos/accounts`, { method: "PUT", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/member/pos/accounts`, { method: "PUT", headers: { cookie: "member", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/member/pos/account-transfers`, { method: "PUT", headers: { cookie: "member", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/otro/pos/account-transfers`, { method: "PUT", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 404);
  assert.equal((await fetch(`${base}/member/pos/counter`, { method: "POST", headers: { cookie: "member", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/otro/pos/counter`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 404);
  assert.equal((await fetch(`${base}/owner/pos/counter`, { method: "POST", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/owner/pos/counter`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 400);
  const noPaymentPin = { id: "550e8400-e29b-41d4-a716-446655440010", tableId: "550e8400-e29b-41d4-a716-446655440011", expectedVersion: 0, payment: "Efectivo", operatorId: "550e8400-e29b-41d4-a716-446655440012" };
  assert.equal((await fetch(`${base}/owner/pos/settlements`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: JSON.stringify(noPaymentPin) })).status, 400);
  assert.equal((await fetch(`${base}/otro/pos/settlements/reconcile`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: JSON.stringify({ id: noPaymentPin.id, tableId: noPaymentPin.tableId }) })).status, 404);
  const noPin = { id: "550e8400-e29b-41d4-a716-446655440000", tableId: "550e8400-e29b-41d4-a716-446655440001", expectedVersion: 0, guests: 2, billRequested: false, discount: 0, operatorId: "550e8400-e29b-41d4-a716-446655440002", items: [] };
  assert.equal((await fetch(`${base}/owner/pos/accounts`, { method: "PUT", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: JSON.stringify(noPin) })).status, 400);
  const accounts = await fetch(`${base}/owner/pos/accounts`, { headers: { cookie: "owner" } });
  assert.equal(accounts.status, 200); assert.equal(accounts.headers.get("cache-control"), "no-store"); assert.deepEqual(await accounts.json(), []);
  const response = await fetch(`${base}/owner/pos/tables`, { headers: { cookie: "owner" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
