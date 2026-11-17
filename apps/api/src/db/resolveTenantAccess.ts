type Membership = { role: string; workspace: { id: string; databaseKey: string } };

export async function resolveTenantAccess<T>(membership: Membership | null, connect: (key: string) => T, identify: (db: T) => Promise<string | undefined>) {
  if (!membership) return null;
  const db = connect(membership.workspace.databaseKey);
  if (await identify(db) !== membership.workspace.id) throw new Error("Identidad de base operativa incorrecta");
  return { db, role: membership.role };
}
