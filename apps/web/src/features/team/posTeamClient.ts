import type { TeamMember, TeamRole } from "../../stores/team";

type Person = { legacyId: number; name: string; role: TeamRole; clockedIn: boolean; clockedInAt: string | null };
const base = (workspace: string) => `/api/workspaces/${encodeURIComponent(workspace)}/team`;
export type PosTeam = { members: TeamMember[]; verify: (member: TeamMember, pin: string) => Promise<void> };
export async function loadPosTeam(workspace: string): Promise<PosTeam> {
  const response = await fetch(`${base(workspace)}/attendance/status`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar el equipo de la cafetería.");
  const people = await response.json() as Person[];
  return {
    members: people.map((person) => ({ id: person.legacyId, name: person.name, role: person.role, active: true, pin: "", clockedIn: person.clockedIn, lastClock: person.clockedInAt ?? undefined })),
    async verify(member, pin) {
      const result = await fetch(`${base(workspace)}/employees/verify-code`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: member.id, pin }) });
      if (!result.ok) {
        const body = await result.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "No se pudo verificar el código. Revisá la conexión.");
      }
    },
  };
}
