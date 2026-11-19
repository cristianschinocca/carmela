import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let onShift = false, requests = 0;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [{ legacyId: 1, name: 'Ana Pérez', role: 'Mozo', clockedIn: onShift, clockedInAt: onShift ? new Date().toISOString() : null }] }));
    await page.route('**/api/workspaces/cafe/team/attendance/clock', r => {
      requests++;
      assert.equal(r.request().postDataJSON().pin, '1357');
      onShift = true;
      return r.fulfill({ json: { status: 'completed', name: 'Ana Pérez', kind: 'Entrada', at: new Date().toISOString(), replayed: false } });
    });
    await page.goto('http://127.0.0.1:5174/');
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Fichaje', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir fichaje' }).click();
    await page.keyboard.type('1357');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: /Entrada/ }).waitFor();
    assert.equal(requests, 1);
    assert.equal(await page.evaluate(() => JSON.stringify(sessionStorage).includes('1357')), false);
    await page.getByRole('button', { name: 'Listo' }).click();
    await page.getByText('Ana Pérez', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await context.close();
  }
  console.log('Fichaje remoto en escritorio y móvil OK');
} finally { await browser.close(); }
