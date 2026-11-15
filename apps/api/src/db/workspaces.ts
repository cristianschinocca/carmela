import { centralDb } from "@carmela/db/central";
import { tenantDatabase } from "@carmela/db/tenant";

export type Workspace = {
  id: string;
  name: string;
  database_key: string;
  status: "active" | "disabled";
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
  await tenantDatabase(workspace.database_key).query("SELECT 1");
}
