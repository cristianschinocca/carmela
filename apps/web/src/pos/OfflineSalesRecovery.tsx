import { useRef, useState, type FormEvent } from "react";
import { money } from "../data";
import { saleJournal, type OfflineSale } from "./offline/saleJournal";
import { submitOfflineSale, withSettlementLock } from "./serverAccountClient";

export function OfflineSalesRecovery({ initial, onResolved }: { initial: OfflineSale[]; onResolved: () => void }) {
  const [sales, setSales] = useState(initial);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const sale = sales[0];
  const synchronize = async (event: FormEvent) => {
    event.preventDefault();
    if (!sale || lock.current || !/^\d{4}$/.test(pin)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await withSettlementLock(sale.workspace, async () => {
        const pending = await saleJournal.list(sale.userId, sale.workspace);
        if (!pending.length || pending[0].settlement.id !== sale.settlement.id) throw new Error("Los cobros pendientes cambiaron en otra pestaña. Actualizá la pantalla.");
        await submitOfflineSale(sale.workspace, sale, pin);
        await saleJournal.remove(sale);
        setSales(await saleJournal.list(sale.userId, sale.workspace)); setPin("");
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo sincronizar el cobro."); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!sale) return <section className="panel grid gap-4 !p-6"><p role="status">Los cobros pendientes se sincronizaron.</p><button className="button primary w-fit" onClick={onResolved}>Continuar</button></section>;
  const total = sale.account.items.reduce((sum, line) => sum + line.quantity * (line.unitPrice - line.unitDiscount), 0) - sale.account.discount;
  return <section className="panel grid gap-4 !p-6" aria-labelledby="offline-sales-title">
    <h2 id="offline-sales-title">Sincronizar cobros pendientes</h2>
    <p className="text-sm text-[var(--muted)]">Hay {sales.length} cobro(s) registrado(s) durante el corte. Sincronizalos en orden antes de continuar.</p>
    <div className="rounded-lg border border-[var(--border)] p-4 text-sm"><strong>{sale.name} · {money(total)}</strong><p className="mt-1 text-[var(--muted)]">{sale.settlement.payment} · {new Date(sale.occurredAt).toLocaleString("es-AR")} · {sale.operatorName}</p><ul className="mt-3 grid gap-1">{sale.account.items.map((line) => <li key={line.id}>{line.quantity} × {sale.productNames?.[line.productId] ?? "Producto no disponible"} · {money(line.unitPrice - line.unitDiscount)} por unidad{line.note ? ` · ${line.note}` : ""}</li>)}</ul>{sale.account.discount > 0 && <p className="mt-2 text-[var(--muted)]">Descuento de la cuenta: {money(sale.account.discount)}</p>}</div>
    <form onSubmit={(event) => void synchronize(event)} className="grid max-w-xs gap-3"><label className="field">Código de {sale.operatorName}<input required autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label><button className="button primary w-fit" disabled={busy || pin.length !== 4}>Sincronizar cobro</button></form>
    {error && <p role="alert" className="text-sm text-red-500">{error} El cobro permanece guardado en este dispositivo.</p>}
  </section>;
}
