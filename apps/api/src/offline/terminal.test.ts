import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";
import { parseTerminal, readTerminal, registerTerminal } from "./terminal.js";

test("valida la identidad de la terminal", () => {
  const identity = { deviceId: randomUUID(), token: "a".repeat(64) };
  assert.deepEqual(parseTerminal(identity), identity);
  assert.equal(parseTerminal({ ...identity, token: "1234" }), null);
  assert.equal(parseTerminal({ ...identity, deviceId: "invalid" }), null);
});
test("registra una sola terminal y conserva su identidad en reintentos", { skip: !process.env.TENANT_DB_TERMINAL_TEST_URL }, async () => {
  const db = tenantDatabase("terminal_test");
  const first = { deviceId: randomUUID(), token: "a".repeat(64) };
  const second = { deviceId: randomUUID(), token: "b".repeat(64) };
  const results = await Promise.allSettled([registerTerminal(db, "owner", first), registerTerminal(db, "owner", second)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const winner = (await readTerminal(db, first)).isCurrent ? first : second;
  const other = winner === first ? second : first;
  assert.equal((await registerTerminal(db, "owner", winner)).isCurrent, true);
  assert.equal((await readTerminal(db, other)).isCurrent, false);
  assert.equal((await readTerminal(db, { ...winner, token: "c".repeat(64) })).isCurrent, false);
  assert.notEqual((await db.offlineTerminal.findUniqueOrThrow({ where: { id: "terminal" } })).tokenHash, winner.token);
});
after(async () => { await closeDatabases(); });
