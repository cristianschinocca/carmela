import { centralDb } from "@mistro/db/central";
import { tenantDatabase } from "@mistro/db/tenant";
import { resolveTenantAccess } from "./resolveTenantAccess.js";

/** La membresía activa y la identidad de la base se comprueban en cada operación. */
export async function tenantAccess(userId: string, workspaceId: string) {
  const membership = await centralDb.workspaceMembership.findFirst({
    where: { userId, workspaceId, workspace: { status: "active" } },
    select: { role: true, workspace: { select: { id: true, databaseKey: true } } },
  });
  return resolveTenantAccess(membership, tenantDatabase, async (db) =>
    (await db.workspaceIdentity.findUnique({ where: { id: "workspace" }, select: { workspaceId: true } }))?.workspaceId,
  );
}
