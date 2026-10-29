import { type RefObject } from "react";
import { motion } from "motion/react";
import { Banknote, CreditCard, Smartphone, X } from "lucide-react";
import { money } from "../data";
import { modalVariants, overlayVariants } from "../motion";

export type PaymentMethod = "" | "Efectivo" | "Tarjeta" | "Transferencia";

type Props = {
  dialogRef: RefObject<HTMLElement | null>;
  tableName: string;
  total: number;
  payment: PaymentMethod;
  onPaymentChange: (payment: PaymentMethod) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function PosPaymentDialog({ dialogRef, tableName, total, payment, onPaymentChange, onClose, onConfirm }: Props) {
  return (
    <motion.div className="modal-scrim line-editor-scrim payment-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section ref={dialogRef} className="acrylic-modal line-editor-modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"
        variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
          if (!focusable.length) return;
          if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
          else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
        }}>
        <button className="modal-close" aria-label="Cerrar cobro" onClick={onClose}><X size={19} /></button>
        <span className="eyebrow">COBRO DE MESA</span>
        <h2 id="payment-title">Cobrar {tableName}</h2>
        <div className="payment-total"><span>Total a cobrar</span><strong>{money(total)}</strong></div>
        <fieldset className="payment-methods"><legend>Medio de pago</legend>
          {([ ["Efectivo", Banknote], ["Tarjeta", CreditCard], ["Transferencia", Smartphone] ] as const).map(([method, Icon]) => (
            <label key={method} className={`payment-choice${payment === method ? " selected" : ""}`}>
              <input type="radio" name="payment-method" value={method} checked={payment === method} onChange={() => onPaymentChange(method)} />
              <Icon size={19} aria-hidden="true" /><span>{method}</span>
            </label>
          ))}
        </fieldset>
        <div className="line-editor-actions"><button className="button" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!payment} onClick={onConfirm}>Confirmar cobro · {money(total)}</button></div>
      </motion.section>
    </motion.div>
  );
}
