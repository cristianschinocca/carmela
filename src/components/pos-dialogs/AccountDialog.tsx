import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Pencil, UserRound, UsersRound, X } from "lucide-react";
import { modalVariants, overlayVariants, transitions } from "../../motion";
import type { Table } from "../../pos/floorModel";
import type { TeamMember } from "../../stores/team";

type Props = {
  table: Table;
  tableName: string;
  operator: TeamMember | null;
  teamOptions: TeamMember[];
  operatorMenuOpen: boolean;
  onOperatorMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onOperatorChange: (memberId: number) => void;
  onClose: () => void;
  onEditTable: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  operatorMenuRef: RefObject<HTMLDivElement | null>;
  operatorTriggerRef: RefObject<HTMLButtonElement | null>;
  onCategoryContainerChange: (node: HTMLDivElement | null) => void;
  children: ReactNode;
};

export default function AccountDialog({
  table, tableName, operator, teamOptions, operatorMenuOpen,
  onOperatorMenuOpenChange, onOperatorChange, onClose, onEditTable,
  dialogRef, operatorMenuRef, operatorTriggerRef, onCategoryContainerChange, children,
}: Props) {
  return (
    <motion.div className="modal-scrim account-scrim account-dialog-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section className="table-account-drawer" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Cuenta de ${tableName}`} variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Cerrar cuenta" onClick={onClose}><X size={19} /></button>
        <header className="account-heading">
          <div className="account-heading-content">
            <div className="account-heading-title">
              <h2>{tableName}</h2>
              <button type="button" className="icon-btn account-edit-button" aria-label="Editar mesa" onClick={onEditTable}><Pencil size={16} /></button>
              {table.billRequested && <span className="account-heading-status">Cuenta solicitada</span>}
            </div>
            <div className="account-heading-meta">
              <span className="account-guests"><UsersRound size={15} aria-hidden="true" /> {table.guests} {table.guests === 1 ? "persona" : "personas"}</span>
              {operator && <div className="account-operator" ref={operatorMenuRef}>
                <button ref={operatorTriggerRef} type="button" className="account-operator-trigger" aria-label={`Responsable de ${tableName}: ${operator.name}, ${operator.role}`} aria-haspopup="listbox" aria-expanded={operatorMenuOpen} aria-controls="account-operator-menu" onClick={() => onOperatorMenuOpenChange((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && !operatorMenuOpen) { event.preventDefault(); onOperatorMenuOpenChange(true); } }}>
                  <UserRound size={15} aria-hidden="true" /><span>{operator.name} <small>· {operator.role}</small></span><ChevronDown size={14} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {operatorMenuOpen && <motion.div id="account-operator-menu" className="account-operator-menu" role="listbox" aria-label="Elegir responsable" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transitions.fast}
                    onKeyDown={(event) => {
                      const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
                      const index = options.indexOf(document.activeElement as HTMLElement);
                      const target = event.key === "ArrowDown" ? (index + 1) % options.length : event.key === "ArrowUp" ? (index - 1 + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
                      if (target >= 0 && options.length) { event.preventDefault(); options[target].focus(); }
                    }}>
                    {(teamOptions.some((member) => member.id === operator.id) ? teamOptions : [operator, ...teamOptions]).map((member) => <button type="button" role="option" aria-selected={member.id === operator.id} key={member.id} onClick={() => { onOperatorMenuOpenChange(false); onOperatorChange(member.id); if (!table.items.length || member.id === operator.id) requestAnimationFrame(() => operatorTriggerRef.current?.focus({ preventScroll: true })); }}>
                      <span className="account-operator-initials" aria-hidden="true">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                      <span className="account-operator-info"><strong>{member.name}</strong><small>{member.role}</small></span>
                      {member.id === operator.id && <Check size={15} aria-hidden="true" />}
                    </button>)}
                  </motion.div>}
                </AnimatePresence>
              </div>}
            </div>
          </div>
          <div className="account-heading-categories" ref={onCategoryContainerChange} />
        </header>
        <div className="account-body">{children}</div>
      </motion.section>
    </motion.div>
  );
}
