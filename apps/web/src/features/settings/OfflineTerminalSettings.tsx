import { useEffect, useState } from "react";
import { Laptop, LoaderCircle } from "lucide-react";
import { catalogClient, type CatalogWorkspace } from "../catalog/catalogClient";

type Identity = { deviceId: string; token: string };
type Status = { registered: boolean; isCurrent: boolean; registeredAt: string | null };
const identityKey = (workspace: string) => `mistro.offline-terminal.${encodeURIComponent(workspace)}`;
function loadIdentity(key: string): Identity | null {
  try { const value = JSON.parse(localStorage.getItem(key) ?? "null") as Identity | null; return value && typeof value.deviceId === "string" && /^[a-f0-9]{64}$/.test(value.token) ? value : null; } catch { return null; }
}
function createIdentity(): Identity {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return { deviceId: crypto.randomUUID(), token: Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("") };
}
async function request(workspace: string, identity: Identity | null, method: "GET" | "POST"): Promise<Status> {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace)}/offline-terminal`, {
    method, credentials: "same-origin", cache: "no-store",
    headers: method === "POST" ? { "Content-Type": "application/json" } : identity ? { "x-terminal-id": identity.deviceId, "x-terminal-token": identity.token } : {},
    ...(method === "POST" ? { body: JSON.stringify(identity) } : {}),
  });
  if (!response.ok) { const result = await response.json().catch(() => null) as { error?: string } | null; throw new Error(result?.error || "No se pudo consultar la terminal. Revisá la conexión."); }
  return response.json() as Promise<Status>;
}
export function OfflineTerminalSettings({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active"); setWorkspaces(available);
      if (available.length === 1) setWorkspace(available[0].id);
      else if (!available.length) { setError("No hay una cafetería activa disponible."); setLoading(false); }
      else setLoading(false);
    }).catch(() => { if (active) { setError("No se pudieron cargar las cafeterías."); setLoading(false); } });
    return () => { active = false; };
  }, [userId, revision]);
  useEffect(() => {
    let active = true;
    if (!workspace) return;
    setStatus(null); setError(""); setLoading(true);
    void request(workspace, loadIdentity(identityKey(workspace)), "GET")
      .then((value) => { if (active) setStatus(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar la terminal."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, workspace, revision]);
  const register = async () => {
    if (!workspace || busy) return;
    setBusy(true); setError("");
    try {
      const key = identityKey(workspace);
      const identity = loadIdentity(key) ?? createIdentity();
      localStorage.setItem(key, JSON.stringify(identity));
      setStatus(await request(workspace, identity, "POST"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo registrar esta PC."); }
    finally { setBusy(false); }
  };
  return <section className="panel mt-5 !max-w-[650px]" aria-labelledby="offline-terminal-title">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Laptop size={19} aria-hidden="true" /></span><div><h2 id="offline-terminal-title">Terminal sin conexión</h2><p className="mt-1 text-xs text-[var(--muted)]">Identificá la computadora principal de esta cafetería.</p></div></div>
    {workspaces.length > 1 && <label className="field mt-5">Cafetería<select value={workspace} disabled={busy} onChange={(event) => setWorkspace(event.target.value)}><option value="">Seleccioná una cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {loading && <p role="status" className="mt-5 text-xs text-[var(--muted)]">Consultando terminal…</p>}
    {error && <div role="alert" className="mt-5 text-xs text-red-500">{error} <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>}
    {status && <div className="mt-5 border-t border-[var(--border)] pt-4">
      <p className="text-sm font-semibold">{status.isCurrent ? "Esta PC está registrada" : status.registered ? "Otra PC está registrada" : "Sin PC registrada"}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{status.isCurrent ? "Esta identificación corresponde a este navegador. Si borrás sus datos, dejará de reconocerse." : status.registered ? "Ya existe una PC registrada para esta cafetería. El cambio de terminal estará disponible cuando se integren los cobros pendientes." : "Registrá esta PC desde el navegador que usará el local."}</p>
      {!status.registered && <button type="button" className="button mt-4" disabled={busy} onClick={() => void register()}>{busy && <LoaderCircle className="spinner" size={15} />}Registrar esta PC</button>}
    </div>}
    <p className="mt-5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-xs leading-relaxed text-[var(--muted)]">El registro prepara la terminal. Los cobros sin internet y el cambio de PC todavía no están disponibles.</p>
  </section>;
}
