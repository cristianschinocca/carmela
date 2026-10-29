import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:5198';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 900 }, reducedMotion: 'reduce' });
const floor = () => page.evaluate(() => JSON.parse(localStorage.getItem('carmela.pos.floor.v2')));

async function openCounter() {
  const counter = page.locator('[data-sector-id="counter"]');
  await page.mouse.move(1, 1);
  await counter.hover();
  await counter.locator('.floor-enter-hint').waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Trabajar como Camila López' }).click();
  await page.locator('.covers-modal').getByRole('button', { name: 'Abrir mesa', exact: true }).click();
  const account = page.getByRole('dialog', { name: /Cuenta de Mesa/ });
  await account.getByRole('button', { name: 'Agregar Flat white', exact: true }).click();
  await account.getByRole('button', { name: 'Cerrar cuenta' }).click();
  const pin = page.getByRole('dialog', { name: 'Código de Camila López' });
  await pin.getByRole('textbox', { name: 'Código de Camila López' }).fill('4829');
  await pin.getByRole('button', { name: 'Confirmar y salir' }).click();
  await account.waitFor({ state: 'detached' });
}

try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem('carmela.pos.floor.v2'));
  await page.evaluate(() => {
    const key = 'carmela.pos.floor.v2';
    const tables = JSON.parse(localStorage.getItem(key)).filter((table) => table.area !== 'counter');
    for (let index = 0; index < 8; index++) tables.push({
      id: `legacy-counter-${index}`, name: `Mesa ${60 + index}`, area: 'counter', guests: 2,
      items: index < 5 ? [{ id: `legacy-line-${index}`, productId: 1, quantity: 1, note: 'Conservar' }] : [],
      discount: 0, billRequested: false, operatorId: index < 5 ? 1 : undefined,
      counterTurnNumber: index < 5 ? index + 1 : undefined, slot: index, x: 93, y: 58 + index * 56,
    });
    localStorage.setItem(key, JSON.stringify(tables));
    localStorage.setItem('carmela.pos.counter.sequence.v1', '5');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  let counter = page.locator('[data-sector-id="counter"]');
  await counter.getByText('5/50 abiertas').waitFor();
  await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
  assert.equal(await counter.locator('.floor-table').count(), 5);
  await page.getByRole('button', { name: 'Terminar edición', exact: true }).click();
  await page.mouse.move(1, 1);
  await counter.hover();
  await counter.locator('.floor-enter-hint').waitFor();
  await page.keyboard.press('Enter');
  const employeePicker = page.getByRole('dialog', { name: '¿Quién va a gestionar esta mesa?' });
  await employeePicker.waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await employeePicker.getByRole('button', { name: 'Trabajar como Camila López' }).waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('carmela.pos.floor.v2')).filter((table) => table.area === 'counter').length === 6);
  await page.keyboard.press('Escape');
  await employeePicker.waitFor({ state: 'detached' });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('carmela.pos.floor.v2')).filter((table) => table.area === 'counter').length === 5);
  await counter.locator('.floor-enter-hint').waitFor();
  await page.keyboard.press('Enter');
  await employeePicker.waitFor();
  await employeePicker.getByRole('button', { name: 'Trabajar como Camila López' }).focus();
  await page.keyboard.press('Enter');
  const covers = page.getByRole('dialog', { name: '¿Cuántos cubiertos?' });
  await covers.waitFor();
  await page.keyboard.press('Escape');
  await employeePicker.waitFor();
  await page.keyboard.press('Escape');
  await employeePicker.waitFor({ state: 'detached' });
  await counter.locator('.floor-enter-hint').waitFor();
  await page.keyboard.press('Enter');
  await employeePicker.waitFor();
  await employeePicker.getByRole('button', { name: 'Trabajar como Camila López' }).focus();
  await page.keyboard.press('Enter');
  await covers.waitFor();
  await covers.getByRole('spinbutton', { name: 'Cantidad de cubiertos' }).focus();
  await page.keyboard.press('Enter');
  const emptyAccount = page.getByRole('dialog', { name: /Cuenta de Mesa/ });
  await emptyAccount.waitFor();
  await page.keyboard.press('Escape');
  await emptyAccount.waitFor({ state: 'detached' });
  await counter.locator('.floor-enter-hint').waitFor();
  await page.keyboard.press('Enter');
  await employeePicker.waitFor();
  await page.mouse.move(1, 1);
  await page.keyboard.press('Escape');
  await employeePicker.waitFor({ state: 'detached' });
  assert.equal(await counter.locator('.floor-enter-hint').count(), 0);
  await page.keyboard.press('Enter');
  assert.equal(await employeePicker.count(), 0);
  const nextCounterNumber = await page.evaluate(() => Number(localStorage.getItem('carmela.pos.counter.sequence.v1')) + 1);
  await openCounter();
  await counter.getByText('6/50 abiertas').waitFor();
  let counters = (await floor()).filter((table) => table.area === 'counter');
  assert.equal(counters.length, 6);
  assert.equal(counters.filter((table) => table.items[0]?.note === 'Conservar').length, 5);
  assert.ok(counters.some((table) => table.counterTurnNumber === nextCounterNumber));

  await page.evaluate(() => {
    const key = 'carmela.pos.floor.v2';
    const tables = JSON.parse(localStorage.getItem(key)).filter((table) => table.area !== 'counter');
    for (let index = 0; index < 49; index++) tables.push({
      id: `counter-test-${index}`, name: 'Mostrador', area: 'counter', guests: 2,
      items: [{ id: `counter-line-${index}`, productId: 1, quantity: 1 }], discount: 0,
      billRequested: false, operatorId: 1, counterTurnNumber: index + 1, slot: index, x: 93, y: 58 + index * 56,
    });
    localStorage.setItem(key, JSON.stringify(tables));
    localStorage.setItem('carmela.pos.counter.sequence.v1', '49');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  counter = page.locator('[data-sector-id="counter"]');
  await counter.getByText('49/50 abiertas').waitFor();
  await openCounter();
  await counter.getByText('50/50 abiertas').waitFor();
  assert.equal(await counter.locator('.floor-table').count(), 50);
  await page.waitForFunction(() => {
    const sector = document.querySelector('[data-sector-id="counter"]');
    if (!sector) return false;
    const bottom = sector.getBoundingClientRect().bottom;
    return [...sector.querySelectorAll('.floor-table')].every((table) => table.getBoundingClientRect().bottom <= bottom + 1);
  });
  await counter.hover();
  assert.equal(await counter.locator('.floor-enter-hint').count(), 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog', { name: '¿Quién va a gestionar esta mesa?' }).count(), 0);
  await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
  assert.equal(await counter.locator('.floor-table').count(), 50);
  await page.getByRole('button', { name: 'Terminar edición', exact: true }).click();
  await counter.getByRole('button', { name: 'Abrir Mesa 1, ocupada', exact: true }).click();
  let pin = page.getByRole('dialog', { name: 'Código de Camila López' });
  await pin.getByRole('textbox', { name: 'Código de Camila López' }).fill('4829');
  await pin.getByRole('button', { name: 'Verificar y entrar' }).click();
  const account = page.getByRole('dialog', { name: 'Cuenta de Mesa 1' });
  await account.getByRole('button', { name: /Cobrar y cerrar/ }).click();
  const payment = page.getByRole('dialog', { name: 'Cobrar Mesa 1' });
  await payment.getByRole('radio', { name: 'Efectivo' }).check();
  await payment.getByRole('button', { name: /Confirmar cobro/ }).click();
  await account.waitFor({ state: 'detached' });
  await counter.getByText('49/50 abiertas').waitFor();
  counters = (await floor()).filter((table) => table.area === 'counter');
  assert.equal(counters.length, 49);
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.locator('[data-sector-id="counter"]').getByText('49/50 abiertas').waitFor();
  console.log('PASS: atajos de Mostrador, migración, límite de 50 cuentas y liberación al cobrar.');
} finally {
  await browser.close();
}
