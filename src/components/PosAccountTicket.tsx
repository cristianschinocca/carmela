import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, BadgePercent, Check, Minus, MoveRight, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { money, type Product } from "../data";
import { fadeUp } from "../motion";
import type { Line, Table } from "../pos/floorModel";

type TicketLine = { line: Line; product: Product };

type Props = {
  table: Table;
  lines: TicketLine[];
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onEditLine: (line: Line, mode?: "note" | "move") => void;
  onChangeQuantity: (lineId: string, amount: number) => void;
  onMoveTable: () => void;
  onToggleBill: () => void;
  onClearTable: () => void;
  discountOpen: boolean;
  onDiscountOpenChange: (open: boolean) => void;
  confirmClear: boolean;
  onConfirmClearChange: (open: boolean) => void;
  onDiscountChange: (value: number) => void;
  subtotal: number;
  discount: number;
  total: number;
  onOpenPayment: () => void;
};

export default function PosAccountTicket({
  table, lines, selectedLineId, onSelectLine, onEditLine, onChangeQuantity,
  onMoveTable, onToggleBill, onClearTable, discountOpen, onDiscountOpenChange,
  confirmClear, onConfirmClearChange, onDiscountChange, subtotal, discount, total, onOpenPayment,
}: Props) {
  const itemCount = lines.reduce((sum, { line }) => sum + line.quantity, 0);
  const selectedLine = lines.find(({ line }) => line.id === selectedLineId)?.line;

  return (
    <aside className="account-ticket">
      <div className="ticket-heading"><strong>Cuenta</strong><span>{itemCount} {itemCount === 1 ? "artículo" : "artículos"}</span></div>
      <div className="table-lines">
        <AnimatePresence initial={false}>
          {lines.length ? lines.map(({ line, product }) => (
            <motion.div layout variants={fadeUp} initial="hidden" animate="visible" exit="exit" className={`table-line${selectedLineId === line.id ? " active" : ""}`} key={line.id}>
              <button className="table-line-details" aria-label={`Seleccionar ${product.name}`} aria-pressed={selectedLineId === line.id} title="Seleccionar; doble clic para aclaración" onClick={() => onSelectLine(line.id)} onDoubleClick={() => onEditLine(line)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onEditLine(line); } }}>
                <strong>{product.name}</strong>
                <small>{money(Math.max(0, (line.unitPrice ?? product.price) - (line.unitDiscount ?? 0)) * line.quantity)}</small>
                {(line.unitDiscount || 0) > 0 && <span className="table-line-discount">Descuento: −{money((line.unitDiscount || 0) * line.quantity)}</span>}
                {line.unitPrice !== undefined && <span className="table-line-note">Precio manual: {money(line.unitPrice)} por unidad</span>}
                {line.note && <span className="table-line-note">{line.note}</span>}
              </button>
              <div className="quantity">
                <button aria-label={`Restar una unidad de ${product.name}`} onClick={() => onChangeQuantity(line.id, -1)}><Minus size={13} /></button>
                <span>{line.quantity}</span>
                <button aria-label={`Sumar una unidad de ${product.name}`} onClick={() => onChangeQuantity(line.id, 1)}><Plus size={13} /></button>
              </div>
              <button className="remove-line" aria-label={`Eliminar ${product.name}`} onClick={() => onChangeQuantity(line.id, -line.quantity)}><Trash2 size={15} /></button>
            </motion.div>
          )) : (
            <motion.div className="ticket-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span>La mesa está disponible</span><p>Elegí un producto para abrir la cuenta.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="ticket-actions" role="toolbar" aria-label="Acciones de la cuenta">
        <button type="button" aria-label="Aclaración del artículo seleccionado" title="Aclaración del artículo seleccionado" disabled={!selectedLine} onClick={() => selectedLine && onEditLine(selectedLine)}><Pencil size={16} /></button>
        <button type="button" aria-label="Mover artículo seleccionado" title="Mover artículo seleccionado" disabled={!selectedLine} onClick={() => selectedLine && onEditLine(selectedLine, "move")}><ArrowRightLeft size={16} /></button>
        <button type="button" aria-label="Mover cuenta a otra mesa" title="Mover cuenta a otra mesa" disabled={!lines.length} onClick={onMoveTable}><MoveRight size={17} /></button>
        <button type="button" aria-label="Descuento" title="Descuento" aria-expanded={discountOpen} aria-controls="ticket-discount" disabled={!subtotal} className={discountOpen || discount > 0 ? "active" : ""} onClick={() => onDiscountOpenChange(!discountOpen)}><BadgePercent size={17} /></button>
        <button type="button" aria-label={table.billRequested ? "Volver a consumo" : "Entregar cuenta"} title={table.billRequested ? "Volver a consumo" : "Entregar cuenta"} disabled={!itemCount} className={table.billRequested ? "active" : ""} onClick={onToggleBill}><ReceiptText size={17} /></button>
        <button type="button" aria-label="Vaciar mesa" title="Vaciar mesa" disabled={!lines.length} onClick={() => onConfirmClearChange(true)}><Trash2 size={16} /></button>
      </div>
      {confirmClear && <div className="ticket-clear-confirm" role="group" aria-label="Confirmar vaciado de mesa"><span>¿Vaciar esta mesa?</span><button type="button" onClick={() => onConfirmClearChange(false)}>Cancelar</button><button type="button" onClick={onClearTable}>Vaciar</button></div>}
      {discountOpen && <label id="ticket-discount" className="manual-discount">
        <span><strong>Descuento manual</strong><small>Importe en pesos</small></span>
        <div>
          <b>$</b>
          <input aria-label="Descuento manual" inputMode="numeric" type="number" autoFocus min="0" max={subtotal} step="100" disabled={!subtotal} value={table.discount || ""} placeholder="0" onChange={(event) => onDiscountChange(Number(event.target.value) || 0)} />
          {table.discount > 0 && <button type="button" aria-label="Quitar descuento" onClick={() => onDiscountChange(0)}><X size={14} /></button>}
        </div>
      </label>}
      <div className="table-totals">
        <span>Subtotal <b>{money(subtotal)}</b></span>
        {discount > 0 && <span className="discount-line">Descuento <b>− {money(discount)}</b></span>}
        <strong>Total <b>{money(total)}</b></strong>
      </div>
      <button className="button primary full" disabled={!itemCount} onClick={onOpenPayment}><Check size={17} /> Cobrar y cerrar {total > 0 && money(total)}</button>
    </aside>
  );
}
