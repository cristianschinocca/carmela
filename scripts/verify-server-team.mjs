import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(); let employees = []; let lastPut;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/team/employees**', async r => {
      const req = r.request();
      if (req.method() === 'POST') { const { pin, ...body } = req.postDataJSON(); assert.equal(pin, '1357'); employees = [{ id: '550e8400-e29b-41d4-a716-446655440000', legacyId: 1000000000000000, version: 0, ...body }]; return r.fulfill({ status: 201, json: employees[0] }); }
      if (req.method() === 'PUT') { lastPut = req.postDataJSON(); employees = [{ ...employees[0], ...lastPut, version: 1 }]; return r.fulfill({ status: 204 }); }
      return r.fulfill({ json: employees });
    });
    await page.goto('http://127.0.0.1:5174/');
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Equipo', exact: true }).click();
    await page.getByText('Empleados de la cafetería.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Nuevo empleado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
    await dialog.getByLabel('Nombre completo').fill('Ana Pérez');
    await dialog.getByLabel('Código de fichaje').fill('1357');
    await dialog.getByRole('button', { name: 'Crear empleado' }).click();
    await page.getByRole('button', { name: 'Editar Ana Pérez' }).waitFor();
    await page.getByRole('button', { name: 'Editar Ana Pérez' }).click();
    const editor = page.getByRole('dialog', { name: 'Editar empleado' });
    assert.equal(await editor.getByLabel('Código de fichaje').inputValue(), '');
    await editor.getByLabel('Nombre completo').fill('Ana López');
    await editor.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByRole('button', { name: 'Editar Ana López' }).waitFor();
    assert.equal('pin' in lastPut, false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width >= 760) {
      await page.getByRole('button', { name: 'Fichaje', exact: true }).click();
      await page.getByRole('button', { name: 'Datos locales' }).click();
      await page.getByRole('button', { name: 'Abrir fichaje', exact: true }).click();
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('carmela.clock.v1') || '[]').length);
      await page.keyboard.type('4829');
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: /Salida|Entrada/ }).waitFor();
      await page.waitForFunction((count) => JSON.parse(localStorage.getItem('carmela.clock.v1') || '[]').length === count + 1, before);
    }
    await context.close();
  }
  console.log('Equipo: alta y edición sin revelar PIN en escritorio y móvil OK');
} finally { await browser.close(); }
