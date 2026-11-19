import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-thirty-two-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
const { createTerminalRoutes } = await import("./routes.js");
const { centralDb } = await import("@mistro/db/central");
let server: Server, base: string;
before(async () => {
  const app = express(); app.use(express.json());
  app.use("/:workspaceId/terminal", createTerminalRoutes({
    getSession: async (cookie) => cookie ? { user: { id: cookie } } : null,
    getAccess: async (user, workspace) => workspace === user ? { db: {}, role: user === "owner" ? "owner" : "member" } as unknown as NonNullable<Awaited<ReturnType<typeof import("../db/tenantAccess.js").tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === "http://localhost:5174",
  }));
  server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Sin servidor"); base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await centralDb.$disconnect(); });
test("requiere sesión, propietario, cafetería y origen autorizado", async () => {
  assert.equal((await fetch(`${base}/owner/terminal`)).status, 401);
  assert.equal((await fetch(`${base}/other/terminal`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/terminal`, { headers: { cookie: "member" } })).status, 403);
  assert.equal((await fetch(`${base}/owner/terminal`, { method: "POST", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/owner/terminal`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: "{}" })).status, 400);
});
