import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { closeDatabases, tenantDatabase } from '@mistro/db/tenant';
import { cashOperation, parseCashOperation, readCash } from './service.js';
import { settleTable, reconcileSettlement } from '../pos/settlement.js';
const key = process.env.CASH_SETTLEMENT_TEST_DB_KEY;
test('un cobro se asocia una sola vez al turno y aumenta el saldo en efectivo', { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const shift = await db.cashShift.create({ data: { id: randomUUID(), openingAmount: 10000n, openedBy: 'test' } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: 'Café', price: 4000, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: 'Salón' } });
  const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, guests: 1, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 4000 }] } } });
  const request = { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: 'Efectivo' as const };
  assert.equal((await settleTable(db, request)).replayed, false);
  assert.equal((await settleTable(db, request)).replayed, true);
  const cash = await readCash(db);
  assert.equal(cash?.expectedAmount, '14000'); assert.equal(cash?.cashSales, '4000'); assert.equal(cash?.version, 1);
  assert.equal((await db.sale.findUniqueOrThrow({ where: { id: request.id } })).cashShiftId, shift.id);
  const card = await db.diningTable.create({ data: { sectorId: sector.id, number: 2, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 4000 }] } } });
  await settleTable(db, { id: randomUUID(), tableId: card.id, expectedVersion: 0, payment: 'Tarjeta' });
  assert.equal((await readCash(db))?.expectedAmount, '14000');
  const close = parseCashOperation({ id: randomUUID(), action: 'close', shiftId: shift.id, expectedVersion: 2, countedAmount: 14000, differenceReason: '' })!;
  await cashOperation(db, 'test', close);
  assert.equal((await db.cashShift.findUniqueOrThrow({ where: { id: shift.id } })).expectedAmount, 14000n);
  const next = await db.diningTable.create({ data: { sectorId: sector.id, number: 3, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 4000 }] } } });
  await assert.rejects(() => settleTable(db, { id: randomUUID(), tableId: next.id, expectedVersion: 0, payment: 'Efectivo' }), /Abrí la caja/);
});
test('cobro y cierre concurrentes no dejan una venta fuera del arqueo', { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const shift = await db.cashShift.create({ data: { id: randomUUID(), openingAmount: 1000n, openedBy: 'test' } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: 'Café', price: 100, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: 'Patio' } });
  const table = await db.diningTable.create({ data: { sectorId: sector.id, number: 1, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100 }] } } });
  const close = parseCashOperation({ id: randomUUID(), action: 'close', shiftId: shift.id, expectedVersion: 0, countedAmount: 1000, differenceReason: '' })!;
  const results = await Promise.allSettled([
    cashOperation(db, 'test', close),
    settleTable(db, { id: randomUUID(), tableId: table.id, expectedVersion: 0, payment: 'Efectivo' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const actual = await db.cashShift.findUniqueOrThrow({ where: { id: shift.id } });
  if (actual.closedAt) {
    assert.equal(actual.expectedAmount, 1000n);
    assert.equal(await db.sale.count({ where: { cashShiftId: shift.id } }), 0);
  } else {
    assert.equal((await readCash(db))?.expectedAmount, '1100');
    assert.equal(actual.version, 1);
  }
});
test('conciliar un cobro incierto impide que se confirme después de cancelarlo', { skip: !key }, async () => {
  const db = tenantDatabase(key!);
  const shift = await db.cashShift.findFirst({ where: { closedAt: null } }) ?? await db.cashShift.create({ data: { id: randomUUID(), openingAmount: 0n, openedBy: 'test' } });
  const category = await db.catalogCategory.create({ data: { name: randomUUID() } });
  const product = await db.catalogProduct.create({ data: { name: 'Café', price: 100, categoryId: category.id } });
  const sector = await db.floorSector.create({ data: { name: 'Salón' } });
  for (let number = 1; number <= 5; number++) {
    const table = await db.diningTable.create({ data: { sectorId: sector.id, number, items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100 }] } } });
    const id = randomUUID();
    const [sale, resolved] = await Promise.allSettled([
      settleTable(db, { id, tableId: table.id, expectedVersion: 0, payment: 'Efectivo' }),
      reconcileSettlement(db, id, table.id),
    ]);
    assert.equal(resolved.status, 'fulfilled');
    const recorded = await db.sale.findUnique({ where: { id } });
    if (resolved.value.status === 'completed') { assert.ok(recorded); assert.equal(sale.status, 'fulfilled'); }
    else { assert.equal(recorded, null); await assert.rejects(() => settleTable(db, { id, tableId: table.id, expectedVersion: 0, payment: 'Efectivo' })); }
  }
  assert.ok(shift.id);
});
after(async () => { await closeDatabases(); });
