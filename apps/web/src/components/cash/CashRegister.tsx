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
  Check,
  LockKeyhole,
  Trash2,
  X,
} from "lucide-react";
import { money } from "../../data";
import { CashMovementGroups } from "./CashMovementGroups";
import { modalVariants, overlayVariants } from "../../motion";
import { resetCounterTableSequence } from "../../stores/counterSequence";
import { loadTeamMembers, type TeamMember } from "../../stores/team";
import {
  cashMovementImpact,
  CASH_BASE_EXPECTED,
  type CashExpense,
  type CashMovementKind,
} from "../../stores/cash";

const DENOMINATIONS = [10, 20, 50, 100, 200, 1000, 2000, 10000, 20000];

type ClosingStep = "count" | "confirm" | null;

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

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const emptyEmployeePayment = () => ({
  employeeId: "",
  type: "Sueldo" as "Sueldo" | "Adelanto" | "Otro",
  periodStart: "",
  periodEnd: "",
  paidAt: localDate(),
});

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
  const [editingExpense, setEditingExpense] = useState<CashExpense | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [employeePayment, setEmployeePayment] = useState(emptyEmployeePayment);

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

  const cashExpenses = expenses
    .reduce((sum, expense) => sum - cashMovementImpact(expense), 0);
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
    const employee = employees.find((member) => String(member.id) === employeePayment.employeeId);
    const isEmployee = expenseForm.kind === "empleado";
    if (closed || ((expenseForm.kind === "proveedor" || expenseForm.kind === "retiro") && !expenseForm.supplier.trim()) || (!isEmployee && !expenseForm.concept.trim()) || expenseForm.amount <= 0 || (isEmployee && (!employee || !employeePayment.periodStart || !employeePayment.periodEnd || !employeePayment.paidAt || employeePayment.periodStart > employeePayment.periodEnd)))
      return;
    const expense: CashExpense = {
      ...expenseForm,
      id: editingExpense?.id ?? Date.now(),
      supplier: employee && isEmployee ? employee.name : expenseForm.supplier.trim() || (expenseForm.kind === "ajuste" ? "Ajuste de caja" : "Gasto vario"),
      concept: isEmployee ? employeePayment.type : expenseForm.concept.trim(),
      category: isEmployee ? "Personal" : expenseForm.category,
      ...(isEmployee && employee ? { employeePayment: { ...employeePayment, employeeId: employee.id } } : {}),
      receipt: expenseForm.receipt.trim(),
      time: editingExpense?.time ?? new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setExpenses((current) => editingExpense
      ? current.map((item) => item.id === editingExpense.id ? expense : item)
      : [...current, expense]);
    setExpenseForm(emptyExpense);
    setExpenseOpen(false);
    setEditingExpense(null);
    onToast(`Movimiento ${editingExpense ? "actualizado" : "registrado"} por ${money(expense.amount)}.`);
  };


  const startMovement = (kind: CashMovementKind) => {
    setEditingExpense(null);
    setConfirmVoid(false);
    setExpenseForm({ ...emptyExpense, kind });
    if (kind === "empleado") {
      setEmployees(loadTeamMembers());
      setEmployeePayment(emptyEmployeePayment());
    }
    setExpenseOpen(true);
  };

  const editMovement = (item: CashExpense) => {
    if (closed || item.voidedAt) return;
    setEditingExpense(item);
    setConfirmVoid(false);
    setExpenseForm({ ...item, kind: item.kind ?? "proveedor", direction: item.direction ?? "out" });
    if (item.kind === "empleado") {
      setEmployees(loadTeamMembers());
      setEmployeePayment(item.employeePayment
        ? { ...item.employeePayment, employeeId: String(item.employeePayment.employeeId) }
        : emptyEmployeePayment());
    }
    setExpenseOpen(true);
  };

  const voidMovement = () => {
    if (!editingExpense || closed) return;
    setExpenses((current) => current.map((item) => item.id === editingExpense.id
      ? { ...item, voidedAt: new Date().toISOString() }
      : item));
    setExpenseOpen(false);
    setEditingExpense(null);
    setConfirmVoid(false);
    onToast("Movimiento anulado. El saldo de caja fue actualizado.");
  };

  return (
    <div className={`cash-main-backdrop ${open ? "is-open" : ""} ${mode === "count" ? "cash-count-only" : ""}`} aria-hidden={!open} inert={!open} onMouseDown={(event) => { if (event.target === event.currentTarget && !step && !expenseOpen) onClose(); }}>
      <section className="cash-main-modal" role="dialog" aria-modal="true" aria-labelledby="cash-modal-title">
      <header className="cash-main-header"><div><span className="eyebrow">GESTIÓN DEL TURNO</span><h2 id="cash-modal-title">Movimientos de caja</h2><p>Entradas y salidas registradas durante el turno.</p></div><button ref={closeButtonRef} className="cash-main-close" aria-label="Cerrar caja" onClick={onClose}><X size={19} /></button></header>
      <div className="cash-balance-overview flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div><span className={`cash-status ${closed ? "closed" : "open"}`}><i aria-hidden="true" />{closed ? "Caja cerrada" : "Caja abierta"}</span><p className="mt-2 text-[11px] text-[var(--muted)]">El saldo se actualiza con los movimientos en efectivo.</p></div>
        <div className="sm:text-right"><span className="block text-[11px] text-[var(--muted)]">{closed ? "Efectivo contado" : "Efectivo esperado en caja"}</span><strong className="mt-1 block text-[24px] leading-none tabular-nums">{money(closed ? closedTotal ?? 0 : expectedCash)}</strong></div>
      </div>
      <CashMovementGroups expenses={expenses} closed={closed} onAdd={startMovement} onEdit={editMovement} />

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
                <h2 id="expense-modal-title">{editingExpense ? "Editar " : ""}{expenseForm.kind === "empleado" ? "pago a empleado" : expenseForm.kind === "proveedor" ? "pago a proveedor" : expenseForm.kind === "ajuste" ? "ajuste de caja" : expenseForm.kind === "retiro" ? "retiro de efectivo" : "gasto vario"}</h2>
                <p>{editingExpense ? "Corregí los datos o anulá este movimiento." : expenseForm.kind === "empleado" ? "Registrá el pago y el período correspondiente." : "Registrá el movimiento del turno."}</p>
              </header>
              <form className="expense-form" onSubmit={saveExpense}>
                {expenseForm.kind === "empleado" && <>
                  <label className="field">Empleado
                    <select aria-label="Empleado" autoFocus required value={employeePayment.employeeId} onChange={(event) => setEmployeePayment({ ...employeePayment, employeeId: event.target.value })}>
                      <option value="">Elegí un empleado</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.active ? "" : " · Inactivo"}</option>)}
                    </select>
                    {!employees.length && <small>No hay empleados cargados en Equipo.</small>}
                  </label>
                  <div className="field-row expense-field-row">
                    <label className="field">Tipo de pago<select value={employeePayment.type} onChange={(event) => setEmployeePayment({ ...employeePayment, type: event.target.value as typeof employeePayment.type })}><option>Sueldo</option><option>Adelanto</option><option>Otro</option></select></label>
                    <label className="field">Fecha de pago<input type="date" required value={employeePayment.paidAt} onChange={(event) => setEmployeePayment({ ...employeePayment, paidAt: event.target.value })} /></label>
                  </div>
                  <div className="field-row expense-field-row">
                    <label className="field">Período desde<input type="date" required max={employeePayment.periodEnd || undefined} value={employeePayment.periodStart} onChange={(event) => setEmployeePayment({ ...employeePayment, periodStart: event.target.value })} /></label>
                    <label className="field">Período hasta<input type="date" required min={employeePayment.periodStart || undefined} value={employeePayment.periodEnd} onChange={(event) => setEmployeePayment({ ...employeePayment, periodEnd: event.target.value })} /></label>
                  </div>
                </>}
                {expenseForm.kind === "proveedor" && <label className="field">
                  Proveedor
                  <input
                    autoFocus
                    required
                    placeholder="Nombre del proveedor"
                    value={expenseForm.supplier}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, supplier: event.target.value })
                    }
                  />
                </label>}
                {expenseForm.kind === "retiro" && <label className="field">Destino<select required value={expenseForm.supplier} onChange={(event) => setExpenseForm({ ...expenseForm, supplier: event.target.value })}><option value="">Elegí un destino</option><option>Caja mayor</option><option>Banco</option><option>Otro</option></select></label>}
                {expenseForm.kind !== "empleado" && <label className="field">
                  Concepto
                  <input
                    required
                    placeholder={expenseForm.kind === "retiro" ? "Ej.: Retiro para depósito" : "Ej.: Compra de café en grano"}
                    value={expenseForm.concept}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, concept: event.target.value })
                    }
                  />
                </label>}
                {expenseForm.kind === "ajuste" && <label className="field">Tipo de ajuste<select value={expenseForm.direction} onChange={(event) => setExpenseForm({ ...expenseForm, direction: event.target.value as "in" | "out" })}><option value="in">Ingreso de efectivo</option><option value="out">Salida de efectivo</option></select></label>}
                <div className="field-row expense-field-row">
                  {expenseForm.kind !== "retiro" && expenseForm.kind !== "ajuste" && expenseForm.kind !== "empleado" && <label className="field">
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
                  </label>}
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
                      disabled={expenseForm.kind === "ajuste" || expenseForm.kind === "retiro"}
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
                {confirmVoid ? <div className="mt-4 rounded-xl border border-[var(--border)] p-4" role="alert">
                  <p className="text-sm font-semibold">¿Anular este movimiento?</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Se conservará marcado como anulado y dejará de afectar el saldo de caja.</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className="button" onClick={() => setConfirmVoid(false)}>Volver</button>
                    <button type="button" className="button" onClick={voidMovement}><Trash2 size={15} /> Confirmar anulación</button>
                  </div>
                </div> : <div className="cash-modal-actions">
                  {editingExpense && <button type="button" className="button mr-auto" onClick={() => setConfirmVoid(true)}><Trash2 size={15} /> Anular</button>}
                  <button type="button" className="button" onClick={() => setExpenseOpen(false)}>Cancelar</button>
                  <button type="submit" className="button primary"><Check size={16} /> {editingExpense ? "Guardar cambios" : "Registrar movimiento"}</button>
                </div>}
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      </section>
    </div>
  );
}
