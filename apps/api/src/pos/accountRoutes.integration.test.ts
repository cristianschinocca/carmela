import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import { tenantDatabase, closeDatabases } from "@mistro/db/tenant";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-thirty-two-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
process.env.EMPLOYEE_PIN_PEPPER ??= "test-pepper-with-at-least-thirty-two-characters";
const { createPosRoutes } = await import("./routes.js");
const { hashPin, pinLookup } = await import("../team/employee.js");
const { centralDb } = await import("@mistro/db/central");
const key = process.env.POS_EDIT_TEST_DB_KEY;
test("editar exige el PIN del responsable y reintenta sin duplicar", { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: await hashPin("1937"), pinLookup: pinLookup("1937", "cafe") } });
  const other = await db.employee.create({ data: { name: "Luis", role: "Mozo", active: true, pinHash: await hashPin("2846"), pinLookup: pinLookup("2846", "cafe") } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: "Café", price: 1000, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: "Salón" } });
  const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, clientKey: "mesa-1", operatorId: employee.id, guests: 2, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] } } });
  const line = await db.diningTableItem.findFirstOrThrow({ where: { tableId: table.id } });
  const app = express(); app.use(express.json()); app.use('/:workspaceId/pos', createPosRoutes({
    getSession: async (cookie) => cookie ? { user: { id: "owner" } } : null,
    getAccess: async (_user, workspace) => workspace === 'cafe' ? { db, role: 'owner' } as unknown as NonNullable<Awaited<ReturnType<typeof import('../db/tenantAccess.js').tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === 'http://localhost:5174',
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Sin servidor');
  const url = `http://127.0.0.1:${address.port}/cafe/pos/accounts`;
  const body = { id: randomUUID(), tableId: table.id, expectedVersion: 0, guests: 3, billRequested: false, discount: 0, operatorId: employee.id, items: [{ id: line.id, productId: product.id, quantity: 2, unitPrice: 1000, unitDiscount: 0, note: "sin azúcar" }], employeePin: '0000' };
  const send = (value: unknown) => fetch(url, { method: 'PUT', headers: { cookie: 'session', origin: 'http://localhost:5174', 'content-type': 'application/json' }, body: JSON.stringify(value) });
  try {
    assert.equal((await send(body)).status, 400);
    assert.equal((await send({ ...body, operatorId: other.id, employeePin: '2846' })).status, 409);
    assert.equal((await send({ ...body, employeePin: '1937' })).status, 201);
    const replay = await send({ ...body, employeePin: '1937' }); assert.equal(replay.status, 200); assert.equal(((await replay.json()) as { replayed: boolean }).replayed, true);
    assert.equal((await send({ ...body, id: randomUUID(), employeePin: '1937' })).status, 409);
    assert.equal((await db.diningTable.findUniqueOrThrow({ where: { id: table.id } })).version, 1);
    assert.equal((await db.diningTableItem.findUniqueOrThrow({ where: { id: line.id } })).quantity, 2);
    assert.equal(JSON.stringify(await db.tableAccountOperation.findUniqueOrThrow({ where: { id: body.id } })).includes('1937'), false);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await closeDatabases(); await centralDb.$disconnect(); }
});
test("cobro exige el PIN y su conciliación recupera el resultado", { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: await hashPin("5612"), pinLookup: pinLookup("5612", "cafe") } });
  await db.cashShift.create({ data: { id: randomUUID(), openedBy: "owner", openingAmount: 1000 } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: "Café", price: 2000, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: "Salón" } });
  const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, operatorId: employee.id, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 2000 }] } } });
  const app = express(); app.use(express.json()); app.use('/:workspaceId/pos', createPosRoutes({
    getSession: async (cookie) => cookie ? { user: { id: "owner" } } : null,
    getAccess: async (_user, workspace) => workspace === 'cafe' ? { db, role: 'owner' } as unknown as NonNullable<Awaited<ReturnType<typeof import('../db/tenantAccess.js').tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === 'http://localhost:5174',
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Sin servidor');
  const base = `http://127.0.0.1:${address.port}/cafe/pos`;
  const input = { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: 'Efectivo', operatorId: employee.id, employeePin: '0000' };
  const send = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { cookie: 'session', origin: 'http://localhost:5174', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await send('/settlements', input)).status, 400);
    assert.equal((await db.sale.count({ where: { id: input.id } })), 0);
    assert.equal((await send('/settlements', { ...input, employeePin: '5612' })).status, 201);
    assert.equal((await send('/settlements', { ...input, employeePin: '5612' })).status, 200);
    const result = await send('/settlements/reconcile', { id: input.id, tableId: table.id });
    assert.deepEqual(await result.json(), { status: 'completed', total: '2000' });
    assert.equal((await db.cashShift.findFirstOrThrow({ where: { closedAt: null } })).version, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await closeDatabases(); await centralDb.$disconnect(); }
});

test("sincronización offline exige sesión, cafetería, origen y PIN", { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const employee = await db.employee.create({ data: { name: "Ana", role: "Mozo", active: true, pinHash: await hashPin("7135"), pinLookup: pinLookup("7135", "cafe") } });
  const shift = await db.cashShift.findFirst({ where: { closedAt: null } }) ?? await db.cashShift.create({ data: { id: randomUUID(), openedBy: "owner", openingAmount: 0 } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: "Café", price: 2000, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: randomUUID() } });
  const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1 } });
  const account = { id: randomUUID(), tableId: table.id, expectedVersion: 0, operatorId: employee.id, guests: 2, discount: 0, billRequested: false, items: [{ id: randomUUID(), productId: product.id, quantity: 1, unitPrice: 2000, unitDiscount: 0, note: "" }] };
  const settlement = { id: randomUUID(), tableId: table.id, expectedVersion: 1, expectedShiftId: shift.id, payment: "Efectivo" };
  const recipeVersions = [{ productId: product.id, recipeId: null, version: null }];
  const occurredAt = new Date().toISOString();
  const app = express(); app.use(express.json()); app.use('/:workspaceId/pos', createPosRoutes({
    getSession: async (cookie) => cookie ? { user: { id: "owner" } } : null,
    getAccess: async (_user, workspace) => workspace === 'cafe' ? { db, role: 'owner' } as unknown as NonNullable<Awaited<ReturnType<typeof import('../db/tenantAccess.js').tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === 'http://localhost:5174',
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Sin servidor');
  const send = (workspace: string, pin: string, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${address.port}/${workspace}/pos/offline-settlements`, { method: 'POST', headers: { cookie: 'session', origin: 'http://localhost:5174', 'content-type': 'application/json', ...headers }, body: JSON.stringify({ account, settlement, recipeVersions, occurredAt, employeePin: pin }) });
  try {
    assert.equal((await send('cafe', '7135', { cookie: '' })).status, 401);
    assert.equal((await send('otro', '7135')).status, 404);
    assert.equal((await send('cafe', '7135', { origin: 'http://otro.test' })).status, 403);
    assert.equal((await send('cafe', '0000')).status, 400);
    assert.equal(await db.sale.count({ where: { id: settlement.id } }), 0);
    assert.equal((await send('cafe', '7135')).status, 201);
    assert.equal((await send('cafe', '7135')).status, 200);
    assert.equal(await db.sale.count({ where: { id: settlement.id } }), 1);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await closeDatabases(); await centralDb.$disconnect(); }
});
