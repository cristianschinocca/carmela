import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";

process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "a-test-secret-with-more-than-32-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
const { createCatalogRoutes } = await import("./routes.js");
const { centralDb } = await import("@mistro/db/central");

const records: Record<string, Array<{ id: string; name: string; position: number }>> = { a: [], b: [] };
const clients = Object.fromEntries(Object.keys(records).map((key) => [key, {
  catalogCategory: {
    findMany: async () => records[key],
    create: async ({ data }: { data: { name: string; position: number } }) => {
      const row = { id: "550e8400-e29b-41d4-a716-446655440000", ...data };
      records[key].push(row);
      return row;
    },
  },
}]));
let server: Server;
let base: string;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/:workspaceId/catalog", createCatalogRoutes({
    getSession: async (cookie) => cookie ? { user: { id: cookie } } : null,
    getAccess: async (user, workspace) => {
      if (workspace !== user || !(workspace in clients)) return null;
      return { db: clients[workspace], role: "owner" } as unknown as NonNullable<Awaited<ReturnType<typeof import("../db/tenantAccess.js").tenantAccess>>>;
    },
    allowedOrigin: (origin) => origin === "http://localhost:5174",
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Servidor no disponible");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); await centralDb.$disconnect(); });

test("el catálogo exige sesión, membresía y origen autorizado", async () => {
  assert.equal((await fetch(`${base}/a/catalog/categories`)).status, 401);
  assert.equal((await fetch(`${base}/b/catalog/categories`, { headers: { cookie: "a" } })).status, 404);
  assert.equal((await fetch(`${base}/a/catalog/categories`, { method: "POST", headers: { cookie: "a", origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ name: "Café", position: 0 }) })).status, 403);
  const saved = await fetch(`${base}/a/catalog/categories`, { method: "POST", headers: { cookie: "a", origin: "http://localhost:5174", "content-type": "application/json" }, body: JSON.stringify({ name: "Café", position: 0 }) });
  assert.equal(saved.status, 201);
  const other = await fetch(`${base}/b/catalog/categories`, { headers: { cookie: "b" } });
  assert.deepEqual(await other.json(), []);
  const own = await fetch(`${base}/a/catalog/categories`, { headers: { cookie: "a" } });
  assert.equal((await own.json() as unknown[]).length, 1);
  assert.equal(own.headers.get("cache-control"), "no-store");
});
