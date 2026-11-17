import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { centralDb } from "@mistro/db/central";
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

    await centralDb.workspace.update({ where: { id: workspaceId }, data: { status: "pending" } });
    assert.equal(await authorizedWorkspace(userId, workspaceId), null);
    await centralDb.workspace.update({ where: { id: workspaceId }, data: { status: "active" } });

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

test("dos cafeterías no pueden acceder a la membresía de la otra", async () => {
  const suffix = randomUUID().slice(0, 8);
  const users = [`test-a-${suffix}`, `test-b-${suffix}`];
  const cafes = [`cafe-a-${suffix}`, `cafe-b-${suffix}`];
  try {
    for (let index = 0; index < 2; index++) {
      await centralDb.user.create({ data: { id: users[index], name: "Prueba", email: `${users[index]}@example.test`, emailVerified: false } });
      await centralDb.workspace.create({ data: {
        id: cafes[index], name: "Cafetería de prueba", databaseKey: `test_${index}_${suffix}`,
        memberships: { create: { userId: users[index], role: "owner" } },
      } });
    }
    for (let index = 0; index < 2; index++) {
      assert.equal((await authorizedWorkspace(users[index], cafes[index]))?.id, cafes[index]);
      assert.equal(await authorizedWorkspace(users[index], cafes[1 - index]), null);
      const visible = await listWorkspaces(users[index], false);
      assert.equal(visible.some((workspace) => workspace.id === cafes[1 - index]), false);
    }
  } finally {
    await centralDb.workspace.deleteMany({ where: { id: { in: cafes } } });
    await centralDb.user.deleteMany({ where: { id: { in: users } } });
  }
});
