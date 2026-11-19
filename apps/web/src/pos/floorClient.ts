import type { Sector, Table } from "./floorModel";
export type RemoteFloor = { version: number; initialized: boolean; sectors: Sector[]; tables: Array<Pick<Table, "id" | "area" | "name" | "x" | "y" | "slot"> & { hasAccount: boolean }> };
export type FloorRequest = { id: string; expectedVersion: number; sectors: Sector[]; tables: Array<Pick<Table, "id" | "area" | "name" | "x" | "y" | "slot">> };
export class FloorRequestError extends Error { constructor(message: string, public readonly status: number) { super(message); } }
async function request<T>(workspace: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace)}/pos/floor`, { cache: "no-store", credentials: "same-origin", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new FloorRequestError(body?.error || "No se pudo conectar con el plano de la cafetería.", response.status);
  }
  return response.json() as Promise<T>;
}
export const floorClient = {
  load: (workspace: string) => request<RemoteFloor>(workspace),
  save: (workspace: string, input: FloorRequest) => request<{ version: number; replayed: boolean }>(workspace, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
};
export function planRequest(id: string, expectedVersion: number, sectors: Sector[], tables: Table[]): FloorRequest {
  return { id, expectedVersion, sectors, tables: tables.filter((table) => table.area !== "counter").map(({ id, area, name, x, y, slot }) => ({ id, area, name, x, y, slot })) };
}
