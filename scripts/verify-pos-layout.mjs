import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { enableDemoSession } from './demo-session.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1400 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(8000);
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await enableDemoSession(page);
const positions = () => page.evaluate(() => {
  const sectors = JSON.parse(localStorage.getItem('carmela.pos.sectors.v1'));
  return Object.fromEntries(sectors.map(({ id, layout }) => [id, layout]));
});

try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5198');
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
  const handle = page.locator('[data-sector-id="salon"] .sector-resize-handle:not(.left)');
  const before = await positions();
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction((height) => JSON.parse(localStorage.getItem('carmela.pos.sectors.v1')).find((sector) => sector.id === 'salon').layout.height > height, before.salon.height, { timeout: 5000 });
  const afterKeyboard = await positions();
  assert.ok(afterKeyboard.patio.y > before.patio.y, 'Patio debe bajar al ampliar Salón con el teclado');

  const box = await handle.boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 110, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((height) => JSON.parse(localStorage.getItem('carmela.pos.sectors.v1')).find((sector) => sector.id === 'salon').layout.height > height + 80, afterKeyboard.salon.height, { timeout: 5000 });
  const afterDrag = await positions();
  assert.ok(afterDrag.patio.y >= afterDrag.salon.y + afterDrag.salon.height + 14 - 1);
  assert.ok(afterDrag.patio.y > afterKeyboard.patio.y);

  const clipped = await page.locator('[data-sector-id="salon"]').evaluate((sector) => {
    const bottom = sector.getBoundingClientRect().bottom;
    return [...sector.querySelectorAll('.floor-table')].some((table) => table.getBoundingClientRect().bottom > bottom - 4);
  });
  assert.equal(clipped, false, 'Todas las mesas de Salón deben quedar visibles');

  const grownHandle = await handle.boundingBox();
  assert.ok(grownHandle);
  const shrinkX = grownHandle.x + grownHandle.width / 2;
  const shrinkY = grownHandle.y + grownHandle.height / 2;
  await page.mouse.move(shrinkX, shrinkY);
  await page.mouse.down();
  await page.mouse.move(shrinkX, shrinkY + 40, { steps: 4 });
  await page.waitForFunction((y) => Number.parseFloat(document.querySelector('[data-sector-id="patio"]').style.getPropertyValue('--free-y')) > y, afterDrag.patio.y, { timeout: 5000 });
  assert.equal((await positions()).patio.y, afterDrag.patio.y, 'El arrastre no debe escribir en localStorage antes de soltar');
  await page.mouse.move(shrinkX, shrinkY, { steps: 4 });
  await page.mouse.up();
  const afterShrink = await positions();
  assert.equal(afterShrink.patio.y, afterDrag.patio.y, 'Volver al tamaño inicial durante el arrastre debe restaurar la posición de Patio');
  assert.ok(afterShrink.patio.y >= afterShrink.salon.y + afterShrink.salon.height + 14 - 1);

  const separateHandle = await handle.boundingBox();
  assert.ok(separateHandle);
  const separateX = separateHandle.x + separateHandle.width / 2;
  const separateY = separateHandle.y + separateHandle.height / 2;
  await page.mouse.move(separateX, separateY);
  await page.mouse.down();
  await page.mouse.move(separateX, separateY - 45, { steps: 5 });
  await page.mouse.up();
  const afterSeparateShrink = await positions();
  assert.ok(afterSeparateShrink.salon.height < afterShrink.salon.height, 'Debe poder reducirse el tamaño en otro gesto');
  assert.equal(afterSeparateShrink.patio.y - afterSeparateShrink.salon.height, 14, 'Patio debe acompañar al sector superior cuando se achica');

  const widthHandle = await handle.boundingBox();
  assert.ok(widthHandle);
  const widthX = widthHandle.x + widthHandle.width / 2;
  const widthY = widthHandle.y + widthHandle.height / 2;
  await page.mouse.move(widthX, widthY);
  await page.mouse.down();
  await page.mouse.move(widthX - 150, widthY, { steps: 6 });
  await page.mouse.up();
  const afterWidthChange = await positions();
  assert.ok(afterWidthChange.salon.width < afterSeparateShrink.salon.width, 'Debe poder achicarse el ancho de Salón');
  assert.ok(afterWidthChange.patio.y >= afterWidthChange.salon.y + afterWidthChange.salon.height + 14 - 1);
  const clippedAfterWidthChange = await page.locator('[data-sector-id="salon"]').evaluate((sector) => {
    const bottom = sector.getBoundingClientRect().bottom;
    return [...sector.querySelectorAll('.floor-table')].some((table) => table.getBoundingClientRect().bottom > bottom - 4);
  });
  assert.equal(clippedAfterWidthChange, false, 'Achicar el sector no debe ocultar mesas');

  const pushedChain = await page.evaluate(async () => {
    const { resizeSectorAndPush } = await import('/src/pos/floorModel.ts');
    const fixtures = [
      { id: 'a', layout: { x: 0, y: 0, width: 0.7, height: 220 } },
      { id: 'b', layout: { x: 0, y: 234, width: 0.7, height: 220 } },
      { id: 'c', layout: { x: 0, y: 468, width: 0.7, height: 220 } },
      { id: 'side', layout: { x: 0.714, y: 0, width: 0.286, height: 688 } },
    ];
    return resizeSectorAndPush(fixtures, 'a', { x: 0, y: 0, width: 700, height: 300 }, 1000)
      .map(({ id, layout }) => [id, layout.y]);
  });
  assert.deepEqual(Object.fromEntries(pushedChain), { a: 0, b: 314, c: 548, side: 0 }, 'El empuje debe propagarse solo a sectores situados debajo');

  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  const reloaded = await positions();
  assert.equal(reloaded.salon.height, afterWidthChange.salon.height);
  assert.equal(reloaded.salon.width, afterWidthChange.salon.width);
  assert.equal(reloaded.patio.y, afterWidthChange.patio.y);

  await page.setViewportSize({ width: 1440, height: 800 });
  await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
  const scrolledHandle = page.locator('[data-sector-id="salon"] .sector-resize-handle:not(.left)');
  await scrolledHandle.scrollIntoViewIfNeeded();
  await scrolledHandle.focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction((height) => JSON.parse(localStorage.getItem('carmela.pos.sectors.v1')).find((sector) => sector.id === 'salon').layout.height > height, afterWidthChange.salon.height);
  await scrolledHandle.scrollIntoViewIfNeeded();
  const scrolledBox = await scrolledHandle.boundingBox();
  assert.ok(scrolledBox);
  const scrolledX = scrolledBox.x + scrolledBox.width / 2;
  const scrolledY = scrolledBox.y + scrolledBox.height / 2;
  const beforeScrolledDrag = await positions();
  await page.mouse.move(scrolledX, scrolledY);
  await page.mouse.down();
  await page.mouse.move(scrolledX, scrolledY + 80, { steps: 6 });
  await page.mouse.up();
  const grownAtScroll = await positions();
  assert.ok(grownAtScroll.salon.height > beforeScrolledDrag.salon.height, 'Debe poder agrandarse con la página desplazada');
  await scrolledHandle.scrollIntoViewIfNeeded();
  const returnBox = await scrolledHandle.boundingBox();
  assert.ok(returnBox);
  const returnX = returnBox.x + returnBox.width / 2;
  const returnY = returnBox.y + returnBox.height / 2;
  await page.mouse.move(returnX, returnY);
  await page.mouse.down();
  await page.mouse.move(returnX, returnY - 35, { steps: 5 });
  await page.mouse.up();
  const afterScrolledDrag = await positions();
  assert.ok(afterScrolledDrag.salon.height < grownAtScroll.salon.height, 'Debe poder volver a achicarse con la página desplazada');
  assert.ok(afterScrolledDrag.patio.y >= afterScrolledDrag.salon.y + afterScrolledDrag.salon.height + 14 - 1);

  const patioTitle = page.locator('[data-sector-id="patio"] .floor-sector-title');
  await patioTitle.scrollIntoViewIfNeeded();
  const patioBox = await patioTitle.boundingBox();
  assert.ok(patioBox);
  const patioX = patioBox.x + 45;
  const patioY = patioBox.y + patioBox.height / 2;
  await page.mouse.move(patioX, patioY);
  await page.mouse.down();
  await page.mouse.move(patioX, patioY + 55, { steps: 7 });
  await page.waitForFunction((y) => Number.parseFloat(document.querySelector('[data-sector-id="patio"]').style.getPropertyValue('--free-y')) > y + 30, afterScrolledDrag.patio.y);
  assert.equal((await positions()).patio.y, afterScrolledDrag.patio.y, 'Mover un sector no debe guardar en cada movimiento');
  await page.mouse.up();
  const movedPatio = await positions();
  assert.ok(movedPatio.patio.y > afterScrolledDrag.patio.y + 30, 'El sector debe seguir al puntero');
  assert.ok(movedPatio.patio.y >= movedPatio.salon.y + movedPatio.salon.height + 14 - 1);
  await patioTitle.scrollIntoViewIfNeeded();
  const returnPatioBox = await patioTitle.boundingBox();
  assert.ok(returnPatioBox);
  const returnPatioX = returnPatioBox.x + 45;
  const returnPatioY = returnPatioBox.y + returnPatioBox.height / 2;
  await page.mouse.move(returnPatioX, returnPatioY);
  await page.mouse.down();
  await page.mouse.move(returnPatioX, returnPatioY - 30, { steps: 5 });
  await page.mouse.up();
  assert.ok((await positions()).patio.y < movedPatio.patio.y, 'Debe poder volver a mover el sector hacia arriba');
  assert.deepEqual(pageErrors, [], 'El redimensionado no debe producir errores en el navegador');
  console.log('PASS: arrastre y redimensionado fluidos, empuje, anchura, visibilidad, persistencia y sin errores de navegador.');
} finally {
  await browser.close();
}
