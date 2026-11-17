import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let categories = [], products = [], failNext = false;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/catalog/**', async r => {
      const url = new URL(r.request().url()); const method = r.request().method();
      if (url.pathname.endsWith('/categories')) {
        if (method === 'POST') { categories.push({ id: '550e8400-e29b-41d4-a716-446655440000', ...r.request().postDataJSON() }); return r.fulfill({ status: 201, json: categories[0] }); }
        return r.fulfill({ json: categories });
      }
      if (url.pathname.endsWith('/products')) {
        if (method === 'POST') { if (failNext) return r.fulfill({ status: 409, json: { error: 'No se guardó' } }); products.push({ id: '550e8400-e29b-41d4-a716-446655440001', legacyId: 1000000000000000, ...r.request().postDataJSON() }); return r.fulfill({ status: 201, json: products[0] }); }
        return r.fulfill({ json: { items: products, nextOffset: null } });
      }
      return r.fulfill({ status: 404, json: { error: 'No encontrado' } });
    });
    await page.goto('http://127.0.0.1:5174/');
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Productos', exact: true }).click();
    await page.getByText('El punto de venta, el stock y el menú digital todavía usan datos locales.', { exact: false }).waitFor();
    await page.getByRole('button', { name: /Categorías/ }).click();
    await page.getByLabel('Nueva categoría').fill('Café');
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.getByText('Categoría creada.').waitFor();
    await page.getByRole('button', { name: 'Cerrar categorías' }).click();
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo producto' });
    await dialog.locator('input').first().fill('Flat white');
    await dialog.locator('input[type=number]').first().fill('4000');
    await dialog.locator('textarea').fill('Café con leche.');
    await dialog.getByRole('button', { name: 'Crear producto' }).click();
    await page.getByText('Flat white', { exact: true }).first().waitFor();
    assert.equal(products.length, 1);
    assert.equal(products[0].price, 4000);
    failNext = true;
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    const retryDialog = page.getByRole('dialog', { name: 'Nuevo producto' });
    await retryDialog.locator('input').first().fill('Té');
    await retryDialog.locator('input[type=number]').first().fill('1000');
    await retryDialog.locator('textarea').fill('Té caliente.');
    await retryDialog.getByRole('button', { name: 'Crear producto' }).click();
    await page.getByRole('alert').filter({ hasText: 'No se guardó' }).waitFor();
    assert.equal(products.length, 1);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByText('Flat white', { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await context.close();
  }
  console.log('Productos: alta remota en escritorio y móvil OK');
} finally { await browser.close(); }
