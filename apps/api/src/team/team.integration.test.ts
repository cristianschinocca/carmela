import { strict as assert } from "node:assert";
import { test } from "node:test";
import express from "express";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "a-test-secret-with-more-than-32-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
process.env.EMPLOYEE_PIN_PEPPER ??= "a-distinct-test-pepper-with-more-than-32-characters";
const { createTeamRoutes } = await import("./routes.js");
const { centralDb } = await import("@mistro/db/central");

test("guarda equipo sin revelar PIN y detecta duplicados y conflictos", { skip: !process.env.TENANT_DB_CATALOG_TEST_URL }, async () => {
  const db = tenantDatabase("catalog_test");
  const app = express(); app.use(express.json());
  app.use("/:workspaceId/team", createTeamRoutes({ getSession: async () => ({ user: { id: "owner" } }), getAccess: async (_user, workspace) => workspace === "cafe" ? { db, role: "owner" } : null, allowedOrigin: () => true }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Servidor no disponible");
  const base = `http://127.0.0.1:${address.port}/cafe/team/employees`;
  const write = (path: string, method: string, body: unknown) => fetch(base + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    const data = { name: "Ana Pérez", role: "Mozo", active: true, pin: "1234", pay: { basis: "hour", rate: 2000, schedule: [{ day: 1, start: "08:00", end: "16:00" }] } };
    const created = await write("", "POST", data); assert.equal(created.status, 201);
    const employee = await created.json() as { id: string; version: number; [key: string]: unknown };
    assert.equal("pin" in employee || "pinHash" in employee || "pinLookup" in employee, false);
    const stored = await db.employee.findUniqueOrThrow({ where: { id: employee.id } });
    assert.notEqual(stored.pinHash, data.pin); assert.notEqual(stored.pinLookup, data.pin);
    assert.equal((await write("", "POST", { ...data, name: "Otra persona" })).status, 409);
    const { pin: _pin, ...withoutPin } = data;
    assert.equal((await write(`/${employee.id}`, "PUT", { ...withoutPin, name: "Ana López", version: 0 })).status, 204);
    assert.equal((await db.employee.findUniqueOrThrow({ where: { id: employee.id } })).pinHash, stored.pinHash);
    assert.equal((await write(`/${employee.id}`, "PUT", { ...withoutPin, version: 0 })).status, 409);
    const listed = await (await fetch(base)).json() as Array<Record<string, unknown>>;
    assert.equal(listed.length, 1); assert.equal("pinHash" in listed[0] || "pinLookup" in listed[0], false);
    assert.equal((await write(`/${employee.id}`, "DELETE", { version: 1 })).status, 204);
    assert.equal((await (await fetch(base)).json() as unknown[]).length, 0);
    assert.equal((await db.employee.findUniqueOrThrow({ where: { id: employee.id } })).pinHash, "archived");
    assert.equal((await write("", "POST", { ...data, name: "Nuevo empleado" })).status, 201);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await closeDatabases(); await centralDb.$disconnect(); }
});
