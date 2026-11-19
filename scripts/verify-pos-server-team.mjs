import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  let attempts = 0;
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
  await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
  await page.route('**/api/workspaces/cafe/pos/floor', r => r.fulfill({ json: { version: 0, initialized: false, sectors: [], tables: [] } }));
  await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [{ legacyId: 1000000000000000, name: 'Ana Pérez', role: 'Mozo', clockedIn: true, clockedInAt: null }] }));
  await page.route('**/api/workspaces/cafe/team/employees/verify-code', r => {
    attempts++;
    const input = r.request().postDataJSON();
    assert.equal(input.employeeId, 1000000000000000);
    return input.pin === '1357' ? r.fulfill({ status: 204 }) : r.fulfill({ status: 400, json: { error: 'Código incorrecto o empleado inactivo.' } });
  });
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.locator('.floor-sector[data-sector-id="salon"]').getByRole('button', { name: /^Abrir Mesa 1,/ }).click();
  await page.getByRole('button', { name: 'Trabajar como Ana Pérez' }).click();
  await page.locator('.covers-modal').getByRole('button', { name: 'Abrir mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar Flat white', exact: true }).click();
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Código de Ana Pérez' });
  await dialog.getByRole('textbox', { name: 'Código de Ana Pérez' }).fill('0000');
  await dialog.getByRole('button', { name: /Confirmar y salir/ }).click();
  await dialog.getByText('Código incorrecto o empleado inactivo.').waitFor();
  await dialog.getByRole('textbox', { name: 'Código de Ana Pérez' }).fill('1357');
  await dialog.getByRole('button', { name: /Confirmar y salir/ }).click();
  await page.getByRole('dialog', { name: /Cuenta de Mesa 1/ }).waitFor({ state: 'detached' });
  assert.equal(attempts, 2);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('1357')), false);
  console.log('POS: selección del equipo y verificación del PIN en el servidor OK');
} finally { await browser.close(); }
