import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, Plus, RotateCw } from 'lucide-react';
import { catalogClient, type CatalogWorkspace } from '../catalog/catalogClient';
import { money } from '../../data';

type Person = { id: string; name: string; active: boolean };
type Movement = { id: string; version: number; kind: Kind; direction: 'in' | 'out'; amount: string; payment: Payment; concept: string; party: string; receipt: string; employeeId: string | null; employeePayment: EmployeePayment | null; voidedAt: string | null; createdAt: string };
type Shift = { id: string; version: number; openingAmount: string; expectedAmount: string; cashSales: string; movements: Movement[] };
type Kind = 'gasto' | 'proveedor' | 'empleado' | 'retiro' | 'ajuste';
type Payment = 'Efectivo' | 'Tarjeta' | 'Transferencia';
type EmployeePayment = { type: string; periodStart: string; periodEnd: string; paidAt: string };
type Draft = { kind: Kind; direction: 'in' | 'out'; amount: string; payment: Payment; concept: string; party: string; receipt: string; employeeId: string; employeePayment: EmployeePayment };
const labels: Record<Kind, string> = { gasto: 'Gasto vario', proveedor: 'Pago a proveedor', empleado: 'Pago a empleado', retiro: 'Retiro', ajuste: 'Ajuste de caja' };
const empty = (): Draft => ({ kind: 'gasto', direction: 'out', amount: '', payment: 'Efectivo', concept: '', party: '', receipt: '', employeeId: '', employeePayment: { type: 'Sueldo', periodStart: '', periodEnd: '', paidAt: '' } });
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw Object.assign(new Error(data?.error || 'No se pudo acceder a caja.'), { status: response.status }); }
  return response.json() as Promise<T>;
}
export function ConnectedCashRegister({ open, userId, onClose, onLocal }: { open: boolean; userId: string; onClose: () => void; onLocal: () => void }) {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState('');
  const [shift, setShift] = useState<Shift | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingRequest = useRef(false);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [revision, setRevision] = useState(0);
  const pendingKey = `mistro.cash.pending.${userId}.${workspace}`;
  const base = `/api/workspaces/${encodeURIComponent(workspace)}`;
  const pending = workspace ? sessionStorage.getItem(pendingKey) : null;
  useEffect(() => {
    if (!open) return;
    let active = true; setError('');
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === 'active'); setWorkspaces(available);
      const last = localStorage.getItem(`mistro.pos.workspace.${userId}`);
      if (available.length === 1) setWorkspace(available[0].id);
      else if (last && available.some((item) => item.id === last)) setWorkspace(last);
      else if (!available.length) setError('No hay una cafetería activa vinculada a esta cuenta.');
    }).catch(() => { if (active) setError('No se pudieron cargar las cafeterías.'); });
    return () => { active = false; };
  }, [open, userId]);
  useEffect(() => {
    if (!open || !workspace) return;
    let active = true; setLoaded(false);
    void Promise.all([request<Shift | null>(`${base}/cash/current`), request<Person[]>(`${base}/team/employees`)]).then(([current, employees]) => {
      if (active) { setShift(current); setPeople(employees.filter((person) => person.active)); setLoaded(true); }
    }).catch(() => { if (active) setError('No se pudo cargar la caja. Revisá la conexión.'); });
    return () => { active = false; };
  }, [open, workspace, base, revision]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) { if (draft) setDraft(null); else onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, draft, onClose]);
  if (!open) return null;
  const perform = async (operation: unknown, retry = false) => {
    if (pendingRequest.current || !workspace) return;
    const saved = retry ? sessionStorage.getItem(pendingKey) : JSON.stringify(operation);
    if (!saved) return;
    if (!retry && sessionStorage.getItem(pendingKey)) { setError('Primero resolvé el movimiento pendiente.'); return; }
    sessionStorage.setItem(pendingKey, saved); pendingRequest.current = true; setBusy(true); setError('');
    try {
      await request(`${base}/cash/operations`, JSON.parse(saved));
      sessionStorage.removeItem(pendingKey); setDraft(null); setEditing(null); setOpening(''); setRevision((value) => value + 1);
    } catch (reason) {
      const status = (reason as { status?: number }).status;
      if (!retry && status && status >= 400 && status < 500) { sessionStorage.removeItem(pendingKey); setRevision((value) => value + 1); }
      setError(reason instanceof Error ? reason.message : 'No se pudo confirmar. Reintentá la misma operación.');
    } finally { pendingRequest.current = false; setBusy(false); }
  };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!draft || !shift) return;
    const employee = people.find((person) => person.id === draft.employeeId);
    const movement = { kind: draft.kind, direction: draft.kind === 'ajuste' ? draft.direction : 'out', amount: Number(draft.amount), payment: draft.kind === 'ajuste' || draft.kind === 'retiro' ? 'Efectivo' : draft.payment, concept: draft.concept, party: draft.kind === 'empleado' ? employee?.name ?? '' : draft.party, receipt: draft.receipt, ...(draft.kind === 'empleado' ? { employeeId: draft.employeeId, employeePayment: draft.employeePayment } : {}) };
    void perform({ id: crypto.randomUUID(), action: editing ? 'edit' : 'record', shiftId: shift.id, expectedVersion: shift.version, movementId: editing?.id ?? crypto.randomUUID(), ...(editing ? { movementVersion: editing.version } : {}), movement });
  };
  const changeKind = (kind: Kind) => setDraft({ ...empty(), kind, concept: kind === 'empleado' ? 'Sueldo' : '' });
  const edit = (item: Movement) => { setEditing(item); setDraft({ kind: item.kind, direction: item.direction, amount: item.amount, payment: item.payment, concept: item.concept, party: item.party, receipt: item.receipt, employeeId: item.employeeId ?? '', employeePayment: item.employeePayment ?? empty().employeePayment }); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="server-cash-title" className="acrylic-modal w-[min(1050px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4"><div><h2 id="server-cash-title" className="text-xl font-semibold">Caja</h2><p className="mt-1 text-sm text-[var(--muted)]">Movimientos de la cafetería seleccionada.</p></div><button type="button" aria-label="Cerrar caja" className="icon-btn" disabled={busy} onClick={onClose}><X size={19} /></button></header>
      {workspaces.length > 1 && <label className="field mt-4">Cafetería<select value={workspace} disabled={busy || !!pending} onChange={(event) => { setWorkspace(event.target.value); setDraft(null); setShift(null); setError(''); }}><option value="">Seleccioná una cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button type="button" className="mt-3 text-xs underline text-[var(--muted)]" onClick={onLocal}>Ver caja local anterior</button>
      <p className="mt-4 rounded-lg border border-[var(--border)] p-3 text-xs text-[var(--muted)]">El saldo incluye los cobros confirmados por el servidor. Los cobros hechos en este navegador todavía no se sincronizan. El cierre estará disponible cuando se complete la integración.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error} <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Actualizar</button></p>}
      {pending && <div role="status" className="mt-3 text-sm">Hay una operación pendiente de confirmar. <button type="button" className="button" disabled={busy} onClick={() => void perform(null, true)}><RotateCw size={15} /> Reintentar</button></div>}
      {!loaded && workspace && !error && <p className="mt-4" role="status">Cargando caja…</p>}
      {loaded && !shift && <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void perform({ id: crypto.randomUUID(), action: 'open', openingAmount: Number(opening) }); }}><label className="field">Fondo inicial en efectivo<input type="number" min="0" step="1" required value={opening} onChange={(event) => setOpening(event.target.value)} /></label><button className="button primary" disabled={busy || !!pending}>Abrir caja</button></form>}
      {loaded && shift && <>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4"><span className="text-sm">Efectivo registrado <strong className="ml-2 text-lg">{money(Number(shift.expectedAmount))}</strong></span><span className="text-xs text-[var(--muted)]">Fondo inicial: {money(Number(shift.openingAmount))} · Ventas confirmadas en efectivo: {money(Number(shift.cashSales ?? 0))}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{(Object.keys(labels) as Kind[]).map((kind) => <button key={kind} type="button" className="button" disabled={busy || !!pending} onClick={() => { setEditing(null); changeKind(kind); }}><Plus size={14} /> {labels[kind]}</button>)}</div>
        {draft && <form onSubmit={save} className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">{editing ? 'Editar' : 'Registrar'} · {labels[draft.kind]}</h3>
          {draft.kind === 'empleado' && <><label className="field">Empleado<select required value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">Seleccioná un empleado</option>{people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label className="field">Tipo<select value={draft.employeePayment.type} onChange={(event) => setDraft({ ...draft, concept: event.target.value, employeePayment: { ...draft.employeePayment, type: event.target.value } })}><option>Sueldo</option><option>Adelanto</option><option>Otro</option></select></label>{(['periodStart','periodEnd','paidAt'] as const).map((key) => <label key={key} className="field">{key === 'periodStart' ? 'Período desde' : key === 'periodEnd' ? 'Período hasta' : 'Fecha de pago'}<input type="date" required value={draft.employeePayment[key]} onChange={(event) => setDraft({ ...draft, employeePayment: { ...draft.employeePayment, [key]: event.target.value } })} /></label>)}</>}
          {draft.kind !== 'empleado' && <><label className="field">Concepto<input required maxLength={200} value={draft.concept} onChange={(event) => setDraft({ ...draft, concept: event.target.value })} /></label>{(draft.kind === 'proveedor' || draft.kind === 'retiro') && <label className="field">{draft.kind === 'proveedor' ? 'Proveedor' : 'Destino'}<input required maxLength={120} value={draft.party} onChange={(event) => setDraft({ ...draft, party: event.target.value })} /></label>}</>}
          <label className="field">Importe<input required type="number" min="1" max="1000000000000" step="1" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          {draft.kind === 'ajuste' ? <label className="field">Tipo de ajuste<select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as 'in' | 'out' })}><option value="in">Entrada</option><option value="out">Salida</option></select></label> : draft.kind !== 'retiro' && <label className="field">Medio de pago<select value={draft.payment} onChange={(event) => setDraft({ ...draft, payment: event.target.value as Payment })}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>}
          <label className="field">Comprobante (opcional)<input maxLength={120} value={draft.receipt} onChange={(event) => setDraft({ ...draft, receipt: event.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-2"><button type="submit" className="button primary" disabled={busy || !!pending}>Guardar movimiento</button><button type="button" className="button" disabled={busy} onClick={() => setDraft(null)}>Cancelar</button></div>
        </form>}
        <h3 className="mt-6 font-semibold">Movimientos</h3><div className="mt-2 divide-y divide-[var(--border)]">{shift.movements.length ? [...shift.movements].reverse().map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{labels[item.kind]} · {item.concept}</strong><p className="text-xs text-[var(--muted)]">{item.party} {item.payment} {item.voidedAt ? '· Anulado' : ''}</p></div><div className="flex items-center gap-2"><span>{item.direction === 'in' ? '+' : '−'} {money(Number(item.amount))}</span>{!item.voidedAt && <><button type="button" className="button" disabled={busy || !!pending} onClick={() => edit(item)}>Editar</button><button type="button" className="button" disabled={busy || !!pending} onClick={() => { if (window.confirm('¿Anular este movimiento?')) void perform({ id: crypto.randomUUID(), action: 'void', shiftId: shift.id, expectedVersion: shift.version, movementId: item.id, movementVersion: item.version }); }}>Anular</button></>}</div></div>) : <p className="py-5 text-sm text-[var(--muted)]">Todavía no hay movimientos registrados.</p>}</div>
      </>}
    </section>
  </div>;
}
