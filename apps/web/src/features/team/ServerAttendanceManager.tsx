import { useCallback, useEffect, useState } from "react";
import { AttendanceManager } from "../../components/attendance/AttendanceManager";
import type { TeamMember, TeamRole } from "../../stores/team";
import { catalogClient, type CatalogWorkspace } from "../catalog/catalogClient";

type Person = { legacyId: number; name: string; role: TeamRole; clockedIn: boolean; clockedInAt: string | null };
type ClockResult = { status: "completed"; name: string; kind: "Entrada" | "Salida"; at: string } | { status: "cancelled" };
const base = (id: string) => `/api/workspaces/${encodeURIComponent(id)}/team/attendance`;
const formatTime = (at: string) => new Date(at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const message = await response.json().catch(() => null) as { error?: string } | null;
    throw Object.assign(new Error(message?.error || "No se pudo conectar con el servidor."), { status: response.status });
  }
  return response.json() as Promise<T>;
}
export function ServerAttendanceManager({ userId }: { userId: string }) {
  const [source, setSource] = useState<"server" | "local">("server");
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState(false);
  const key = `mistro.attendance.pending.${userId}.${workspace}`;
  useEffect(() => {
    let mounted = true;
    void catalogClient.workspaces().then((items) => {
      if (!mounted) return;
      const active = items.filter((item) => item.status === "active");
      setWorkspaces(active);
      if (active.length === 1) setWorkspace(active[0].id);
      if (!active.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
    }).catch(() => { if (mounted) setError("No se pudieron cargar las cafeterías."); });
    return () => { mounted = false; };
  }, [revision]);
  const load = useCallback(async () => {
    const rows = await request<Person[]>(`${base(workspace)}/status`);
    setPeople(rows);
  }, [workspace]);
  useEffect(() => {
    if (!workspace || source !== "server") return;
    let active = true;
    setPeople(null); setError(""); setNotice(""); setChecking(true);
    void (async () => {
      try {
        const pending = sessionStorage.getItem(key);
        if (pending) {
          const result = await request<ClockResult>(`${base(workspace)}/reconcile`, { id: pending });
          if (result.status === "completed" && active) setNotice(`${result.kind} registrada: ${result.name}, ${formatTime(result.at)}.`);
          sessionStorage.removeItem(key);
        }
        const rows = await request<Person[]>(`${base(workspace)}/status`);
        if (active) setPeople(rows);
      } catch { if (active) setError("No se pudo verificar el fichaje o cargar el equipo. Volvé a intentar con conexión."); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [workspace, source, key, revision]);
  const clock = async (pin: string) => {
    if (checking || sessionStorage.getItem(key)) throw new Error("Primero verificá el intento anterior.");
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    try {
      const result = await request<ClockResult>(`${base(workspace)}/clock`, { id, pin });
      if (result.status !== "completed") throw new Error("No se pudo confirmar el fichaje.");
      sessionStorage.removeItem(key);
      await load().catch(() => { setPeople(null); setError("El fichaje se registró, pero no se pudo actualizar el equipo."); });
      return { name: result.name, type: result.kind, time: formatTime(result.at) };
    } catch (reason) {
      const status = (reason as { status?: number }).status;
      if (status === 400 || status === 429) {
        sessionStorage.removeItem(key);
        throw reason;
      }
      setPeople(null); setError("No se pudo confirmar el fichaje. Verificá el resultado antes de volver a intentar.");
      throw new Error("No se pudo confirmar el fichaje. Cerrá esta ventana y verificá el resultado.");
    }
  };
  const members: TeamMember[] = (people ?? []).map((person) => ({ id: person.legacyId, name: person.name, role: person.role, active: true, pin: "", clockedIn: person.clockedIn, lastClock: person.clockedInAt ? formatTime(person.clockedInAt) : undefined }));
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center gap-2 text-sm"><span>Origen:</span><button type="button" className="button" aria-pressed={source === "server"} onClick={() => setSource("server")}>Cafetería</button><button type="button" className="button" aria-pressed={source === "local"} onClick={() => setSource("local")}>Datos locales</button></div>
    {source === "local" ? <><p className="text-sm text-[var(--muted)]">Fichaje guardado en este navegador, separado del equipo de la cafetería.</p><AttendanceManager /></> : <>
      {workspaces.length > 1 && <label>Cafetería <select aria-label="Cafetería" value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {checking && <p role="status">Cargando fichaje…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error} <button type="button" className="button" onClick={() => setRevision((value) => value + 1)}>Verificar</button></p>}
      {people && <AttendanceManager remote={{ members, clock, disabled: checking }} />}
    </>}
  </div>;
}
