import {
  useEffect,
  useMemo,
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
  Check,
  CreditCard,
  LockKeyhole,
  Plus,
  ReceiptText,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { money } from "../data";
import { modalVariants, overlayVariants } from "../motion";
import { resetCounterTableSequence } from "../stores/counterSequence";
import { Metric } from "./Operations";

export const CASH_BASE_EXPECTED = 164500;
export const CASH_SALES = 114500;
export const OTHER_PAYMENTS = 170000;
const DENOMINATIONS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

type ClosingStep = "count" | "confirm" | null;
export type CashExpense = {
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
}: {
  onToast: (message: string) => void;
  expenses: CashExpense[];
  setExpenses: Dispatch<SetStateAction<CashExpense[]>>;
}) {
  const [step, setStep] = useState<ClosingStep>(null);
  const [counts, setCounts] = useState<Record<number, number>>(emptyCount);
  const [differenceReason, setDifferenceReason] = useState("");
  const [closed, setClosed] = useState(false);
  const [closedTotal, setClosedTotal] = useState<number | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cashExpenses = expenses
    .filter((expense) => expense.payment === "Efectivo")
    .reduce((sum, expense) => sum + expense.amount, 0);
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
    if (!step && !expenseOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (expenseOpen) setExpenseOpen(false);
      else if (step === "confirm") setStep("count");
      else setStep(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [step, expenseOpen]);

  const openCount = () => {
    setDifferenceReason("");
    setStep("count");
  };

  const finishClosing = () => {
    if (hasDifference && differenceReason.trim().length < 3) return;
    resetCounterTableSequence();
    setClosed(true);
    setClosedTotal(countedTotal);
    setStep(null);
    onToast(
      hasDifference
        ? `Caja cerrada con una diferencia de ${money(Math.abs(difference))}.`
        : "Caja cerrada sin diferencias.",
    );
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();
    if (closed || !expenseForm.supplier.trim() || !expenseForm.concept.trim() || expenseForm.amount <= 0)
      return;
    const expense: CashExpense = {
      ...expenseForm,
      id: Date.now(),
      supplier: expenseForm.supplier.trim(),
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
    onToast(
      `Gasto a ${expense.supplier} registrado por ${money(expense.amount)}${
        expense.payment === "Efectivo" ? ". Se descontó de la caja." : "."
      }`,
    );
  };

  const movements = [
    ["08:00", "Apertura de caja", "Fondo inicial", "+ $ 50.000"],
    ["09:24", "Venta #1024", "Efectivo", "+ $ 7.000"],
    ["10:15", "Venta #1031", "Tarjeta", "+ $ 12.500"],
    ["12:32", "Venta #1048", "Efectivo", "+ $ 8.000"],
    ...expenses.map((expense) => [
      expense.time,
      expense.supplier,
      `Gasto · ${expense.payment}`,
      `− ${money(expense.amount)}`,
    ]),
    ...(closed
      ? [["20:00", "Cierre de caja", "Arqueo", money(closedTotal || 0)]]
      : []),
  ];

  return (
    <>
      <div className="metrics cash-metrics">
        <Metric
          icon={<Wallet size={19} />}
          label={closed ? "Efectivo contado" : "Efectivo esperado en caja"}
          value={money(closed ? closedTotal || 0 : expectedCash)}
          sub={closed ? "Turno cerrado a las 20:00" : "Turno abierto a las 08:00"}
        />
        <Metric
          icon={<Banknote size={19} />}
          label="Ventas en efectivo"
          value={money(CASH_SALES)}
          sub="20 operaciones"
        />
        <Metric
          icon={<CreditCard size={19} />}
          label="Otros medios de pago"
          value={money(OTHER_PAYMENTS)}
          sub="28 operaciones"
        />
        <Metric
          icon={<Truck size={19} />}
          label="Gastos del turno"
          value={money(totalExpenses)}
          sub={expenses.length ? `${expenses.length} pagos · ${money(cashExpenses)} en efectivo` : "Sin gastos registrados"}
        />
      </div>

      <section className="panel cash-overview">
        <div className="cash-overview-copy">
          <span className="eyebrow">ARQUEO DEL TURNO</span>
          <h2>{closed ? "Caja cerrada" : "Todo listo para el cierre"}</h2>
          <p>
            {closed
              ? "El conteo quedó registrado en esta sesión de demostración."
              : "Contá el efectivo por denominación y comparalo con el saldo esperado."}
          </p>
        </div>
        <div className="cash-overview-total">
          <small>{closed ? "Total declarado" : "Saldo esperado"}</small>
          <strong>{money(closed ? closedTotal || 0 : expectedCash)}</strong>
        </div>
        <div className="cash-overview-actions">
          <button
            className="button"
            disabled={closed}
            onClick={() => setExpenseOpen(true)}
          >
            <Plus size={16} /> Registrar gasto
          </button>
          <button
            className="button primary"
            disabled={closed}
            onClick={openCount}
          >
            {closed ? <LockKeyhole size={16} /> : <ReceiptText size={16} />}
            {closed ? "Turno cerrado" : "Iniciar arqueo"}
          </button>
        </div>
      </section>

      <div className="cash-content-grid">
      <section className="panel cash-movements">
        <div className="panel-heading">
          <h2>Movimientos del turno</h2>
          <span className={`badge ${closed ? "done" : "ready"}`}>
            {closed ? "Caja cerrada" : "Caja abierta"}
          </span>
        </div>
        {movements.map((row) => (
          <div className="movement" key={`${row[0]}-${row[1]}`}>
            {row.map((value, index) => (
              <span key={index}>{value}</span>
            ))}
          </div>
        ))}
        <p className="help-copy">
          Los datos se mantienen localmente mientras no haya una base de datos conectada.
        </p>
      </section>
      <section className="panel supplier-expenses">
        <div className="panel-heading">
          <div>
            <h2>Gastos y proveedores</h2>
            <p>Pagos registrados durante el turno.</p>
          </div>
          {!closed && (
            <button className="icon-btn" aria-label="Registrar gasto" onClick={() => setExpenseOpen(true)}>
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
                  <small>{expense.concept} · {expense.category}</small>
                  <em>{expense.payment}{expense.receipt ? ` · ${expense.receipt}` : ""}</em>
                </div>
                <b>− {money(expense.amount)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="expense-empty">
            <Truck size={22} />
            <strong>Sin gastos registrados</strong>
            <p>Los pagos a proveedores van a aparecer acá.</p>
          </div>
        )}
        <div className="expense-total">
          <span>Total del turno</span>
          <strong>{money(totalExpenses)}</strong>
        </div>
      </section>
      </div>

      <AnimatePresence mode="wait">
        {step && (
          <motion.div
            className="modal-backdrop cash-modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setStep(null)}
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
                onClick={() => setStep(null)}
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
                  <div className="denomination-grid">
                    {DENOMINATIONS.map((denomination) => (
                      <label className="denomination-row" key={denomination}>
                        <span>
                          <small>Billete</small>
                          <strong>{money(denomination)}</strong>
                        </span>
                        <input
                          aria-label={`Cantidad de billetes de ${money(denomination)}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
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
                    <button className="button" onClick={() => setStep(null)}>
                      Guardar para después
                    </button>
                    <button
                      className="button primary"
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
                <span className="eyebrow">SALIDA DE DINERO</span>
                <h2 id="expense-modal-title">Registrar gasto</h2>
                <p>Dejá asentado el pago y cómo salió el dinero.</p>
              </header>
              <form className="expense-form" onSubmit={saveExpense}>
                <label className="field">
                  Proveedor
                  <input
                    autoFocus
                    required
                    placeholder="Ej.: Café Puerto Blest"
                    value={expenseForm.supplier}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, supplier: event.target.value })
                    }
                  />
                </label>
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
                      ? "Este gasto se descontará del efectivo esperado en caja."
                      : "Quedará registrado sin modificar el efectivo físico de la caja."}
                  </span>
                </div>
                <div className="cash-modal-actions">
                  <button type="button" className="button" onClick={() => setExpenseOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    <Check size={16} /> Registrar gasto
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
