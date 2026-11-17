import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const browser = await chromium.launch();

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/superadmin`);
    await page.getByRole('heading', { name: 'Superadmin' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/superadmin');
    assert.equal(await page.getByRole('button', { name: 'Entrar a administración' }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.context().setOffline(true);
    await page.getByLabel('Correo electrónico').fill('admin@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-de-prueba');
    await page.getByRole('button', { name: 'Entrar a administración' }).click();
    await page.getByText('El acceso de administración requiere conexión a Internet.').waitFor();
    await page.close();
  }

  const page = await browser.newPage();
  await page.goto(base);
  await page.getByRole('link', { name: 'Acceso de administración' }).click();
  await page.getByRole('heading', { name: 'Superadmin' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/superadmin');
  await page.close();
  console.log('Acceso independiente al superadmin: OK');
} finally {
  await browser.close();
}
