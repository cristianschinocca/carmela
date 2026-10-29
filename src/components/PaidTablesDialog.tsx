import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ReceiptText, X } from "lucide-react";
import { money } from "../data";
import { modalVariants, overlayVariants } from "../motion";
import { loadSales, updateSalePayment, type SaleRecord } from "../stores/sales";

type Props = { open: boolean; onClose: () => void };
export function PaidTablesDialog({ open, onClose }: Props) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payment, setPayment] = useState("");
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const today = new Date().toDateString();
    setSales(loadSales().filter((sale) => new Date(sale.closedAt).toDateString() === today));
    setSelectedId(null);
    setMessage("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open]);
  const selectSale = (sale: SaleRecord) => {
    setSelectedId(selectedId === sale.id ? null : sale.id);
    setPayment(sale.payment);
    setMessage("");
  };
  const savePayment = (sale: SaleRecord) => {
    try {
      if (!updateSalePayment(sale.id, payment)) throw new Error("Venta no encontrada");
      setSales((current) => current.map((item) => item.id === sale.id ? { ...item, payment } : item));
      setMessage("Medio de pago actualizado.");
    } catch {
      setMessage("No se pudo guardar el cambio. Intentá nuevamente.");
    }
  };
  return <AnimatePresence>{open && <motion.div className="modal-backdrop paid-tables-backdrop" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
    <motion.section className="acrylic-modal paid-tables-modal" role="dialog" aria-modal="true" aria-labelledby="paid-tables-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()}>
      <header className="paid-tables-header"><div><span className="eyebrow">VENTAS</span><h2 id="paid-tables-title">Mesas cobradas hoy</h2><p>Seleccioná una cuenta para ver su detalle.</p></div><button ref={closeRef} className="cash-main-close" aria-label="Cerrar mesas cobradas" onClick={onClose}><X size={19} /></button></header>
      <div className="paid-tables-summary"><span>{sales.length} {sales.length === 1 ? "cuenta cobrada" : "cuentas cobradas"}</span><strong>{money(sales.reduce((sum, sale) => sum + sale.total, 0))}</strong></div>
      {sales.length ? <div className="paid-tables-list">{sales.map((sale) => <div className="paid-table-entry" key={sale.id}>
        <button className="paid-table-row" aria-expanded={selectedId === sale.id} onClick={() => selectSale(sale)}><span className="paid-table-icon"><ReceiptText size={17} /></span><span className="paid-table-copy"><strong>{sale.tableName}</strong><small>{new Date(sale.closedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {sale.payment}</small></span><b>{money(sale.total)}</b><ChevronDown className="paid-table-chevron" size={16} aria-hidden="true" /></button>
        {selectedId === sale.id && <div className="paid-table-details">
          <strong>Consumos</strong>
          {sale.items.length ? <div className="paid-items">{sale.items.map((item, index) => <div className="paid-item" key={`${item.productId}-${index}`}><span><b>{item.quantity} ×</b> {item.name}{item.note && <small>{item.note}</small>}</span><strong>{money(item.quantity * item.unitPrice)}</strong></div>)}</div> : <p>Esta cuenta no tiene detalle de productos.</p>}
          <div className="paid-totals"><span>Subtotal <strong>{money(sale.subtotal)}</strong></span>{sale.discount > 0 && <span>Descuento <strong>− {money(sale.discount)}</strong></span>}<span>Total <strong>{money(sale.total)}</strong></span></div>
          <div className="paid-payment"><label>Medio de pago<select value={payment} onChange={(event) => { setPayment(event.target.value); setMessage(""); }}><option value="Efectivo">Efectivo</option><option value="Tarjeta">Tarjeta</option><option value="Transferencia">Transferencia</option>{!["Efectivo", "Tarjeta", "Transferencia"].includes(sale.payment) && <option value={sale.payment}>{sale.payment}</option>}</select></label><button className="button" disabled={payment === sale.payment} onClick={() => savePayment(sale)}>Guardar</button></div>
          {message && <p className="paid-payment-message" role="status">{message}</p>}
        </div>}
      </div>)}</div> : <div className="paid-tables-empty"><ReceiptText size={22} /><strong>Todavía no hay mesas cobradas</strong><p>Las cuentas que cierres hoy van a aparecer acá.</p></div>}
    </motion.section>
  </motion.div>}</AnimatePresence>;
}
