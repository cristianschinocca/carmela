import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { centralDb } from "@carmela/db/central";
import { authorizedWorkspace, listWorkspaces } from "./workspaces.js";

after(() => centralDb.$disconnect());

test("una cafetería solo es accesible para un miembro activo", async () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `test-user-${suffix}`;
  const workspaceId = `test-cafe-${suffix}`;

  try {
    await centralDb.user.create({ data: { id: userId, name: "Prueba", email: `${suffix}@example.test`, emailVerified: false } });
    await centralDb.workspace.create({ data: {
      id: workspaceId,
      name: "Cafetería de prueba",
      databaseKey: `test_${suffix}`,
      memberships: { create: { userId, role: "staff" } },
    } });

    assert.equal((await authorizedWorkspace(userId, workspaceId))?.id, workspaceId);
    assert.equal(await authorizedWorkspace("otro-usuario", workspaceId), null);
    assert.equal((await listWorkspaces(userId, false)).some((item) => item.id === workspaceId), true);

    await centralDb.workspace.update({ where: { id: workspaceId }, data: { status: "disabled" } });
    assert.equal(await authorizedWorkspace(userId, workspaceId), null);
    assert.equal((await listWorkspaces(userId, false)).some((item) => item.id === workspaceId), false);

  } finally {
    await centralDb.workspace.deleteMany({ where: { id: workspaceId } });
    await centralDb.user.deleteMany({ where: { id: userId } });
  }
});
