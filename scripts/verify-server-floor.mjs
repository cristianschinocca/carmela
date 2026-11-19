import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  let saved = null, version = 0, firstAttempt = null, failOnce = true;
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test-user', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'test-user', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
  await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
  await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [] }));
  await page.route('**/api/workspaces/cafe/pos/floor', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: saved ? { version, initialized: true, sectors: saved.sectors, tables: saved.tables.map(t => ({ ...t, hasAccount: false })) } : { version: 0, initialized: false, sectors: [], tables: [] } });
    const request = r.request().postDataJSON();
    if (failOnce) { firstAttempt = request; failOnce = false; return r.fulfill({ status: 503, json: { error: 'Conexión interrumpida' } }); }
    assert.deepEqual(request, firstAttempt);
    saved = request; version++;
    return r.fulfill({ json: { version, replayed: false } });
  });
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByText('El plano se guarda por cafetería.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Configurar plano de mesas' }).click();
  await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
  const firstTable = page.getByRole('button', { name: 'Mover Mesa 1, libre' }).first();
  await firstTable.focus();
  await firstTable.press('ArrowRight');
  await page.getByRole('button', { name: 'Configurar plano de mesas' }).click();
  await page.getByRole('button', { name: 'Agregar sector' }).click();
  await page.getByLabel('Nombre del sector').fill('Terraza');
  await page.getByRole('button', { name: 'Crear sector' }).click();
  await page.getByRole('button', { name: 'Terminar edición' }).click();
  await page.getByRole('button', { name: 'Reintentar guardado' }).click();
  await page.getByText('Plano guardado en la cafetería.').waitFor();
  assert.ok(saved.sectors.some(s => s.label === 'Terraza'));
  assert.ok(saved.tables.length > 0);
  assert.equal(saved.tables.find(t => t.area === 'salon' && t.name === 'Mesa 1').slot, 1);
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByText('Terraza', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.unroute('**/api/workspaces');
  await page.route('**/api/workspaces', r => r.abort('internetdisconnected'));
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByText('Terraza', { exact: true }).waitFor();
  await page.getByText('Sin conexión: podés consultar el plano', { exact: false }).waitFor();
  console.log('Plano: guardado, recarga, reintento y lectura sin conexión OK');
  await context.close();
} finally { await browser.close(); }
