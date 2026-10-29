import { motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { modalVariants, overlayVariants } from "../../motion";
import type { TeamMember } from "../../stores/team";

type Props = {
  tableName: string;
  operator: TeamMember;
  covers: number;
  onCoversChange: (covers: number) => void;
  onBack: () => void;
  onConfirm: () => void;
};

export default function CoversDialog({ tableName, operator, covers, onCoversChange, onBack, onConfirm }: Props) {
  return (
    <motion.div className="modal-scrim account-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onBack}>
      <motion.section className="acrylic-modal operator-modal covers-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="covers-title">
        <button className="modal-close" aria-label="Volver a elegir empleado" onClick={onBack}><X size={19} /></button>
        <header className="operator-heading">
          <span className="eyebrow">{tableName.toUpperCase()}</span>
          <h2 id="covers-title">¿Cuántos cubiertos?</h2>
          <p>Indicá cuántas personas se sientan en la mesa.</p>
        </header>
        <div className="covers-operator">
          <span className="operator-avatar">{operator.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
          <span><strong>{operator.name}</strong><small>{operator.role}</small></span>
          <button type="button" onClick={onBack}>Cambiar</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
          <div className="covers-presets" role="group" aria-label="Elegir cantidad de cubiertos">
            {[1, 2, 3, 4, 5, 6].map((count) => <button type="button" key={count} aria-pressed={covers === count} onClick={() => onCoversChange(count)}>{count}</button>)}
          </div>
          <div className="covers-stepper">
            <button type="button" aria-label="Restar un cubierto" disabled={covers <= 1} onClick={() => onCoversChange(Math.max(1, covers - 1))}><Minus size={18} /></button>
            <label>
              <input autoFocus aria-label="Cantidad de cubiertos" type="number" min="1" max="20" value={covers} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onCoversChange(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} />
              <span>{covers === 1 ? "persona" : "personas"}</span>
            </label>
            <button type="button" aria-label="Sumar un cubierto" disabled={covers >= 20} onClick={() => onCoversChange(Math.min(20, covers + 1))}><Plus size={18} /></button>
          </div>
          <div className="covers-modal-actions">
            <button type="button" className="button" onClick={onBack}>Volver</button>
            <button type="submit" className="button primary">Abrir mesa <span aria-hidden="true">↵</span></button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
