import { useEffect, useRef, useState } from "react";
import { TeamManager } from "../../components/team/TeamManager";
import type { TeamMember, TeamPay, TeamRole } from "../../stores/team";
import { catalogClient, type CatalogWorkspace } from "../catalog/catalogClient";

type Employee = { id: string; legacyId: number; name: string; role: TeamRole; active: boolean; pay: TeamPay | null; version: number; clockedIn: boolean; clockedInAt: string | null };
const base = (workspace: string) => `/api/workspaces/${encodeURIComponent(workspace)}/team/employees`;
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "No se pudo acceder al equipo.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export function ServerTeamManager() {
  const [source, setSource] = useState<"server" | "local">("server");
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active"); setWorkspaces(available);
      if (available.length === 1) setWorkspace(available[0].id);
      else if (!available.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
    }).catch(() => { if (active) setError("No se pudieron cargar las cafeterías."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    const current = ++generation.current; setEmployees(null);
    if (!workspace || source !== "server") return;
    setLoading(true); setError("");
    void request<Employee[]>(base(workspace)).then((rows) => { if (current === generation.current) setEmployees(rows); }).catch((reason: unknown) => { if (current === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo cargar el equipo."); }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [workspace, source, revision]);
  const save = async (member: TeamMember) => {
    if (!employees || !workspace || saving.current) return false;
    const current = generation.current, existing = employees.find((item) => item.legacyId === member.id);
    const payload = { name: member.name, role: member.role, active: member.active, pay: member.pay ?? null, ...(member.pin ? { pin: member.pin } : {}), ...(existing ? { version: existing.version } : {}) };
    saving.current = true; setError(""); let saved = false;
    try {
      await request(`${base(workspace)}${existing ? `/${existing.id}` : ""}`, { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      saved = true;
      const rows = await request<Employee[]>(base(workspace));
      if (current === generation.current) setEmployees(rows);
      return true;
    } catch (reason) {
      if (current === generation.current) {
        setEmployees(null);
        setError(saved ? "El empleado se guardó, pero no se pudo actualizar la lista. Volvé a cargarla." : `${reason instanceof Error ? reason.message : "No se pudo confirmar el cambio."} Actualizá la lista antes de reintentar.`);
      }
      return saved;
    } finally { saving.current = false; }
  };
  const remove = async (id: number) => {
    if (!employees || !workspace || saving.current) return false;
    const existing = employees.find((item) => item.legacyId === id);
    if (!existing) return false;
    const current = generation.current; saving.current = true; setError(""); let saved = false;
    try {
      await request(`${base(workspace)}/${existing.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: existing.version }) });
      saved = true;
      const rows = await request<Employee[]>(base(workspace));
      if (current === generation.current) setEmployees(rows);
      return true;
    } catch (reason) {
      if (current === generation.current) { setEmployees(null); setError(saved ? "El empleado se eliminó, pero no se pudo actualizar la lista." : `${reason instanceof Error ? reason.message : "No se pudo confirmar la eliminación."} Actualizá antes de reintentar.`); }
      return saved;
    } finally { saving.current = false; }
  };
  const members: TeamMember[] = employees?.map((employee) => ({ id: employee.legacyId, name: employee.name, role: employee.role, active: employee.active, pay: employee.pay ?? undefined, pin: "", clockedIn: employee.clockedIn, lastClock: employee.clockedInAt ? new Date(employee.clockedInAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : undefined })) ?? [];
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center gap-2 text-sm"><span>Origen:</span><button type="button" className="button" aria-pressed={source === "server"} onClick={() => setSource("server")}>Cafetería</button><button type="button" className="button" aria-pressed={source === "local"} onClick={() => setSource("local")}>Datos locales</button></div>
    {source === "local" ? <><p className="text-sm text-[var(--muted)]">Equipo guardado en este navegador. Los pagos de caja todavía utilizan estos datos locales.</p><TeamManager /></> : <>
      <p className="text-sm text-[var(--muted)]">Empleados de la cafetería. El punto de venta conectado consulta este equipo; los pagos de caja todavía utilizan el equipo local.</p>
      {workspaces.length > 1 && <label>Cafetería <select aria-label="Cafetería" value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {loading && <p role="status">Cargando equipo…</p>}
      {error && <p role="alert">{error} <button type="button" className="button" onClick={() => setRevision((value) => value + 1)}>Actualizar</button></p>}
      {!loading && employees && <TeamManager remote={{ members, save, remove }} />}
    </>}
  </div>;
}
