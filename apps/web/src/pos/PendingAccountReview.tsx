import { useState } from "react";
import { money } from "../data";
import type { CatalogProduct } from "../features/catalog/catalogClient";
import type { AccountOperation, ServerAccount } from "./serverAccountClient";

type Summary = Pick<AccountOperation, "guests" | "discount" | "items">;
function AccountSummary({ title, account, products }: { title: string; account: Summary; products: CatalogProduct[] }) {
  const subtotal = account.items.reduce((sum, line) => sum + line.quantity * (line.unitPrice - line.unitDiscount), 0);
  return <section className="rounded-lg border border-[var(--border)] p-3 text-sm">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-2 text-xs text-[var(--muted)]">{account.guests} cubiertos · Descuento {money(account.discount)} · Total {money(Math.max(0, subtotal - account.discount))}</p>
    {account.items.length ? <ul className="mt-2 grid gap-1 text-xs text-[var(--muted)]">{account.items.map((line) => <li key={line.id}>{line.quantity} × {products.find((product) => product.id === line.productId)?.name ?? "Producto no disponible"} · {money(line.unitPrice - line.unitDiscount)} por unidad{line.note ? ` · ${line.note}` : ""}</li>)}</ul> : <p className="mt-2 text-xs text-[var(--muted)]">Sin artículos</p>}
  </section>;
}
export function PendingAccountReview({ operation, current, conflict, offline, busy, products, onRetry, onDiscard, editable, onEdit }: { operation: AccountOperation; current: ServerAccount | null | undefined; conflict: boolean; offline: boolean; busy: boolean; products: CatalogProduct[]; onRetry: () => void; onDiscard: () => void; editable?: boolean; onEdit?: () => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return <div className="mt-5 grid gap-3">
    <p role="status" className="text-sm">{offline ? editable ? "Borrador guardado en este dispositivo. Podés seguir editándolo durante el corte." : "Hay una operación pendiente de confirmar. Conectate para verificarla antes de editar." : conflict ? "No se aplicaron los cambios. Compará el borrador con la cuenta actual antes de continuar." : "Hay cambios pendientes. Revisalos y sincronizalos antes de editar."}</p>
    <div className="grid gap-3 sm:grid-cols-2"><AccountSummary title="Borrador de este dispositivo" account={operation} products={products} />{conflict && (current ? <AccountSummary title="Cuenta actual del servidor" account={current} products={products} /> : <p className="rounded-lg border border-[var(--border)] p-3 text-sm">{current === null ? "La mesa ya no está disponible en el servidor." : "No se pudo consultar la cuenta actual. Reintentá cuando haya conexión."}</p>)}</div>
    {offline && editable && <button type="button" className="button w-fit" disabled={busy} onClick={onEdit}>Editar borrador</button>}
    {!offline && <div className="flex flex-wrap gap-2"><button type="button" className="button primary" disabled={busy || confirmDiscard} onClick={onRetry}>Sincronizar cambios</button>{conflict && !confirmDiscard && <button type="button" className="button" disabled={busy} onClick={() => setConfirmDiscard(true)}>Descartar borrador</button>}</div>}
    {confirmDiscard && <div className="grid gap-3 rounded-lg border border-[var(--border)] p-3 text-sm"><p>Se eliminará el borrador de este dispositivo. La cuenta del servidor no se modificará.</p><div className="flex flex-wrap gap-2"><button type="button" className="button" disabled={busy} onClick={() => setConfirmDiscard(false)}>Conservar borrador</button><button type="button" className="button danger-button" disabled={busy} onClick={onDiscard}>Confirmar descarte</button></div></div>}
  </div>;
}
