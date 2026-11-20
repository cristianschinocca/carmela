import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const tableId = '550e8400-e29b-41d4-a716-446655440000', employeeId = '550e8400-e29b-41d4-a716-446655440001', productId = '550e8400-e29b-41d4-a716-446655440002', lineId = '550e8400-e29b-41d4-a716-446655440003', shiftId = '550e8400-e29b-41d4-a716-446655440005', recipeId = '550e8400-e29b-41d4-a716-446655440006';
  let online = true, attempts = 0, acceptedId = '';
  let account = { id: tableId, clientKey: 'mesa-1', version: 0, guests: 2, discount: 0, billRequested: false, operator: { id: employeeId, legacyId: 1, name: 'Ana', active: true }, items: [{ id: lineId, productId, productLegacyId: 1, quantity: 1, unitPrice: 2000, unitDiscount: 0, note: '' }] };
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'u', name: 'Usuario', email: 'u@test.com', role: 'user' }, session: { id: 's', userId: 'u', expiresAt: '2099-01-01T00:00:00.000Z' } } }));
  await page.route('**/api/workspaces', r => online ? r.fulfill({ json: [{ id: 'cafe', name: 'Café', status: 'active' }] }) : r.abort('failed'));
  await page.route('**/api/workspaces/cafe/pos/floor', r => r.fulfill({ json: { version: 1, initialized: true, sectors: [{ id: 'salon', label: 'Salón', description: 'Mesas interiores', limit: 60, columns: 8, start: 1, minHeight: 186 }], tables: [{ id: 'mesa-1', area: 'salon', name: 'Mesa 1', x: 0, y: 0, hasAccount: !!account.items.length }] } }));
  await page.route('**/api/workspaces/cafe/pos/offline-snapshot', r => r.fulfill({ json: { cash: { id: shiftId, version: 1, expectedAmount: '6800' }, productStock: [{ productId, quantity: 3, enabled: true, version: 0 }], ingredients: [{ id: 'ham', name: 'Jamón', unit: 'kg', quantity: '0.6', version: 0 }], recipes: [{ id: recipeId, productId, version: 0, ingredients: [{ ingredientId: 'ham', quantity: '200', unit: 'g' }] }] } }));
  await page.route('**/api/workspaces/cafe/team/attendance/status', r => r.fulfill({ json: [{ id: employeeId, legacyId: 1, name: 'Ana', role: 'Mozo' }] }));
  await page.route('**/api/workspaces/cafe/team/employees/verify-code', r => r.fulfill({ status: 204 }));
  await page.route('**/api/workspaces/cafe/catalog/products**', r => r.fulfill({ json: { items: [{ id: productId, name: 'Café', legacyId: 1, available: true, price: 2000 }], nextOffset: null } }));
  await page.route('**/api/workspaces/cafe/pos/accounts', r => r.fulfill({ json: [account] }));
  await page.route('**/api/workspaces/cafe/pos/offline-settlements', r => {
    const body = r.request().postDataJSON(); assert.equal(body.employeePin, '1937'); assert.equal(body.settlement.expectedShiftId, shiftId); assert.equal(body.recipeVersions[0].recipeId, recipeId);
    attempts++;
    if (attempts === 1) { acceptedId = body.settlement.id; account = { ...account, version: 2, guests: 0, operator: null, items: [] }; return r.abort('failed'); }
    if (attempts === 2) { assert.equal(body.settlement.id, acceptedId); return r.fulfill({ json: { saleId: acceptedId, total: '2000', replayed: true } }); }
    assert.equal(body.account.expectedVersion, 2); assert.notEqual(body.settlement.id, acceptedId);
    account = { ...account, version: 4 };
    return r.fulfill({ json: { saleId: body.settlement.id, total: '4000', replayed: false } });
  });
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Mesa 1, ocupada' }).waitFor();
  online = false;
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByText(/Sin conexión · Copia del/).waitFor();
  await page.getByRole('button', { name: 'Abrir Mesa 1, ocupada' }).click();
  const dialog = page.getByRole('dialog', { name: 'Salón · Mesa 1' });
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await dialog.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await dialog.getByRole('button', { name: /Confirmar cobro/ }).click();
  await page.getByRole('button', { name: 'Abrir Mesa 1, libre' }).waitFor();
  const saved = await page.evaluate(async () => { const { posSnapshot } = await import('/src/pos/offline/snapshot.ts'); const { saleJournal } = await import('/src/pos/offline/saleJournal.ts'); return { snapshot: await posSnapshot.load('u', 'cafe'), sales: await saleJournal.list('u', 'cafe') }; });
  assert.equal(saved.snapshot.inventory.cash.expectedAmount, '8800');
  assert.equal(saved.snapshot.inventory.productStock[0].quantity, 2);
  assert.equal(saved.snapshot.inventory.ingredients[0].quantity, '0.4');
  assert.equal(saved.sales.length, 1);
  assert.equal(JSON.stringify(saved.sales).includes('1937'), false);
  const shared = await page.evaluate(async ({ inventory, sale }) => {
    const { projectSale } = await import('/src/pos/offline/saleJournal.ts');
    const second = '550e8400-e29b-41d4-a716-446655440007';
    inventory.recipes.push({ id: '550e8400-e29b-41d4-a716-446655440008', productId: second, version: 0, ingredients: [{ ingredientId: 'ham', quantity: '300', unit: 'g' }] });
    sale.account.items.push({ ...sale.account.items[0], productId: second });
    try { projectSale(inventory, sale.account, 'Efectivo'); return ''; } catch (error) { return error.message; }
  }, { inventory: saved.snapshot.inventory, sale: saved.sales[0] });
  assert.match(shared, /Stock insuficiente: Jamón/);
  await page.getByRole('button', { name: 'Abrir Mesa 1, libre' }).click();
  await dialog.getByLabel('Responsable').selectOption(employeeId);
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await dialog.getByLabel('Agregar producto').selectOption(productId);
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await dialog.getByLabel('Cantidad', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await dialog.getByRole('button', { name: /Confirmar cobro/ }).click();
  await page.getByText(/2 cobro\(s\) pendiente\(s\)/).waitFor();
  const secondSnapshot = await page.evaluate(async () => { const { posSnapshot } = await import('/src/pos/offline/snapshot.ts'); return posSnapshot.load('u', 'cafe'); });
  assert.equal(secondSnapshot.inventory.cash.expectedAmount, '12800');
  assert.equal(secondSnapshot.inventory.ingredients[0].quantity, '0');
  assert.equal(secondSnapshot.inventory.productStock[0].quantity, 0);
  await page.reload(); online = true;
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByRole('heading', { name: 'Sincronizar cobros pendientes' }).waitFor();
  await page.getByLabel('Código de Ana').fill('1937');
  await page.getByRole('button', { name: 'Sincronizar cobro' }).click();
  await page.getByRole('alert').getByText(/permanece guardado/).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Punto de venta', exact: true }).click();
  await page.getByLabel('Código de Ana').fill('1937');
  await page.getByRole('button', { name: 'Sincronizar cobro' }).click();
  await page.getByText(/1 cobro\(s\) registrado\(s\)/).waitFor();
  await page.getByLabel('Código de Ana').fill('1937');
  await page.getByRole('button', { name: 'Sincronizar cobro' }).click();
  await page.getByText('Los cobros pendientes se sincronizaron.').waitFor();
  assert.equal(attempts, 3);
  const race = await page.evaluate(async ({ snapshot, template }) => {
    const { posSnapshot } = await import('/src/pos/offline/snapshot.ts');
    const { saleJournal } = await import('/src/pos/offline/saleJournal.ts');
    const scope = { userId: 'race', workspace: 'race-cafe', tableId: template.account.tableId };
    await posSnapshot.save(scope.userId, scope.workspace, snapshot);
    const account = { ...template.account, id: crypto.randomUUID(), expectedVersion: 2 };
    const results = await Promise.allSettled([saleJournal.queue(scope, 'Mesa 1', account, 'Efectivo', null), saleJournal.queue(scope, 'Mesa 1', { ...account, id: crypto.randomUUID() }, 'Efectivo', null)]);
    let overwriteBlocked = false;
    try { await posSnapshot.save(scope.userId, scope.workspace, snapshot); } catch { overwriteBlocked = true; }
    return { accepted: results.filter((result) => result.status === 'fulfilled').length, pending: (await saleJournal.list(scope.userId, scope.workspace)).length, overwriteBlocked };
  }, { snapshot: saved.snapshot, template: saved.sales[0] });
  assert.deepEqual(race, { accepted: 1, pending: 1, overwriteBlocked: true });
  await context.close();
  console.log('Cobro offline: persistencia, stock, caja y reintento idempotente OK');
} finally { await browser.close(); }
