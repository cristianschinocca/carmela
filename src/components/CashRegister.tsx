import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  ArrowDownUp,
  UsersRound,
  Receipt,
  Check,
  LockKeyhole,
  Plus,
  ReceiptText,
  Truck,
  X,
} from "lucide-react";
import { money } from "../data";
import { modalVariants, overlayVariants } from "../motion";
import { resetCounterTableSequence } from "../stores/counterSequence";

export const CASH_BASE_EXPECTED = 164500;
export const CASH_SALES = 114500;
export const OTHER_PAYMENTS = 170000;
const DENOMINATIONS = [10, 20, 50, 100, 200, 1000, 2000, 10000, 20000];

type ClosingStep = "count" | "confirm" | null;
type CashMovementKind = "proveedor" | "empleado" | "gasto" | "ajuste";
export type CashExpense = {
  kind?: CashMovementKind;
  direction?: "in" | "out";
  id: number;
  time: string;
  supplier: string;
  concept: string;
  category: string;
  amount: number;
  payment: "Efectivo" | "Transferencia" | "Tarjeta";
  receipt: string;
};

const emptyExpense = {
  kind: "proveedor" as CashMovementKind,
  direction: "out" as "in" | "out",
  supplier: "",
  concept: "",
  category: "Materia prima",
  amount: 0,
  payment: "Efectivo" as CashExpense["payment"],
  receipt: "",
};

const emptyCount = () =>
  Object.fromEntries(DENOMINATIONS.map((value) => [value, 0])) as Record<
    number,
    number
  >;

export function CashRegister({
  onToast,
  expenses,
  setExpenses,
  open,
  mode,
  onClose,
}: {
  onToast: (message: string) => void;
  open: boolean;
  mode: "movements" | "count";
  onClose: () => void;
  expenses: CashExpense[];
  setExpenses: Dispatch<SetStateAction<CashExpense[]>>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previous?.focus();
  }, [open]);
  const [step, setStep] = useState<ClosingStep>(null);
  const [counts, setCounts] = useState<Record<number, number>>(emptyCount);
  const [differenceReason, setDifferenceReason] = useState("");
  const [closed, setClosed] = useState(false);
  const [closedTotal, setClosedTotal] = useState<number | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);

  useEffect(() => {
    if (open && mode === "count" && closed) {
      onToast("La caja ya está cerrada.");
      onClose();
    } else if (open && mode === "count") {
      setDifferenceReason("");
      setStep("count");
    } else if (!open) {
      setStep(null);
      setExpenseOpen(false);
    }
  }, [open, mode, closed]);

  const totalExpenses = expenses.filter((expense) => expense.kind !== "ajuste").reduce((sum, expense) => sum + expense.amount, 0);
  const cashExpenses = expenses
    .filter((expense) => expense.payment === "Efectivo")
    .reduce((sum, expense) => sum + (expense.direction === "in" ? -expense.amount : expense.amount), 0);
  const expectedCash = CASH_BASE_EXPECTED - cashExpenses;

  const countedTotal = useMemo(
    () =>
      DENOMINATIONS.reduce(
        (total, denomination) =>
          total + denomination * (counts[denomination] || 0),
        0,
      ),
    [counts],
  );
  const difference = countedTotal - expectedCash;
  const hasDifference = difference !== 0;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (expenseOpen) setExpenseOpen(false);
      else if (step === "confirm") setStep("count");
      else if (step) { setStep(null); if (mode === "count") onClose(); }
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, step, expenseOpen, onClose, mode]);

  const finishClosing = () => {
    if (hasDifference && differenceReason.trim().length < 3) return;
    resetCounterTableSequence();
    setClosed(true);
    setClosedTotal(countedTotal);
    setStep(null);
    onClose();
    onToast(
      hasDifference
        ? `Caja cerrada con una diferencia de ${money(Math.abs(difference))}.`
        : "Caja cerrada sin diferencias.",
    );
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();
    if (closed || ((expenseForm.kind === "proveedor" || expenseForm.kind === "empleado") && !expenseForm.supplier.trim()) || !expenseForm.concept.trim() || expenseForm.amount <= 0)
      return;
    const expense: CashExpense = {
      ...expenseForm,
      id: Date.now(),
      supplier: expenseForm.supplier.trim() || (expenseForm.kind === "ajuste" ? "Ajuste de caja" : "Gasto vario"),
      concept: expenseForm.concept.trim(),
      receipt: expenseForm.receipt.trim(),
      time: new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setExpenses((current) => [...current, expense]);
    setExpenseForm(emptyExpense);
    setExpenseOpen(false);
    onToast(`Movimiento registrado por ${money(expense.amount)}.`);
  };


  const startMovement = (kind: CashMovementKind) => {
    setExpenseForm({ ...emptyExpense, kind });
    setExpenseOpen(true);
  };

  return (
    <div className={`cash-main-backdrop ${open ? "is-open" : ""} ${mode === "count" ? "cash-count-only" : ""}`} aria-hidden={!open} inert={!open} onMouseDown={(event) => { if (event.target === event.currentTarget && !step && !expenseOpen) onClose(); }}>
      <section className="cash-main-modal" role="dialog" aria-modal="true" aria-labelledby="cash-modal-title">
      <header className="cash-main-header"><div><span className="eyebrow">GESTIÓN DEL TURNO</span><h2 id="cash-modal-title">Movimientos de caja</h2><p>Consultá los gastos y el efectivo esperado del turno.</p></div><button ref={closeButtonRef} className="cash-main-close" aria-label="Cerrar caja" onClick={onClose}><X size={19} /></button></header>
      <div className="cash-movement-summary"><span className={`cash-status ${closed ? "closed" : "open"}`}><i aria-hidden="true" />{closed ? "Caja cerrada" : "Caja abierta"}</span><span>Fondo inicial <strong>{money(CASH_BASE_EXPECTED - CASH_SALES)}</strong></span><span>Ventas del turno <strong>{money(CASH_SALES + OTHER_PAYMENTS)}</strong></span><span>Gastos <strong>{money(totalExpenses)}</strong></span></div>
      <div className="cash-content-grid">
      <section className="panel supplier-expenses">
        <div className="panel-heading">
          <div>
            <h2 className="cash-section-title"><Truck size={17} aria-hidden="true" />Movimientos registrados</h2>
            <p>Pagos y ajustes registrados durante el turno.</p>
          </div>
          {!closed && (
            <button className="icon-btn" aria-label="Registrar gasto" onClick={() => startMovement("gasto")}>
              <Plus size={17} />
            </button>
          )}
        </div>
        {expenses.length ? (
          <div className="expense-list">
            {expenses.map((expense) => (
              <div className="expense-row" key={expense.id}>
                <span className="expense-icon"><Truck size={16} /></span>
                <div>
                  <strong>{expense.supplier}</strong>
                  <small>{expense.concept} · {expense.kind === "ajuste" ? "Ajuste de caja" : expense.kind === "empleado" ? "Pago a empleado" : expense.kind === "gasto" ? "Gasto vario" : "Pago a proveedor"}</small>
                  <em>{expense.payment}{expense.receipt ? ` · ${expense.receipt}` : ""}</em>
                </div>
                <b>{expense.direction === "in" ? "+" : "−"} {money(expense.amount)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="expense-empty">
            <Truck size={22} />
            <strong>Sin movimientos registrados</strong>
            <p>Los pagos y ajustes van a aparecer acá.</p>
          </div>
        )}
        <div className="expense-total">
          <span>Total de gastos</span>
          <strong>{money(totalExpenses)}</strong>
        </div>
      </section>
      </div>
      <div className="cash-movement-footer"><div><span>{closed ? "Efectivo contado" : "Efectivo esperado en caja"}</span><strong>{money(closed ? closedTotal || 0 : expectedCash)}</strong></div></div>
      <div className="cash-movement-actions" aria-label="Registrar movimiento">
        <button className="button" disabled={closed} onClick={() => startMovement("empleado")}><UsersRound size={16} /> Pago a empleado</button>
        <button className="button" disabled={closed} onClick={() => startMovement("gasto")}><Receipt size={16} /> Gasto vario</button>
        <button className="button" disabled={closed} onClick={() => startMovement("proveedor")}><Truck size={16} /> Pago a proveedor</button>
        <button className="button" disabled={closed} onClick={() => startMovement("ajuste")}><ArrowDownUp size={16} /> Ajuste de caja</button>
      </div>

      <AnimatePresence mode="wait">
        {step && (
          <motion.div
            className="modal-backdrop cash-modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => { setStep(null); if (mode === "count") onClose(); }}
          >
            <motion.section
              key={step}
              className="acrylic-modal cash-count-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cash-closing-title"
            >
              <button
                className="modal-close"
                aria-label="Cerrar arqueo"
                onClick={() => { setStep(null); if (mode === "count") onClose(); }}
              >
                <X size={19} />
              </button>

              {step === "count" ? (
                <>
                  <header className="cash-modal-heading">
                    <span className="eyebrow">PRIMERA CONFIRMACIÓN</span>
                    <h2 id="cash-closing-title">Contá el efectivo</h2>
                    <p>Ingresá la cantidad de billetes de cada denominación.</p>
                  </header>
                  <div className="cash-count-summary">
                    <span>Esperado <strong>{money(expectedCash)}</strong></span>
                    <span>Contado <strong>{money(countedTotal)}</strong></span>
                    <span className={hasDifference ? "difference" : "balanced"}>
                      Diferencia
                      <strong>
                        {difference > 0 ? "+ " : difference < 0 ? "− " : ""}
                        {money(Math.abs(difference))}
                      </strong>
                    </span>
                  </div>
                  <div className="cash-count-columns" aria-hidden="true"><span>Billete</span><span>Cantidad</span><span>Subtotal</span></div>
                  <div className="denomination-grid">
                    {DENOMINATIONS.map((denomination) => (
                      <label className="denomination-row" key={denomination}>
                        <span>
                          <strong>{money(denomination)}</strong>
                        </span>
                        <input
                          aria-label={`Cantidad de billetes de ${money(denomination)}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          onFocus={(event) => event.currentTarget.select()}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const next = event.currentTarget.closest(".denomination-row")?.nextElementSibling?.querySelector<HTMLInputElement>("input");
                            if (next) next.focus();
                            else event.currentTarget.closest(".cash-count-modal")?.querySelector<HTMLButtonElement>(".cash-review-button")?.focus();
                          }}
                          step="1"
                          value={counts[denomination] || ""}
                          placeholder="0"
                          onChange={(event) =>
                            setCounts((current) => ({
                              ...current,
                              [denomination]: Math.max(
                                0,
                                Math.floor(Number(event.target.value) || 0),
                              ),
                            }))
                          }
                        />
                        <b>{money(denomination * (counts[denomination] || 0))}</b>
                      </label>
                    ))}
                  </div>
                  <div className="cash-modal-actions">
                    <button className="button" onClick={() => { setStep(null); if (mode === "count") onClose(); }}>
                      Continuar después
                    </button>
                    <button
                      className="button primary cash-review-button"
                      onClick={() => setStep("confirm")}
                    >
                      Revisar cierre <Check size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <header className="cash-modal-heading confirm-heading">
                    <span className="eyebrow">SEGUNDA CONFIRMACIÓN</span>
                    <h2 id="cash-closing-title">Confirmar cierre</h2>
                    <p>Revisá los importes antes de cerrar definitivamente el turno.</p>
                  </header>
                  <div className="closing-review">
                    <span>Saldo esperado <strong>{money(expectedCash)}</strong></span>
                    <span>Efectivo contado <strong>{money(countedTotal)}</strong></span>
                    <span className={hasDifference ? "difference" : "balanced"}>
                      Diferencia
                      <strong>
                        {difference > 0 ? "+ " : difference < 0 ? "− " : ""}
                        {money(Math.abs(difference))}
                      </strong>
                    </span>
                  </div>
                  {hasDifference ? (
                    <div className="cash-warning" role="alert">
                      <AlertTriangle size={20} />
                      <div>
                        <strong>Estás por cerrar la caja con diferencia</strong>
                        <p>
                          {difference < 0 ? "Faltan" : "Sobran"} {money(Math.abs(difference))} respecto del saldo esperado.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="cash-balanced">
                      <Check size={18} /> El arqueo coincide con el saldo esperado.
                    </div>
                  )}
                  {hasDifference && (
                    <label className="field difference-reason">
                      Motivo de la diferencia
                      <textarea
                        autoFocus
                        rows={3}
                        placeholder="Ej.: retiro de efectivo no registrado"
                        value={differenceReason}
                        onChange={(event) => setDifferenceReason(event.target.value)}
                      />
                      <small>Necesario para dejar constancia del cierre.</small>
                    </label>
                  )}
                  <div className="cash-modal-actions">
                    <button className="button" onClick={() => setStep("count")}>
                      <ArrowLeft size={15} /> Volver al conteo
                    </button>
                    <button
                      className={hasDifference ? "button danger-close" : "button primary"}
                      disabled={hasDifference && differenceReason.trim().length < 3}
                      onClick={finishClosing}
                    >
                      <LockKeyhole size={16} />
                      {hasDifference ? "Cerrar con diferencia" : "Confirmar cierre"}
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {expenseOpen && (
          <motion.div
            className="modal-backdrop cash-modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setExpenseOpen(false)}
          >
            <motion.section
              className="acrylic-modal expense-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-modal-title"
            >
              <button
                className="modal-close"
                aria-label="Cerrar registro de gasto"
                onClick={() => setExpenseOpen(false)}
              >
                <X size={19} />
              </button>
              <header className="cash-modal-heading">
                <span className="eyebrow">MOVIMIENTO DE CAJA</span>
                <h2 id="expense-modal-title">{expenseForm.kind === "empleado" ? "Pago a empleado" : expenseForm.kind === "proveedor" ? "Pago a proveedor" : expenseForm.kind === "ajuste" ? "Ajuste de caja" : "Gasto vario"}</h2>
                <p>Registrá el movimiento del turno.</p>
              </header>
              <form className="expense-form" onSubmit={saveExpense}>
                {(expenseForm.kind === "proveedor" || expenseForm.kind === "empleado") && <label className="field">
                  {expenseForm.kind === "empleado" ? "Empleado" : "Proveedor"}
                  <input
                    autoFocus
                    required
                    placeholder={expenseForm.kind === "empleado" ? "Nombre del empleado" : "Nombre del proveedor"}
                    value={expenseForm.supplier}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, supplier: event.target.value })
                    }
                  />
                </label>}
                <label className="field">
                  Concepto
                  <input
                    required
                    placeholder="Ej.: Compra de café en grano"
                    value={expenseForm.concept}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, concept: event.target.value })
                    }
                  />
                </label>
                {expenseForm.kind === "ajuste" && <label className="field">Tipo de ajuste<select value={expenseForm.direction} onChange={(event) => setExpenseForm({ ...expenseForm, direction: event.target.value as "in" | "out" })}><option value="in">Ingreso de efectivo</option><option value="out">Salida de efectivo</option></select></label>}
                <div className="field-row expense-field-row">
                  <label className="field">
                    Categoría
                    <select
                      value={expenseForm.category}
                      onChange={(event) =>
                        setExpenseForm({ ...expenseForm, category: event.target.value })
                      }
                    >
                      <option>Materia prima</option>
                      <option>Insumos</option>
                      <option>Servicios</option>
                      <option>Mantenimiento</option>
                      <option>Otros</option>
                    </select>
                  </label>
                  <label className="field">
                    Importe
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      placeholder="0"
                      value={expenseForm.amount || ""}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          amount: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="field-row expense-field-row">
                  <label className="field">
                    Medio de pago
                    <select
                      disabled={expenseForm.kind === "ajuste"}
                      value={expenseForm.payment}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          payment: event.target.value as CashExpense["payment"],
                        })
                      }
                    >
                      <option>Efectivo</option>
                      <option>Transferencia</option>
                      <option>Tarjeta</option>
                    </select>
                  </label>
                  <label className="field">
                    Comprobante <small>Opcional</small>
                    <input
                      placeholder="Factura o recibo"
                      value={expenseForm.receipt}
                      onChange={(event) =>
                        setExpenseForm({ ...expenseForm, receipt: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="expense-impact">
                  <Banknote size={17} />
                  <span>
                    {expenseForm.payment === "Efectivo"
                      ? expenseForm.direction === "in" ? "Este ingreso se sumará al efectivo esperado en caja." : "Esta salida se descontará del efectivo esperado en caja."
                      : "Quedará registrado sin modificar el efectivo físico de la caja."}
                  </span>
                </div>
                <div className="cash-modal-actions">
                  <button type="button" className="button" onClick={() => setExpenseOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    <Check size={16} /> Registrar movimiento
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      </section>
    </div>
  );
}
