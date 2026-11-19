import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const employeeId = '550e8400-e29b-41d4-a716-446655440001';
  let counter = null, operationId = '', attempts = 0;
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
  await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
  await page.route('**/api/workspaces/cafe/pos/floor', r => r.fulfill({ json: { version: 1, initialized: true, sectors: [{ id: 'counter', label: 'Mostrador', description: 'Atención rápida', limit: 50, columns: 3, start: 1, minHeight: 186 }], tables: counter ? [{ id: counter.clientKey, area: 'counter', name: 'Mesa 1', x: 0, y: 0, slot: 0, hasAccount: true }] : [] } }));
  await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [{ id: employeeId, legacyId: 1, name: 'Ana', role: 'Mozo' }] }));
  await page.route('**/api/workspaces/cafe/pos/accounts', r => r.fulfill({ json: counter ? [counter] : [] }));
  await page.route('**/api/workspaces/cafe/catalog/products**', r => r.fulfill({ json: { items: [], nextOffset: null } }));
  await page.route('**/api/workspaces/cafe/pos/counter', r => {
    const body = r.request().postDataJSON(); assert.equal(body.employeePin, '1937');
    if (!operationId) operationId = body.id; else assert.equal(body.id, operationId);
    counter = { id: body.id, clientKey: `counter-${body.id}`, version: 0, guests: 1, discount: 0, billRequested: false, operator: { id: employeeId, legacyId: 1, name: 'Ana', active: true }, items: [] };
    attempts++;
    return attempts === 1 ? r.fulfill({ status: 503, json: { error: 'Respuesta interrumpida' } }) : r.fulfill({ json: { clientKey: counter.clientKey, replayed: true } });
  });
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.locator('[data-sector-id="counter"]').hover();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Abrir cuenta de mostrador' });
  await dialog.getByLabel('Responsable').selectOption(employeeId);
  await dialog.getByLabel('Código de cuatro números').fill('1937');
  await dialog.getByRole('button', { name: 'Abrir cuenta', exact: true }).click();
  await dialog.getByRole('button', { name: 'Reintentar apertura' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('1937')), false);
  await dialog.getByRole('button', { name: 'Reintentar apertura' }).click();
  await page.getByRole('dialog', { name: 'Mostrador · Mesa 1' }).waitFor();
  assert.equal(attempts, 2);
  console.log('Mostrador: reintento idempotente y apertura desde el plano OK');
  await context.close();
} finally { await browser.close(); }
