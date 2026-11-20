import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { PendingAccountReview } from "./PendingAccountReview";
import { accountDraft } from "./offline/accountDraft";
import { accountJournal } from "./offline/accountJournal";
import { saleJournal } from "./offline/saleJournal";
import { money } from "../data";
import type { CatalogProduct } from "../features/catalog/catalogClient";
import { AccountRequestError, accountClient, formatSettlementAmount, pendingSettlements, settlementKey, submitSettlement, withSettlementLock, type AccountOperation, type SettlementOperation, type ServerAccount, type ServerEmployee, type ServerLine } from "./serverAccountClient";

type Props = { account: ServerAccount; workspace: string; userId: string; name: string; employees: ServerEmployee[]; products: CatalogProduct[]; offline?: boolean; onClose: () => void; onSaved: () => void };
export function ServerAccountEditor({ account, workspace, userId, name, employees, products, offline = false, onClose, onSaved }: Props) {
  const pendingKey = `mistro.pos.account.pending.${userId}.${workspace}.${account.id}`;
  const [operatorId, setOperatorId] = useState(account.operator?.id ?? "");
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<SettlementOperation["payment"]>("Efectivo");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [settledTotal, setSettledTotal] = useState<string | null>(null);
  const [guests, setGuests] = useState(account.guests || (account.items.length ? 0 : 2));
  const [discount, setDiscount] = useState(account.discount);
  const [items, setItems] = useState<ServerLine[]>(account.items);
  const [productId, setProductId] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<ServerAccount | null | undefined>(undefined);
  const [journalReady, setJournalReady] = useState(false);
  const scope = { userId, workspace, tableId: account.id };
  useEffect(() => {
    let active = true;
    const currentScope = { userId, workspace, tableId: account.id };
    void accountJournal.migrateLegacy(currentScope, pendingKey).then(async (value) => {
      const savedDraft = await accountDraft.read(currentScope);
      if (value && savedDraft) throw new Error("Hay dos operaciones locales para esta mesa.");
      if (active) { setPending(value); setDraft(savedDraft); setJournalReady(true); }
    })
      .catch(() => { if (active) setError("No se pudo acceder al almacenamiento local. No se enviarán cambios para evitar pérdidas."); });
    return () => { active = false; };
  }, [userId, workspace, account.id, pendingKey]);
  const saved = pending ?? draft;
  const pendingOperation = (() => { try { return saved ? JSON.parse(saved) as AccountOperation : null; } catch { return null; } })();
  const modal = useRef<HTMLElement>(null);
  const employee = employees.find((person) => person.id === operatorId);
  const changed = guests !== account.guests || discount !== account.discount || JSON.stringify(items) !== JSON.stringify(account.items);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * (item.unitPrice - item.unitDiscount), 0);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; modal.current?.focus(); return () => previous?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !lock.current) { event.preventDefault(); if (settledTotal !== null) onSaved(); else onClose(); } };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSaved, settledTotal]);
  const verify = async (event: FormEvent) => {
    event.preventDefault(); if (!employee || !journalReady || lock.current || (!offline && !/^\d{4}$/.test(pin))) return;
    if (offline) { setVerified(true); return; }
    lock.current = true; setBusy(true); setError("");
    try { await accountClient.verify(workspace, employee.legacyId, pin); setVerified(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo verificar el código."); setPin(""); }
    finally { lock.current = false; setBusy(false); }
  };
  const submitOperation = async (operation: AccountOperation) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const serialized = JSON.stringify(operation);
      if (offline) { await accountDraft.save(scope, operation, draft); onSaved(); return; }
      await withSettlementLock(workspace, async () => {
        if ((await saleJournal.list(userId, workspace)).length || await saleJournal.hasOtherUser(userId, workspace)) throw new Error("Hay cobros sin conexión pendientes de sincronizar. Volvé al plano para revisarlos.");
        await accountJournal.queue(scope, operation);
        setPending(serialized);
        await accountClient.save(workspace, operation, pin);
        await accountJournal.remove(scope, serialized); setPending(null); onSaved();
      });
    } catch (reason) {
      if (reason instanceof AccountRequestError && (reason.status === 409 || reason.status === 404)) {
        setConflict(true);
        try { setCurrentAccount((await accountClient.list(workspace)).find((item) => item.id === account.id) ?? null); }
        catch { setCurrentAccount(undefined); }
      }
      setError(reason instanceof TypeError ? "El guardado quedó pendiente en este dispositivo. Conectate y reintentá antes de cobrar." : reason instanceof Error ? reason.message : "No se pudo confirmar el guardado. Reintentá la misma operación.");
    } finally { lock.current = false; setBusy(false); }
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(guests) || guests < 0 || guests > 1000 || !Number.isSafeInteger(discount) || discount < 0 || discount > subtotal || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 2147483647 || !Number.isSafeInteger(item.unitDiscount) || item.unitDiscount < 0 || item.unitDiscount > item.unitPrice)) { setError("Revisá las cantidades, los precios y el descuento."); return; }
    void submitOperation({ id: pendingOperation?.id ?? crypto.randomUUID(), tableId: account.id, expectedVersion: pendingOperation?.expectedVersion ?? account.version, guests, discount, billRequested: changed ? false : account.billRequested, operatorId: employee.id, items: items.map(({ id, productId: product, quantity, unitPrice, unitDiscount, note }) => ({ id, productId: product, quantity, unitPrice, unitDiscount, note })) });
  };
  const close = () => { if (settledTotal !== null) onSaved(); else onClose(); };
  const checkout = async () => {
    if (lock.current || !employee || (!offline && (!account.operator || changed)) || !items.length || pending || !Number.isSafeInteger(subtotal)) return;
    lock.current = true; setBusy(true); setError("");
    let key = "";
    let persisted = false;
    try {
      await withSettlementLock(workspace, async () => {
        if (offline) {
          if (!Number.isSafeInteger(guests) || guests < 0 || guests > 1000 || !Number.isSafeInteger(discount) || discount < 0 || discount > subtotal || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 2147483647 || !Number.isSafeInteger(item.unitDiscount) || item.unitDiscount < 0 || item.unitDiscount > item.unitPrice)) throw new Error("Revisá las cantidades, los precios y el descuento.");
          const operation: AccountOperation = { id: pendingOperation?.id ?? crypto.randomUUID(), tableId: account.id, expectedVersion: account.version, guests, discount, billRequested: false, operatorId: employee.id, items: items.map(({ id, productId, quantity, unitPrice, unitDiscount, note }) => ({ id, productId, quantity, unitPrice, unitDiscount, note })) };
          await saleJournal.queue(scope, name, operation, payment, draft);
          setDraft(null); onSaved(); return;
        }
        if ((await saleJournal.list(userId, workspace)).length || await saleJournal.hasOtherUser(userId, workspace)) throw new Error("Hay cobros sin conexión pendientes de sincronizar. Volvé al plano para revisarlos.");
        if (await accountDraft.read(scope)) throw new Error("Hay un borrador pendiente en esta mesa. Sincronizalo antes de cobrar.");
        if (await accountJournal.read(scope)) throw new Error("Hay un guardado pendiente en esta mesa. Reabrí la cuenta para revisarlo antes de cobrar.");
        if (pendingSettlements(userId, workspace).length) throw new Error("Hay un cobro pendiente de verificar antes de continuar.");
        const expectedShiftId = await accountClient.currentShiftId(workspace);
        const operation: SettlementOperation = { id: crypto.randomUUID(), tableId: account.id, expectedVersion: account.version, payment, operatorId: employee.id, tableName: name, expectedShiftId };
        key = settlementKey(userId, workspace, operation.id);
        localStorage.setItem(key, JSON.stringify(operation));
        persisted = true;
        try {
          const result = await submitSettlement(workspace, operation, pin);
          localStorage.removeItem(key);
          setSettledTotal(result.total);
        } catch (reason) {
          if (reason instanceof AccountRequestError && reason.status >= 400 && reason.status < 500) { localStorage.removeItem(key); key = ""; persisted = false; }
          throw reason;
        }
      });
    } catch (reason) {
      if (reason instanceof AccountRequestError && reason.status >= 400 && reason.status < 500) { if (key) localStorage.removeItem(key); setError(reason.message); }
      else if (persisted) { onSaved(); }
      else setError(reason instanceof Error ? reason.message : "No se pudo iniciar el cobro.");
    } finally { lock.current = false; setBusy(false); }
  };
  const retry = async () => {
    if (!saved || !pendingOperation || lock.current) return;
    if (pendingOperation.tableId !== account.id || pendingOperation.operatorId !== operatorId) {
      setConflict(true); setCurrentAccount(account);
      setError("El responsable de la cuenta cambió. Revisá el borrador y la cuenta actual."); return;
    }
    if (draft) {
      lock.current = true; setBusy(true);
      try { await accountDraft.stage(scope, draft); setDraft(null); setPending(draft); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo preparar la sincronización."); return; }
      finally { lock.current = false; setBusy(false); }
    }
    await submitOperation(pendingOperation);
  };
  const editDraft = () => {
    if (!draft || !pendingOperation || pendingOperation.tableId !== account.id) return;
    setOperatorId(pendingOperation.operatorId);
    setGuests(pendingOperation.guests); setDiscount(pendingOperation.discount);
    setItems(pendingOperation.items.map((item) => ({ ...item, productLegacyId: products.find((product) => product.id === item.productId)?.legacyId ?? account.items.find((line) => line.productId === item.productId)?.productLegacyId ?? 0 })));
    setEditingDraft(true);
  };
  const discardPending = async () => {
    if (!saved || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const remaining = draft ? await accountDraft.remove(scope, draft) : await accountJournal.remove(scope, saved);
      if (remaining !== null) throw new Error("El borrador cambió en otra pestaña. Reabrí la cuenta antes de descartarlo.");
      setPending(null); setDraft(null); onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo descartar el borrador."); }
    finally { lock.current = false; setBusy(false); }
  };
  const update = (id: string, change: Partial<ServerLine>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
  const add = () => {
    const product = products.find((item) => item.id === productId && item.available);
    if (!product || items.length >= 500) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), productId: product.id, productLegacyId: product.legacyId, quantity: 1, unitPrice: product.price, unitDiscount: 0, note: "" }]); setProductId("");
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="server-account-title" className="acrylic-modal w-[min(780px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4"><div><h2 id="server-account-title" className="text-xl font-semibold">{name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{offline ? "Borrador local · pendiente de verificación" : "Cuenta guardada en la cafetería"}</p></div><button type="button" className="icon-btn" aria-label="Cerrar cuenta" disabled={busy} onClick={close}><X size={19} /></button></header>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      {settledTotal !== null ? <div className="mt-5 grid gap-4"><p role="status" className="text-sm">Cobro registrado por {formatSettlementAmount(settledTotal)}. La mesa quedó cerrada.</p><button type="button" className="button primary w-fit" onClick={onSaved}>Volver al plano</button></div> : !verified ? <form onSubmit={verify} className="mt-5 grid gap-3">
        <p className="text-sm">{offline ? "Seleccioná el responsable. El código se verificará al sincronizar; este borrador no es una comanda confirmada." : "Ingresá el código del responsable para gestionar la cuenta."}</p>
        <label className="field">Responsable<select required disabled={!!account.operator || busy} value={operatorId} onChange={(event) => setOperatorId(event.target.value)}><option value="">Seleccioná un empleado</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        {account.operator && !employee && <p role="alert" className="text-sm">El responsable está inactivo o no está disponible. No se modificó la cuenta.</p>}
        {!offline && <label className="field">Código de cuatro números<input autoFocus type="password" inputMode="numeric" autoComplete="off" value={pin} maxLength={4} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>}
        <button className="button primary w-fit" disabled={busy || !journalReady || !employee || (!offline && pin.length !== 4)}>Continuar</button>
      </form> : <>
        {saved && !editingDraft ? pendingOperation ? <PendingAccountReview operation={pendingOperation} current={currentAccount} conflict={conflict} offline={offline} busy={busy} products={products} onRetry={() => void retry()} onDiscard={() => void discardPending()} editable={!!draft} onEdit={editDraft} /> : <p role="alert" className="mt-5 text-sm">No se puede leer el borrador. Sus datos se conservaron en este dispositivo.</p> : <form onSubmit={save} className="mt-5 grid gap-4">
          <label className="field">Cubiertos<input type="number" min={0} max={1000} step={1} required value={guests} onChange={(event) => setGuests(Number(event.target.value))} /></label>
          <div className="grid gap-3">{items.map((item) => <div key={item.id} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_75px_100px_100px_auto] sm:items-end">
            <strong className="text-sm">{products.find((product) => product.id === item.productId)?.name ?? "Producto no disponible"}</strong>
            <label className="field">Cantidad<input aria-label="Cantidad" type="number" min={1} max={10000} step={1} required value={item.quantity} onChange={(event) => update(item.id, { quantity: Number(event.target.value) })} /></label>
            <label className="field">Precio<input aria-label="Precio" type="number" min={0} max={2147483647} step={1} required value={item.unitPrice} onChange={(event) => update(item.id, { unitPrice: Number(event.target.value) })} /></label>
            <label className="field">Descuento<input aria-label="Descuento del artículo" type="number" min={0} max={item.unitPrice} step={1} required value={item.unitDiscount} onChange={(event) => update(item.id, { unitDiscount: Number(event.target.value) })} /></label>
            <button type="button" className="button" aria-label="Quitar artículo" onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))}><Trash2 size={15} /></button>
            <label className="field sm:col-span-5">Aclaración<input maxLength={500} value={item.note} onChange={(event) => update(item.id, { note: event.target.value })} /></label>
          </div>)}</div>
          <div className="flex flex-wrap items-end gap-2"><label className="field min-w-[180px] flex-1">Agregar producto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Seleccioná un producto</option>{products.filter((product) => product.available).map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select></label><button type="button" className="button" disabled={!productId} onClick={add}><Plus size={15} /> Agregar</button></div>
          <label className="field">Descuento de la cuenta ($)<input type="number" min={0} max={subtotal} step={1} required value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><strong>Total {money(Math.max(0, subtotal - discount))}</strong><div className="flex gap-2"><button className="button" disabled={busy}>{offline ? "Guardar borrador" : "Guardar cuenta"}</button><button type="button" className="button primary" disabled={busy || (!offline && (changed || !account.operator)) || !items.length || !Number.isSafeInteger(subtotal)} onClick={() => setConfirmingPayment(true)}>Cobrar</button></div></div>
          {!Number.isSafeInteger(subtotal) && <p role="alert" className="text-xs text-red-500">El importe supera el máximo que esta pantalla puede manejar.</p>}
          {changed && !offline && <p className="text-xs text-[var(--muted)]">Guardá los cambios antes de cobrar.</p>}
          {!account.operator && !offline && <p className="text-xs text-[var(--muted)]">Guardá la cuenta para asignar al responsable antes de cobrar.</p>}
          {confirmingPayment && <div className="grid gap-3 rounded-xl border border-[var(--border)] p-4">{offline && <p className="text-sm">El cobro quedará guardado en esta PC y pendiente de sincronización. El responsable deberá ingresar su código cuando vuelva la conexión.</p>}<label className="field">Medio de pago<select value={payment} onChange={(event) => setPayment(event.target.value as SettlementOperation["payment"])}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label><div className="flex flex-wrap gap-2"><button type="button" className="button primary" disabled={busy || (!offline && changed)} onClick={() => void checkout()}>Confirmar cobro {money(Math.max(0, subtotal - discount))}</button><button type="button" className="button" disabled={busy} onClick={() => setConfirmingPayment(false)}>Volver</button></div></div>}
        </form>}
      </>}
    </section>
  </div>;
}
