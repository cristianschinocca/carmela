import { centralDb } from "@mistro/db/central";
import { tenantDatabase } from "@mistro/db/tenant";

export type Workspace = {
  id: string;
  name: string;
  database_key: string;
  status: "pending" | "active" | "disabled";
};

export async function listWorkspaces(userId: string, isAdmin: boolean): Promise<Omit<Workspace, "database_key">[]> {
  const workspaces = await centralDb.workspace.findMany({
    where: isAdmin ? {} : { status: "active", memberships: { some: { userId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  return workspaces.map((workspace) => ({
    ...workspace,
    status: workspace.status as Workspace["status"],
  }));
}

export async function authorizedWorkspace(userId: string, id: string): Promise<Workspace | null> {
  const workspace = await centralDb.workspace.findFirst({
    where: { id, status: "active", memberships: { some: { userId } } },
    select: { id: true, name: true, databaseKey: true, status: true },
  });
  return workspace ? {
    id: workspace.id,
    name: workspace.name,
    database_key: workspace.databaseKey,
    status: workspace.status as Workspace["status"],
  } : null;
}

export async function checkWorkspaceDatabase(workspace: Workspace): Promise<void> {
  const identity = await tenantDatabase(workspace.database_key).workspaceIdentity.findUnique({
    where: { id: "workspace" },
    select: { workspaceId: true },
  });
  if (identity?.workspaceId !== workspace.id) {
    throw new Error(`La base operativa de ${workspace.id} no corresponde a la cafetería autorizada`);
  }
}
