import { useState } from "react";
import { ArrowDownUp, Banknote, ChevronDown, Plus, Receipt, Truck, UsersRound } from "lucide-react";
import { money } from "../../data";
import { CASH_BASE_EXPECTED, CASH_SALES, type CashExpense, type CashMovementKind } from "../../stores/cash";

const actions = [
  { kind: "gasto", label: "Gasto vario", icon: Receipt },
  { kind: "proveedor", label: "Pago a proveedor", icon: Truck },
  { kind: "empleado", label: "Pago a empleado", icon: UsersRound },
  { kind: "retiro", label: "Retiro", icon: Banknote },
  { kind: "ajuste", label: "Ajuste", icon: ArrowDownUp },
] as const;

const movementLabel = (item: CashExpense) => {
  if (item.id === -1) return "Apertura de caja";
  if (item.id === -2) return "Ventas del turno";
  if (item.kind === "empleado") return "Pago a empleado";
  if (!item.kind || item.kind === "proveedor") return "Pago a proveedor";
  if (item.kind === "retiro") return "Retiro";
  if (item.kind === "ajuste") return "Ajuste de caja";
  return "Gasto vario";
};

const date = (value: string) => value.split("-").reverse().join("/");

const exitGroups = [
  { kind: "proveedor", label: "Pagos a proveedores", icon: Truck },
  { kind: "empleado", label: "Pagos a empleados", icon: UsersRound },
  { kind: "gasto", label: "Gastos varios", icon: Receipt },
  { kind: "retiro", label: "Retiros", icon: Banknote },
  { kind: "ajuste", label: "Ajustes de caja", icon: ArrowDownUp },
] as const;

function MovementRow({ item, type, onEdit }: { item: CashExpense; type: "in" | "out"; onEdit?: (item: CashExpense) => void }) {
  const [expanded, setExpanded] = useState(false);
  const summary = item.id < 0 ? item.supplier : item.concept.trim() || movementLabel(item);
  const partyLabel = item.kind === "empleado" ? "Empleado" : item.kind === "proveedor" ? "Proveedor" : item.kind === "retiro" ? "Destino" : "Detalle";

  return <div className="border-b border-[var(--border)] last:border-b-0">
    <button type="button" aria-expanded={expanded} aria-controls={`cash-detail-${type}-${item.id}`} onClick={() => setExpanded(!expanded)} onDoubleClick={onEdit && !item.voidedAt ? () => onEdit(item) : undefined} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-[var(--brand-soft)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
      <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted)]">{item.time}</span>
      <span className={`min-w-0 flex-1 truncate text-xs font-medium ${item.voidedAt ? "text-[var(--muted)] line-through" : ""}`} title={summary}>{summary}</span>
      {item.voidedAt && <span className="text-[10px] text-[var(--muted)]">Anulado</span>}
      <span className={`shrink-0 text-xs font-semibold tabular-nums ${item.voidedAt ? "text-[var(--muted)] line-through" : ""}`}>{type === "in" ? "+" : "−"} {money(item.amount)}</span>
      <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
    </button>
    <div id={`cash-detail-${type}-${item.id}`} hidden={!expanded} className="px-4 pb-3 text-[11px] leading-relaxed text-[var(--muted)]">
      <p>{movementLabel(item)}{item.supplier && item.supplier !== summary ? ` · ${partyLabel}: ${item.supplier}` : ""}</p>
      <p>Medio de pago: {item.payment}{item.receipt ? ` · Comprobante: ${item.receipt}` : ""}</p>
      {item.employeePayment && <p>Período: {date(item.employeePayment.periodStart)} al {date(item.employeePayment.periodEnd)} · Pago: {date(item.employeePayment.paidAt)}</p>}
      {item.voidedAt && <p>Anulado el {new Date(item.voidedAt).toLocaleString("es-AR")}</p>}
      {onEdit && !item.voidedAt && <button type="button" onClick={() => onEdit(item)} className="mt-2 text-[var(--brand)] underline underline-offset-2">Editar movimiento</button>}
    </div>
  </div>;
}

function MovementColumn({ title, items, type, onEdit }: {
  title: string;
  items: CashExpense[];
  type: "in" | "out";
  onEdit?: (item: CashExpense) => void;
}) {
  const [openGroup, setOpenGroup] = useState<CashMovementKind | null>(null);
  const total = items.reduce((sum, item) => sum + (item.voidedAt ? 0 : item.amount), 0);
  const cashTotal = items.filter((item) => item.payment === "Efectivo" && !item.voidedAt).reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="flex min-h-[280px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div><h3 className="text-sm font-semibold">{title}</h3><span className="text-[11px] text-[var(--muted)]">{items.length} {items.length === 1 ? "movimiento" : "movimientos"}</span></div>
        <div className="text-right"><strong className="block text-sm tabular-nums">{money(total)}</strong><span className="text-[10px] text-[var(--muted)]">Efectivo: {money(cashTotal)}</span></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 sm:max-h-[340px]">
        {items.length ? type === "in"
          ? items.map((item) => <MovementRow key={item.id} item={item} type={type} onEdit={item.id > 0 ? onEdit : undefined} />)
          : exitGroups.map(({ kind, label, icon: Icon }) => {
            const groupItems = items.filter((item) => (item.kind ?? "proveedor") === kind);
            if (!groupItems.length) return null;
            const expanded = openGroup === kind;
            const groupTotal = groupItems.reduce((sum, item) => sum + (item.voidedAt ? 0 : item.amount), 0);
            return <div key={kind} className="border-b border-[var(--border)] last:border-b-0">
              <button type="button" aria-expanded={expanded} aria-controls={`cash-group-${kind}`} onClick={() => setOpenGroup(expanded ? null : kind)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-[var(--brand-soft)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
                <Icon size={16} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-semibold">{label}</strong><small className="text-[10px] text-[var(--muted)]">{groupItems.length} {groupItems.length === 1 ? "movimiento" : "movimientos"}</small></span>
                <strong className="shrink-0 text-xs tabular-nums">− {money(groupTotal)}</strong>
                <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
              </button>
              <div id={`cash-group-${kind}`} hidden={!expanded} className="border-t border-[var(--border)] bg-[var(--bg)] px-2 pl-5">
                {groupItems.map((item) => <MovementRow key={item.id} item={item} type={type} onEdit={onEdit} />)}
              </div>
            </div>;
          })
          : <p className="px-3 py-8 text-center text-xs text-[var(--muted)]">Sin movimientos registrados.</p>}
      </div>
    </section>
  );
}

export function CashMovementGroups({ expenses, closed, onAdd, onEdit }: {
  expenses: CashExpense[];
  closed: boolean;
  onAdd: (kind: CashMovementKind) => void;
  onEdit: (item: CashExpense) => void;
}) {
  const initial = CASH_BASE_EXPECTED - CASH_SALES;
  const entries: CashExpense[] = [
    { id: -1, time: "08:00", supplier: "Fondo inicial", concept: "Apertura de caja", category: "", amount: initial, payment: "Efectivo", receipt: "", direction: "in" },
    { id: -2, time: "—", supplier: "Ventas en efectivo", concept: "Ventas del turno", category: "", amount: CASH_SALES, payment: "Efectivo", receipt: "", direction: "in" },
    ...expenses.filter((item) => item.direction === "in").slice().reverse(),
  ];
  const exits = expenses.filter((item) => item.direction !== "in").slice().reverse();

  return <div className="cash-ledger mt-4">
    <div className="grid gap-3 md:grid-cols-2">
      <MovementColumn title="Entradas" items={entries} type="in" onEdit={closed ? undefined : onEdit} />
      <MovementColumn title="Salidas" items={exits} type="out" onEdit={closed ? undefined : onEdit} />
    </div>
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <p className="mb-2 text-[11px] font-medium text-[var(--muted)]">Registrar movimiento</p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" className="button" disabled={closed} onClick={() => onAdd(kind)}><Icon size={15} aria-hidden="true" /><Plus size={12} aria-hidden="true" />{label}</button>)}
      </div>
    </div>
  </div>;
}
