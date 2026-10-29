import { motion } from "motion/react";
import { X } from "lucide-react";
import { fadeUp, overlayVariants } from "../../motion";
import type { Area, Sector, Table } from "../../pos/floorModel";

type Props = {
  table: Table;
  tableName: string;
  sectors: Sector[];
  tables: Table[];
  onNameChange: (name: string) => void;
  onAreaChange: (area: Area) => void;
  onClose: () => void;
};

export default function TableEditDialog({ table, tableName, sectors, tables, onNameChange, onAreaChange, onClose }: Props) {
  return (
    <>
      <motion.div className="modal-scrim nested-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" />
      <motion.div className="acrylic-modal compact-modal table-edit-modal" role="dialog" aria-modal="true" variants={fadeUp} initial="hidden" animate="visible" exit="exit">
        <button className="modal-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">DATOS DE LA MESA</span>
        <h2>Editar {tableName}</h2>
        <label className="field">Nombre<input value={table.name} onChange={(event) => onNameChange(event.target.value)} /></label>
        <label className="field">Sector
          <select value={table.area} onChange={(event) => onAreaChange(event.target.value as Area)}>
            {sectors.map((area) => (
              <option value={area.id} disabled={table.area !== area.id && (table.area === "counter" || area.id === "counter" || (area.limit !== undefined && tables.filter((candidate) => candidate.area === area.id).length >= area.limit))} key={area.id}>
                {area.label}{area.limit ? ` (máx. ${area.limit})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary full" onClick={onClose}>Guardar cambios</button>
      </motion.div>
    </>
  );
}
