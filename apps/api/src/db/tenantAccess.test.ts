import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveTenantAccess } from "./resolveTenantAccess.js";

test("sin membresía no conecta a ninguna base y rechaza una identidad ajena", async () => {
  let connections = 0;
  const connect = (key: string) => { connections++; return key; };
  assert.equal(await resolveTenantAccess(null, connect, async () => "cafe"), null);
  assert.equal(connections, 0);
  const member = { role: "owner", workspace: { id: "cafe", databaseKey: "cafe_db" } };
  await assert.rejects(resolveTenantAccess(member, connect, async () => "otro"), /Identidad/);
  assert.deepEqual(await resolveTenantAccess(member, connect, async () => "cafe"), { db: "cafe_db", role: "owner" });
});
