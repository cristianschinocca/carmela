import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "a-test-secret-with-more-than-32-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
const { createTeamRoutes } = await import("./routes.js");
const { centralDb } = await import("@mistro/db/central");
const db = { employee: { findMany: async () => [] } };
let server: Server; let base: string;
before(async () => {
  const app = express(); app.use(express.json());
  app.use("/:workspaceId/team", createTeamRoutes({
    getSession: async (cookie) => cookie ? { user: { id: cookie } } : null,
    getAccess: async (user, workspace) => workspace === user ? { db, role: user === "owner" ? "owner" : "member" } as unknown as NonNullable<Awaited<ReturnType<typeof import("../db/tenantAccess.js").tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === "http://localhost:5174",
  }));
  server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Servidor no disponible"); base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await centralDb.$disconnect(); });
test("solo el dueño de la cafetería puede consultar y modificar empleados", async () => {
  assert.equal((await fetch(`${base}/owner/team/employees`)).status, 401);
  assert.equal((await fetch(`${base}/other/team/employees`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/team/employees`, { headers: { cookie: "member" } })).status, 403);
  assert.equal((await fetch(`${base}/owner/team/employees`, { method: "POST", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status, 403);
  const response = await fetch(`${base}/owner/team/employees`, { headers: { cookie: "owner" } });
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
});
test("fichaje exige dueño y origen autorizado", async () => {
  assert.equal((await fetch(`${base}/owner/team/attendance/status`)).status, 401);
  assert.equal((await fetch(`${base}/other/team/attendance/status`, { headers: { cookie: "owner" } })).status, 404);
  assert.equal((await fetch(`${base}/member/team/attendance/status`, { headers: { cookie: "member" } })).status, 403);
  assert.equal((await fetch(`${base}/owner/team/attendance/clock`, { method: "POST", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status, 403);
  const response = await fetch(`${base}/owner/team/attendance/status`, { headers: { cookie: "owner" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("la verificación del código exige sesión, cafetería y origen autorizado", async () => {
  const path = `${base}/owner/team/employees/verify-code`;
  const data = JSON.stringify({ employeeId: 1, pin: "1234" });
  assert.equal((await fetch(path, { method: "POST", headers: { origin: "http://localhost:5174", "content-type": "application/json" }, body: data })).status, 401);
  assert.equal((await fetch(path, { method: "POST", headers: { cookie: "owner", origin: "https://evil.example", "content-type": "application/json" }, body: data })).status, 403);
  assert.equal((await fetch(`${base}/other/team/employees/verify-code`, { method: "POST", headers: { cookie: "owner", origin: "http://localhost:5174", "content-type": "application/json" }, body: data })).status, 404);
  assert.equal((await fetch(`${base}/member/team/employees/verify-code`, { method: "POST", headers: { cookie: "member", origin: "http://localhost:5174", "content-type": "application/json" }, body: data })).status, 403);
});
