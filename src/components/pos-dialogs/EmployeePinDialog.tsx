import { motion } from "motion/react";
import { Check, KeyRound, X } from "lucide-react";
import { modalVariants, overlayVariants } from "../../motion";
import type { PinPurpose } from "../../pos/floorModel";
import type { TeamMember } from "../../stores/team";

type Props = {
  operator: TeamMember;
  tableName: string;
  purpose: PinPurpose;
  pin: string;
  error: string;
  onPinChange: (pin: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function EmployeePinDialog({ operator, tableName, purpose, pin, error, onPinChange, onClose, onConfirm }: Props) {
  const backLabel = purpose === "enter" ? "Volver al plano" : purpose === "settle" ? "Volver al cobro" : "Volver a la mesa";
  const closeLabel = purpose === "enter" ? "Cancelar acceso" : backLabel;
  const description = purpose === "enter"
    ? `Ingresá tu código personal para entrar a ${tableName}.`
    : purpose === "transfer" ? `Confirmá tu código para quedar a cargo de ${tableName}.`
    : purpose === "request-bill" ? `Confirmá tu código para entregar la cuenta y salir de ${tableName}.`
    : purpose === "settle" ? `Confirmá tu código para cobrar y cerrar ${tableName}.`
    : `Confirmá tu código para guardar la comanda y salir de ${tableName}.`;
  const confirmLabel = purpose === "enter" ? "Verificar y entrar"
    : purpose === "transfer" ? "Confirmar cambio"
    : purpose === "request-bill" ? "Confirmar y entregar"
    : purpose === "settle" ? "Confirmar cobro" : "Confirmar y salir";

  return (
    <motion.div className="modal-scrim operator-pin-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section className="acrylic-modal operator-pin-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="operator-pin-title">
        <button className="modal-close" aria-label={closeLabel} onClick={onClose}><X size={19} /></button>
        <div className="operator-pin-icon"><KeyRound size={21} /></div>
        <span className="eyebrow">VERIFICAR EMPLEADO</span>
        <h2 id="operator-pin-title">Código de {operator.name}</h2>
        <p>{description}</p>
        <form onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
          <label className="field operator-pin-field">
            Código de cuatro números
            <input autoFocus aria-label={`Código de ${operator.name}`} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => onPinChange(event.target.value.replace(/\D/g, "").slice(0, 4))} />
          </label>
          {error && <motion.p className="operator-pin-error" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} role="alert">{error}</motion.p>}
          <div className="operator-pin-actions">
            <button type="button" className="button" onClick={onClose}>{backLabel}</button>
            <button className="button primary" disabled={pin.length !== 4}><Check size={16} /> {confirmLabel}</button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
