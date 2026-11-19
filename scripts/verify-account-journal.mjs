import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5174/');
  const result = await page.evaluate(async () => {
    const { accountJournal } = await import('/src/pos/offline/accountJournal.ts');
    const { accountDraft } = await import('/src/pos/offline/accountDraft.ts');
    const scope = { userId: 'u', workspace: 'a', tableId: 't' };
    const other = { ...scope, workspace: 'b' };
    const operation = { id: 'one', tableId: 't', expectedVersion: 0, guests: 2, billRequested: false, discount: 0, operatorId: 'employee', items: [] };
    const competing = { ...operation, id: 'two' };
    const outcomes = await Promise.allSettled([accountJournal.queue(scope, operation), accountJournal.queue(scope, competing)]);
    const saved = await accountJournal.read(scope);
    const isolated = await accountJournal.read(other);
    await accountJournal.remove(scope, JSON.stringify({ ...operation, id: 'wrong' }));
    const protectedValue = await accountJournal.read(scope);
    await accountJournal.remove(scope, saved);
    localStorage.setItem('old-pending', JSON.stringify(operation));
    const migrated = await accountJournal.migrateLegacy(scope, 'old-pending');
    const draftScope = { ...scope, tableId: 'draft' };
    const draftOperation = { ...operation, tableId: 'draft' };
    const firstDraft = await accountDraft.save(draftScope, draftOperation, null);
    const races = await Promise.allSettled([
      accountDraft.save(draftScope, { ...draftOperation, guests: 3 }, firstDraft),
      accountDraft.save(draftScope, { ...draftOperation, guests: 4 }, firstDraft),
    ]);
    const finalDraft = await accountDraft.read(draftScope);
    let queueBlocked = false;
    try { await accountJournal.queue(draftScope, draftOperation); } catch { queueBlocked = true; }
    await accountDraft.stage(draftScope, finalDraft);
    const staged = await accountJournal.read(draftScope);
    return { statuses: outcomes.map(x => x.status).sort(), saved, isolated, protectedValue, migrated, old: localStorage.getItem('old-pending'), raceStatuses: races.map(x => x.status).sort(), finalDraft, staged, queueBlocked, afterStage: await accountDraft.read(draftScope) };
  });
  assert.deepEqual(result.statuses, ['fulfilled', 'rejected']);
  assert.equal(result.isolated, null);
  assert.equal(result.saved, result.protectedValue);
  assert.equal(JSON.parse(result.migrated).id, 'one');
  assert.equal(result.old, null);
  assert.deepEqual(result.raceStatuses, ['fulfilled', 'rejected']);
  assert.equal(result.queueBlocked, true);
  assert.equal(result.finalDraft, result.staged);
  assert.equal(result.afterStage, null);
  console.log('Cola de cuentas: aislamiento, concurrencia y migración OK');
  await context.close();
} finally { await browser.close(); }
