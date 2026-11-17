import { centralDb } from "@mistro/db/central";
import { closeDatabases, tenantDatabase } from "@mistro/db/tenant";

const [workspaceId, databaseKey, ownerEmail, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();

async function provision() {
  if (!workspaceId || !/^[a-z][a-z0-9-]*$/.test(workspaceId)) throw new Error("ID de cafetería inválido");
  if (!databaseKey || !/^[a-z][a-z0-9_]*$/.test(databaseKey)) throw new Error("Clave de base inválida");
  if (!ownerEmail || !name) throw new Error("Uso: workspace:provision <id> <clave-db> <email-dueño> <nombre>");

  const owner = await centralDb.user.findUnique({ where: { email: ownerEmail.toLowerCase() }, select: { id: true } });
  if (!owner) throw new Error("El dueño debe existir primero como usuario");

  // La migración de esta base debe estar aplicada antes de vincularla.
  const tenant = tenantDatabase(databaseKey);
  const identity = await tenant.workspaceIdentity.findUnique({ where: { id: "workspace" } });
  if (identity && identity.workspaceId !== workspaceId) throw new Error("La base ya pertenece a otra cafetería");

  const existing = await centralDb.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { databaseKey }] },
    select: { id: true, databaseKey: true, status: true, memberships: { where: { role: "owner" }, select: { userId: true } } },
  });
  if (existing && (existing.id !== workspaceId || existing.databaseKey !== databaseKey)) {
    throw new Error("El ID o la clave de base ya están vinculados a otra cafetería");
  }
  if (existing?.status === "pending" && !existing.memberships.some((member) => member.userId === owner.id)) {
    throw new Error("El dueño no coincide con el usuario registrado para esta marca");
  }

  if (!identity) {
    await tenant.workspaceIdentity.create({ data: { id: "workspace", workspaceId } });
  }
  if (!existing) {
    await centralDb.workspace.create({
      data: {
        id: workspaceId, name, databaseKey,
        memberships: { create: { userId: owner.id, role: "owner" } },
      },
    });
  } else {
    await centralDb.$transaction(async (tx) => {
      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId, userId: owner.id } },
        create: { workspaceId, userId: owner.id, role: "owner" },
        update: {},
      });
      if (existing.status === "pending") {
        await tx.workspace.update({ where: { id: workspaceId }, data: { status: "active" } });
      }
    });
  }
  console.log(`Cafetería ${workspaceId} vinculada a ${databaseKey}`);
}

void provision().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.all([centralDb.$disconnect(), closeDatabases()]);
});
