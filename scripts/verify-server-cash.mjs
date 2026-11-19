import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let shift = null, calls = 0, pendingId = null;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/team/employees', r => r.fulfill({ json: [{ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana', active: true }] }));
    await page.route('**/api/workspaces/cafe/cash/current', r => r.fulfill({ json: shift }));
    await page.route('**/api/workspaces/cafe/cash/operations', r => {
      calls++; const op = r.request().postDataJSON();
      if (op.action === 'open') shift = { id: op.id, version: 0, openingAmount: String(op.openingAmount), expectedAmount: String(op.openingAmount), movements: [] };
      if (op.action === 'record') { if (pendingId) { assert.equal(op.id, pendingId); } else { pendingId = op.id; shift = { ...shift, version: 1, expectedAmount: String(Number(shift.openingAmount) - op.movement.amount), movements: [{ ...op.movement, id: op.movementId, version: 0, amount: String(op.movement.amount), employeeId: null, employeePayment: null, voidedAt: null, createdAt: new Date().toISOString() }] }; return r.fulfill({ status: 503, json: { error: 'Conexión interrumpida' } }); } }
      return r.fulfill({ json: { shiftId: shift.id, version: shift.version, replayed: false } });
    });
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('button', { name: /Gestionar caja/ }).click();
    const modal = page.getByRole('dialog', { name: 'Caja', exact: true });
    await modal.getByLabel('Fondo inicial en efectivo').fill('10000');
    await modal.getByRole('button', { name: 'Abrir caja' }).click();
    await modal.getByRole('button', { name: 'Gasto vario' }).click();
    await modal.getByLabel('Concepto').fill('Compra de café');
    await modal.getByLabel('Importe').fill('2000');
    await modal.getByRole('button', { name: 'Guardar movimiento' }).click();
    await modal.getByRole('button', { name: 'Reintentar' }).click();
    await modal.getByText('Gasto vario · Compra de café').waitFor();
    assert.equal(calls, 3);
    assert.equal(shift.movements.length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await context.close();
  }
  console.log('Caja: apertura y movimientos por cafetería en escritorio y móvil OK');
} finally { await browser.close(); }
