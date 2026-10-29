import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:5198';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const expected = ['Pastelería', 'Café', 'Panadería', 'Brunch'];

try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: /Categorías/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Categorías' });
  await dialog.getByRole('button', { name: 'Bajar categoría Café' }).click();
  const target = dialog.getByLabel('Nombre de Panadería').locator('..');
  await dialog.getByRole('button', { name: 'Mover categoría Pastelería' }).dragTo(target);
  await dialog.getByRole('button', { name: 'Mover categoría Café' }).focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction((order) => JSON.stringify(JSON.parse(localStorage.getItem('carmela.categories.v1'))) === JSON.stringify(order), expected);
  assert.deepEqual(await dialog.locator('.category-editor-row input').evaluateAll((inputs) => inputs.map((input) => input.value)), expected);

  await dialog.getByLabel('Nueva categoría').fill('Tés');
  await dialog.getByRole('button', { name: 'Crear', exact: true }).click();
  await dialog.getByLabel('Nombre de Tés').fill('Tés variados');
  await dialog.getByRole('button', { name: 'Guardar categoría Tés', exact: true }).click();
  await dialog.getByRole('button', { name: 'Eliminar categoría Tés variados', exact: true }).click();
  await page.waitForFunction((order) => JSON.stringify(JSON.parse(localStorage.getItem('carmela.categories.v1'))) === JSON.stringify(order), expected);

  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByRole('button', { name: /Abrir Mesa 1, libre/ }).click();
  await page.getByRole('button', { name: 'Trabajar como Camila López' }).click();
  await page.getByRole('dialog', { name: '¿Cuántos cubiertos?' }).getByRole('button', { name: 'Abrir mesa', exact: true }).click();
  const posCategories = await page.locator('.pos-categories button').allTextContents();
  assert.deepEqual(posCategories.map((text) => text.trim()), expected);
  assert.equal(await page.locator('.pos-categories button[aria-pressed="true"]').textContent(), expected[0]);

  const menu = await context.newPage();
  await menu.goto(`${base}/#menu`);
  await menu.locator('.menu-toolbar .categories button').first().waitFor();
  assert.deepEqual((await menu.locator('.menu-toolbar .categories button').allTextContents()).map((text) => text.trim()), ['Todos', ...expected]);
  await menu.close();

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base);
  await mobile.locator('.floating-menu').click();
  await mobile.getByRole('button', { name: 'Productos', exact: true }).click();
  await mobile.getByRole('button', { name: /Categorías/ }).click();
  const mobileDialog = mobile.getByRole('dialog', { name: 'Categorías' });
  await mobileDialog.getByRole('button', { name: 'Bajar categoría Pastelería' }).click();
  assert.equal(await mobileDialog.locator('.category-editor-row input').first().inputValue(), 'Café');
  assert.ok(await mobileDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
  console.log('PASS: orden por arrastre y teclado, persistencia, POS, menú público y móvil.');
} finally {
  await browser.close();
}
