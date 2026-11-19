import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
process.env.CONTROL_DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';
process.env.BETTER_AUTH_SECRET ??= 'a-test-secret-with-more-than-32-characters';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5174';
const { createCashRoutes } = await import('./routes.js');
const { centralDb } = await import('@mistro/db/central');
let server: Server, base: string;
before(async () => {
  const app = express(); app.use(express.json());
  app.use('/:workspaceId/cash', createCashRoutes({
    getSession: async (cookie) => cookie ? { user: { id: cookie } } : null,
    getAccess: async (user, workspace) => workspace === user ? { db: { cashShift: { findFirst: async () => ({ id: '550e8400-e29b-41d4-a716-446655440005' }) } }, role: user === 'owner' ? 'owner' : 'member' } as unknown as NonNullable<Awaited<ReturnType<typeof import('../db/tenantAccess.js').tenantAccess>>> : null,
    allowedOrigin: (origin) => origin === 'http://localhost:5174',
  }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Sin servidor'); base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await centralDb.$disconnect(); });
test('caja exige sesión, cafetería, dueño y origen confiable', async () => {
  const path = `${base}/owner/cash/operations`, body = JSON.stringify({ id: randomUUID(), action: 'open', openingAmount: 0 });
  assert.equal((await fetch(path, { method: 'POST', headers: { origin: 'http://localhost:5174', 'content-type': 'application/json' }, body })).status, 401);
  assert.equal((await fetch(path, { method: 'POST', headers: { cookie: 'owner', origin: 'https://evil.example', 'content-type': 'application/json' }, body })).status, 403);
  assert.equal((await fetch(`${base}/other/cash/current`, { headers: { cookie: 'owner' } })).status, 404);
  assert.equal((await fetch(`${base}/member/cash/current`, { headers: { cookie: 'member' } })).status, 403);
  assert.equal((await fetch(`${base}/owner/cash/active`)).status, 401);
  assert.equal((await fetch(`${base}/other/cash/active`, { headers: { cookie: 'owner' } })).status, 404);
  assert.equal((await fetch(`${base}/member/cash/active`, { headers: { cookie: 'member' } })).status, 403);
  const active = await fetch(`${base}/owner/cash/active`, { headers: { cookie: 'owner' } });
  assert.equal(active.status, 200); assert.equal(active.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await active.json(), { id: '550e8400-e29b-41d4-a716-446655440005' });
});
test('no permite cerrar sin integrar los cobros del POS', async () => {
  const body = JSON.stringify({ id: randomUUID(), action: 'close', shiftId: randomUUID(), expectedVersion: 0, countedAmount: 0, differenceReason: '' });
  const response = await fetch(`${base}/owner/cash/operations`, { method: 'POST', headers: { cookie: 'owner', origin: 'http://localhost:5174', 'content-type': 'application/json' }, body });
  assert.equal(response.status, 409);
});
