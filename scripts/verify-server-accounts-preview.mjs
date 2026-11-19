import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const tableId = '550e8400-e29b-41d4-a716-446655440000', employeeId = '550e8400-e29b-41d4-a716-446655440001', productId = '550e8400-e29b-41d4-a716-446655440002', lineId = '550e8400-e29b-41d4-a716-446655440003';
    let account = { id: tableId, clientKey: 'mesa-1', version: 0, guests: 2, discount: 100, billRequested: false, operator: { id: employeeId, legacyId: 1, name: 'Ana', active: true }, items: [{ id: lineId, productId, productLegacyId: 1, quantity: 2, unitPrice: 2000, unitDiscount: 0, note: '' }] };
    const freeTableId = '550e8400-e29b-41d4-a716-446655440004';
    let freeAccount = { id: freeTableId, clientKey: 'mesa-2', version: 0, guests: 0, discount: 0, billRequested: false, operator: null, items: [] };
    let failed = false, requestId, paid = false;
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
    await page.route('**/api/workspaces', r => r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }));
    await page.route('**/api/workspaces/cafe/pos/floor', r => r.fulfill({ json: { version: 1, initialized: true, sectors: [{ id: 'salon', label: 'Salón', description: 'Mesas interiores', limit: 60, columns: 8, start: 1, minHeight: 186 }], tables: [{ id: 'mesa-1', area: 'salon', name: 'Mesa 1', x: 0, y: 0, hasAccount: !paid }, { id: 'mesa-2', area: 'salon', name: 'Mesa 2', x: 1, y: 0, hasAccount: !!freeAccount.guests }] } }));
    await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [{ id: employeeId, legacyId: 1, name: 'Ana', role: 'Mozo' }] }));
    await page.route('**/api/workspaces/cafe/team/employees/verify-code', r => r.fulfill({ status: r.request().postDataJSON().pin === '1937' ? 204 : 400, json: { error: 'Código incorrecto' } }));
    await page.route('**/api/workspaces/cafe/cash/active', r => r.fulfill({ json: { id: '550e8400-e29b-41d4-a716-446655440005' } }));
    await page.route('**/api/workspaces/cafe/pos/settlements/reconcile', r => { assert.equal(r.request().postDataJSON().tableId, tableId); return r.fulfill({ json: { status: 'completed', total: '5900' } }); });
    await page.route('**/api/workspaces/cafe/pos/settlements', r => { const body = r.request().postDataJSON(); assert.equal(body.employeePin, '1937'); assert.equal(body.payment, 'Efectivo'); assert.equal(body.expectedShiftId, '550e8400-e29b-41d4-a716-446655440005'); paid = true; return r.fulfill({ status: 503, json: { error: 'Respuesta interrumpida' } }); });
    await page.route('**/api/workspaces/cafe/pos/accounts', r => {
      if (r.request().method() === 'GET') return r.fulfill({ json: [account, freeAccount] });
      const body = r.request().postDataJSON(); assert.equal(body.employeePin, '1937');
      if (body.tableId === freeTableId) { assert.equal(body.guests, 2); assert.equal(body.items.length, 1); freeAccount = { ...freeAccount, ...body, version: 1, operator: { id: employeeId, legacyId: 1, name: 'Ana', active: true } }; return r.fulfill({ json: { version: 1, replayed: false } }); }
      if (!failed) { failed = true; requestId = body.id; account = { ...account, version: 1, items: body.items }; return r.abort('failed'); }
      assert.equal(body.id, requestId); assert.equal(body.items[0].quantity, 3);
      return r.fulfill({ json: { version: 1, replayed: true } });
    });
    await page.route('**/api/workspaces/cafe/catalog/products**', r => r.fulfill({ json: { items: [{ id: productId, name: 'Café', legacyId: 1, available: true, price: 2000 }], nextOffset: null } }));
    await page.goto('http://127.0.0.1:5174/');
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Mesa 2, libre' }).click();
    const free = page.getByRole('dialog', { name: 'Salón · Mesa 2' });
    await free.getByLabel('Responsable').selectOption(employeeId);
    await free.getByLabel('Código de cuatro números').fill('1937');
    await free.getByRole('button', { name: 'Continuar' }).click();
    await free.getByLabel('Agregar producto').selectOption(productId);
    await free.getByRole('button', { name: 'Agregar', exact: true }).click();
    await free.getByRole('button', { name: 'Guardar cuenta' }).click();
    await page.getByRole('button', { name: 'Abrir Mesa 2, ocupada' }).waitFor();
    await page.getByRole('button', { name: 'Abrir Mesa 1, ocupada' }).click();
    const dialog = page.getByRole('dialog', { name: 'Salón · Mesa 1' });
    await dialog.getByLabel('Código de cuatro números').fill('1937');
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByLabel('Cantidad', { exact: true }).fill('3');
    await dialog.getByRole('button', { name: 'Guardar cuenta' }).click();
    await dialog.getByRole('button', { name: 'Sincronizar cambios' }).waitFor();
    await dialog.getByText(/guardado quedó pendiente en este dispositivo/).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('1937')), false);
    await page.reload();
    if (width < 760) await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Mesa 1, cambios pendientes' }).click();
    await dialog.getByLabel('Código de cuatro números').fill('1937');
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByRole('button', { name: 'Sincronizar cambios' }).click();
    await page.getByRole('button', { name: 'Abrir Mesa 1, ocupada' }).click();
    const checkout = page.getByRole('dialog', { name: 'Salón · Mesa 1' });
    await checkout.getByLabel('Código de cuatro números').fill('1937');
    await checkout.getByRole('button', { name: 'Continuar' }).click();
    await checkout.getByRole('button', { name: 'Cobrar', exact: true }).click();
    await checkout.getByRole('button', { name: /Confirmar cobro/ }).click();
    await page.getByRole('heading', { name: 'Verificar cobro pendiente' }).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('1937')), false);
    await page.getByRole('button', { name: 'Verificar cobro' }).click();
    await page.getByText(/Cobro confirmado: Salón · Mesa 1/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await context.close();
  }
  console.log('Cuentas: edición, cobro y recuperación en escritorio y móvil OK');
} finally { await browser.close(); }
