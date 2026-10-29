import { motion } from "motion/react";
import { UserRound, X } from "lucide-react";
import { modalVariants, overlayVariants, press } from "../../motion";
import type { TeamMember } from "../../stores/team";

type Props = {
  tableName: string;
  members: TeamMember[];
  onChoose: (member: TeamMember) => void;
  onClose: () => void;
};

export default function EmployeePickerDialog({ tableName, members, onChoose, onClose }: Props) {
  return (
    <motion.div className="modal-scrim account-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section className="acrylic-modal operator-modal employee-picker-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="operator-title">
        <button className="modal-close" aria-label="Cancelar selección de empleado" onClick={onClose}><X size={19} /></button>
        <header className="operator-heading">
          <span className="eyebrow">{tableName.toUpperCase()}</span>
          <h2 id="operator-title">¿Quién va a gestionar esta mesa?</h2>
          <p>Elegí un empleado para identificar la comanda.</p>
        </header>
        <div className="employee-picker-list">
          {members.map((member) => {
            const initials = member.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
            return (
              <motion.button type="button" className="employee-picker-item" whileTap={press} aria-label={`Trabajar como ${member.name}`} title={member.clockedIn ? "En turno" : "Fuera de turno"} onClick={() => onChoose(member)} key={member.id}>
                <span className="employee-picker-square">
                  <span className="employee-picker-initials" aria-hidden="true">{initials}</span>
                  <span className={`employee-picker-status${member.clockedIn ? " on-shift" : ""}`} aria-hidden="true" />
                </span>
                <strong>{member.name}</strong>
              </motion.button>
            );
          })}
          {!members.length && <div className="operator-empty"><UserRound size={23} /><strong>No hay empleados activos</strong><p>Creá o activá un usuario desde la sección Equipo.</p></div>}
        </div>
      </motion.section>
    </motion.div>
  );
}
