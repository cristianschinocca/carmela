import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch();

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => localStorage.setItem('carmela.theme', 'dark'));
    await page.goto(base);
    await page.getByRole('heading', { name: 'Iniciá sesión' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'public');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.getByRole('button', { name: 'Ingresar al panel' }).click();
    await page.getByText('Ingresá tu correo electrónico.').waitFor();
    await page.getByText('Ingresá tu contraseña.').waitFor();
    assert.equal(await page.getByLabel('Correo electrónico').getAttribute('aria-invalid'), 'true');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    assert.equal(await page.getByLabel('Contraseña', { exact: true }).getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();

    await page.getByLabel('Correo electrónico').fill('incorrecto@ejemplo.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
    await page.getByLabel('Contraseña', { exact: true }).press('Enter');
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Contraseña', { exact: true }).getAttribute('aria-describedby'), 'login-error');

    await page.getByRole('button', { name: 'Usar cuenta de prueba' }).click();
    assert.equal(await page.getByLabel('Correo electrónico').inputValue(), 'demo@carmela.app');
    await page.getByRole('alert').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Ingresar al panel' }).click();
    await page.getByRole('heading', { name: 'Un buen día empieza acá.' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await page.reload();
    await page.getByRole('heading', { name: 'Un buen día empieza acá.' }).waitFor();

    if (viewport.width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: /Camila López/ }).first().click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByRole('heading', { name: 'Iniciá sesión' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'public');
    await page.close();
  }

  const publicPage = await browser.newPage();
  await publicPage.goto(`${base}/#menu`);
  await publicPage.locator('.public-menu').waitFor();
  await publicPage.close();
  console.log('Acceso local, cierre de sesión y menú público: OK');
} finally {
  await browser.close();
}
