import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5198');
  const result = await page.evaluate(async () => {
    const { applySaleToIngredients } = await import('/src/stock/domain.ts');
    const catalog = { ingredients: [{ id: 'ham', name: 'Jamón', unit: 'kg', quantity: 0.6, minimum: 0, supplierIds: [] }], suppliers: [], recipes: [
      { id: 'a', productId: 1, ingredients: [{ ingredientId: 'ham', quantity: 200, unit: 'g' }] },
      { id: 'b', productId: 2, ingredients: [{ ingredientId: 'ham', quantity: 300, unit: 'g' }] },
    ] };
    const sale = { id: 'sale', items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] };
    let error = '';
    try { applySaleToIngredients(catalog, sale); } catch (e) { error = e.message; }
    sale.items[0].quantity = 1;
    return { error, balance: applySaleToIngredients(catalog, sale).ingredients[0].quantity, original: catalog.ingredients[0].quantity };
  });
  assert.match(result.error, /Stock insuficiente: Jamón/);
  assert.equal(result.balance, 0.1);
  assert.equal(result.original, 0.6);
  const rollback = await page.evaluate(async () => {
    const { settleSaleLocally } = await import('/src/stock/settleSale.ts');
    const { SALES_STORAGE } = await import('/src/stores/sales.ts');
    const { STOCK_CATALOG_STORAGE } = await import('/src/stock/repository.ts');
    const key = 'test.floor';
    localStorage.clear();
    localStorage.setItem(key, 'old');
    localStorage.setItem(STOCK_CATALOG_STORAGE, JSON.stringify({ ingredients: [], suppliers: [], recipes: [] }));
    const original = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && !failed) { failed = true; throw new Error('Error de guardado'); }
      return original.call(this, name, value);
    };
    try {
      settleSaleLocally({ id: 'test', items: [] }, [], key, []);
    } catch { /* Se comprueba el estado restaurado. */ }
    finally { Storage.prototype.setItem = original; }
    return { failed, floor: localStorage.getItem(key), sales: localStorage.getItem(SALES_STORAGE) };
  });
  assert.deepEqual(rollback, { failed: true, floor: 'old', sales: null });
  console.log('PASS: consumo compartido y stock insuficiente.');
} finally { await browser.close(); }
