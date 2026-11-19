import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let registered = null;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/offline-terminal', r => {
      if (r.request().method() === 'POST') {
        registered = r.request().postDataJSON(); assert.match(registered.token, /^[a-f0-9]{64}$/);
        return r.fulfill({ json: { registered: true, isCurrent: true, registeredAt: '2026-01-01T00:00:00Z' } });
      }
      const headers = r.request().headers();
      const isCurrent = !!registered && headers['x-terminal-id'] === registered.deviceId && headers['x-terminal-token'] === registered.token;
      return r.fulfill({ json: { registered: !!registered, isCurrent, registeredAt: registered ? '2026-01-01T00:00:00Z' : null } });
    });
    await page.goto('http://127.0.0.1:5174/');
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    const section = page.getByRole('region', { name: 'Terminal sin conexión' });
    await section.getByText('Sin PC registrada').waitFor();
    await section.getByRole('button', { name: 'Registrar esta PC' }).click();
    await section.getByText('Esta PC está registrada').waitFor();
    await section.getByText(/cobros sin internet.*todavía no están disponibles/i).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.TERMINAL_SCREENSHOT && width === 390) await section.screenshot({ path: process.env.TERMINAL_SCREENSHOT });
    await page.reload();
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await section.getByText('Esta PC está registrada').waitFor();
    await context.close();
  }
  console.log('Configuración: registro, recarga y responsive OK');
} finally { await browser.close(); }
