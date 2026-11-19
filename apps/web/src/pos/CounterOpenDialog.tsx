import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { AccountRequestError, type ServerEmployee } from "./serverAccountClient";

export function CounterOpenDialog({ userId, workspace, employees, onClose, onOpened }: { userId: string; workspace: string; employees: ServerEmployee[]; onClose: () => void; onOpened: (clientKey: string) => void }) {
  const key = `mistro.pos.counter.pending.${encodeURIComponent(userId)}.${encodeURIComponent(workspace)}`;
  const [pending, setPending] = useState<{ id: string; operatorId: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null") as { id: string; operatorId: string } | null; } catch { return null; }
  });
  const [operatorId, setOperatorId] = useState(pending?.operatorId ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onClose]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !operatorId || !/^\d{4}$/.test(pin)) return;
    const operation = pending ?? { id: crypto.randomUUID(), operatorId };
    setBusy(true); setError("");
    try {
      localStorage.setItem(key, JSON.stringify(operation)); setPending(operation);
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace)}/pos/counter`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...operation, employeePin: pin }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new AccountRequestError(body?.error || "No se pudo abrir la cuenta.", response.status); }
      const result = await response.json() as { clientKey: string };
      localStorage.removeItem(key); onOpened(result.clientKey);
    } catch (reason) {
      if (reason instanceof AccountRequestError && reason.status >= 400 && reason.status < 500 && reason.status !== 429 && !pending) { localStorage.removeItem(key); setPending(null); }
      setError(reason instanceof Error ? reason.message : "No se pudo confirmar la apertura. Reintentá con el mismo responsable.");
    } finally { setBusy(false); }
  };
  return <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="counter-open-title" className="acrylic-modal w-[min(420px,calc(100vw-32px))] p-6">
    <header className="flex items-center justify-between gap-4"><h2 id="counter-open-title" className="text-lg font-semibold">Abrir cuenta de mostrador</h2><button type="button" className="icon-btn" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={19} /></button></header>
    <form className="mt-5 grid gap-4" onSubmit={submit}>
      {pending && <p role="status" className="text-sm">Hay una apertura pendiente de confirmar. Reintentá con el código del mismo responsable.</p>}
      <label className="field">Responsable<select value={operatorId} disabled={busy || !!pending} required onChange={(event) => setOperatorId(event.target.value)}><option value="">Seleccioná un empleado</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label className="field">Código de cuatro números<input autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button className="button primary" disabled={busy || !operatorId || pin.length !== 4}>{pending ? "Reintentar apertura" : "Abrir cuenta"}</button>
    </form>
  </section></div>;
}
