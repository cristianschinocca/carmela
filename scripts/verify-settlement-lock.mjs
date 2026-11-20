import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto('http://127.0.0.1:5189/'), second.goto('http://127.0.0.1:5189/')]);
  const modulePath = '/src/pos/serverAccountClient.ts';
  await first.evaluate(async (path) => {
    const { withSettlementLock } = await import(path);
    window.settlementLock = withSettlementLock('cafe', () => new Promise((resolve) => { window.releaseSettlementLock = resolve; }));
    while (!window.releaseSettlementLock) await new Promise((resolve) => setTimeout(resolve, 10));
  }, modulePath);
  const attempt = (workspace) => second.evaluate(async ({ path, workspace }) => {
    const { withSettlementLock } = await import(path);
    try { return await withSettlementLock(workspace, async () => 'ok'); }
    catch (error) { return error.message; }
  }, { path: modulePath, workspace });
  assert.match(await attempt('cafe'), /otra pestaña/);
  assert.equal(await attempt('otro-cafe'), 'ok');
  await first.evaluate(async () => { window.releaseSettlementLock(); await window.settlementLock; });
  assert.equal(await attempt('cafe'), 'ok');
  await context.close();
  console.log('Coordinación de cobros entre pestañas e independencia por cafetería: OK');
} finally { await browser.close(); }
