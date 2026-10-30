import type { Dispatch, RefObject, SetStateAction } from "react";
import { motion } from "motion/react";
import { ArrowRightLeft, BadgePercent, Check, LayoutGrid, Pencil, X } from "lucide-react";
import { money, type Product } from "../../data";
import { modalVariants, overlayVariants } from "../../motion";
import { NEW_COUNTER_TARGET, type Line, type Sector, type Table } from "../../pos/floorModel";
import type { TeamMember } from "../../stores/team";

type Props = {
  lineDialogRef: RefObject<HTMLElement | null>;
  lineOpenedAtRef: RefObject<number>;
  displayTableName: (table: Table) => string;
  state: {
    selected: Table;
    selectedId: string | null;
    editorLine?: Line;
    editorProduct?: Product;
    moveWholeTable: boolean;
    lineEditorMode: "note" | "move";
    total: number;
    linePriceDraft: string;
    lineDiscountDraft: string;
    lineNoteDraft: string;
    lineQuantityDraft: number;
    moveTargetId: string;
    moveTarget?: Table;
    moveCovers: number;
    moveTargetOperatorId: string;
    sourceMovePin: string;
    targetMovePin: string;
    moveError: string;
    sectors: Sector[];
    tables: Table[];
    canOpenCounter: boolean;
    operator: TeamMember | null;
    teamOptions: TeamMember[];
    destinationOwner?: TeamMember | null;
    sourceNeedsMovePin: boolean;
    destinationNeedsMovePin: boolean;
  };
  actions: {
    setLineEditorId: Dispatch<SetStateAction<string | null>>;
    setLineEditorMode: Dispatch<SetStateAction<"note" | "move">>;
    setLinePriceDraft: Dispatch<SetStateAction<string>>;
    setLineDiscountDraft: Dispatch<SetStateAction<string>>;
    setLineNoteDraft: Dispatch<SetStateAction<string>>;
    setLineQuantityDraft: Dispatch<SetStateAction<number>>;
    saveLineNote: () => void;
    setMoveTargetId: Dispatch<SetStateAction<string>>;
    setMoveCovers: Dispatch<SetStateAction<number>>;
    setMoveTargetOperatorId: Dispatch<SetStateAction<string>>;
    setSourceMovePin: Dispatch<SetStateAction<string>>;
    setTargetMovePin: Dispatch<SetStateAction<string>>;
    setMoveError: Dispatch<SetStateAction<string>>;
    moveLineToTable: () => void;
  };
};

export default function LineEditorDialog({ state, actions, lineDialogRef, lineOpenedAtRef, displayTableName }: Props) {
  const {
    selected, selectedId, editorLine, editorProduct, moveWholeTable, lineEditorMode,
    total, linePriceDraft, lineDiscountDraft, lineNoteDraft, lineQuantityDraft,
    moveTargetId, moveTarget, moveCovers, moveTargetOperatorId, sourceMovePin,
    targetMovePin, moveError, sectors, tables, canOpenCounter, operator,
    teamOptions, destinationOwner, sourceNeedsMovePin, destinationNeedsMovePin,
  } = state;
  const {
    setLineEditorId, setLineEditorMode, setLinePriceDraft, setLineDiscountDraft,
    setLineNoteDraft, setLineQuantityDraft, saveLineNote, setMoveTargetId,
    setMoveCovers, setMoveTargetOperatorId, setSourceMovePin, setTargetMovePin,
    setMoveError, moveLineToTable,
  } = actions;
  return (
    <motion.div className="modal-scrim line-editor-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={() => { if (performance.now() - lineOpenedAtRef.current > 400) setLineEditorId(null); }}>
      <motion.section ref={lineDialogRef} className={`acrylic-modal line-editor-modal${lineEditorMode === "note" ? " line-item-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="line-editor-title"
        variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)"));
          if (!focusable.length) return;
          if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
          else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
        }}>
        <button className="modal-close" aria-label={moveWholeTable ? "Cerrar traslado de cuenta" : "Cerrar detalle del artículo"} onClick={() => setLineEditorId(null)}><X size={19} /></button>
        <span className="eyebrow">{moveWholeTable ? "TRASLADO DE CUENTA" : "ARTÍCULO DE LA CUENTA"}</span>
        <h2 id="line-editor-title">{moveWholeTable ? `Mover ${displayTableName(selected)}` : editorProduct?.name}</h2>
        <p className="line-editor-subtitle">{moveWholeTable ? `${selected.items.reduce((sum, line) => sum + line.quantity, 0)} artículos · ${money(total)}` : `${editorLine?.quantity} ${editorLine?.quantity === 1 ? "unidad" : "unidades"} · ${money(editorProduct!.price)} por unidad`}</p>
        {lineEditorMode === "note" && editorLine ? <>
          <div className="line-item-section">
            <div className="line-item-section-heading"><strong><BadgePercent size={16} aria-hidden="true" /> Precio y descuento</strong><span>Por unidad</span></div>
            <div className="line-price-fields">
              <label className="field line-editor-field">Precio
                <span className="line-money-input"><span aria-hidden="true">$</span><input aria-label="Precio por unidad ($)" type="number" min="0" step="1" inputMode="numeric" value={linePriceDraft} onDoubleClick={(event) => event.currentTarget.select()} onChange={(event) => setLinePriceDraft(event.target.value)} /></span>
              </label>
              <label className="field line-editor-field">Descuento
                <span className="line-money-input"><span aria-hidden="true">$</span><input aria-label="Descuento por unidad ($)" type="number" min="0" step="1" inputMode="numeric" value={lineDiscountDraft} onChange={(event) => setLineDiscountDraft(event.target.value)} placeholder="0" /></span>
              </label>
            </div>
            {Number(lineDiscountDraft) > (linePriceDraft === "" ? editorProduct!.price : Number(linePriceDraft)) && <p className="line-editor-error" role="alert">El descuento no puede superar el precio por unidad.</p>}
            <div className="line-item-price-summary"><span>Precio final por unidad</span><strong>{money(Math.max(0, (linePriceDraft === "" ? editorProduct!.price : Number(linePriceDraft) || 0) - (Number(lineDiscountDraft) || 0)))}</strong></div>
          </div>
          <label className="field line-editor-field line-item-note"><span className="line-item-label"><Pencil size={15} aria-hidden="true" /> Aclaración</span><span className="line-item-optional">Opcional</span>
            <textarea aria-label="Aclaración" maxLength={200} value={lineNoteDraft} onChange={(event) => setLineNoteDraft(event.target.value)} placeholder="Ej. sin azúcar, leche vegetal…" />
          </label>
          {editorLine.quantity > 1 && <label className="line-item-quantity"><span><strong><LayoutGrid size={15} aria-hidden="true" /> Aplicar cambios</strong><small>Elegí cuántas unidades modificar</small></span><span className="line-item-quantity-input"><input aria-label="Aplicar a cuántas unidades" type="number" min={1} max={editorLine.quantity} value={lineQuantityDraft} onChange={(event) => setLineQuantityDraft(Math.min(editorLine.quantity, Math.max(1, Math.floor(Number(event.target.value) || 1))))} /><span>de {editorLine.quantity}</span></span></label>}
          <div className="line-editor-actions">
            <button className="button" onClick={() => { setLineEditorMode("move"); setMoveError(""); }}><ArrowRightLeft size={15} /> Mover a otra mesa</button>
            <button className="button primary" disabled={Number(lineDiscountDraft) > (linePriceDraft === "" ? editorProduct!.price : Number(linePriceDraft)) || Number(linePriceDraft) < 0 || Number(lineDiscountDraft) < 0} onClick={saveLineNote}><Check size={15} aria-hidden="true" /> Guardar cambios</button>
          </div>
        </> : <>
          <label className="field line-editor-field">Mesa de destino
            <select value={moveTargetId} onChange={(event) => { setMoveTargetId(event.target.value); setMoveTargetOperatorId(""); setSourceMovePin(""); setTargetMovePin(""); setMoveError(""); }}>
              <option value="">Elegí una mesa</option>
              {sectors.map((area) => <optgroup key={area.id} label={area.label}>{tables.filter((table) => table.area === area.id && table.id !== selectedId && (area.id !== "counter" || table.items.length || table.billRequested)).map((table) => <option key={table.id} value={table.id}>{displayTableName(table)} · {table.items.length ? table.billRequested ? "Cuenta solicitada" : "Ocupada" : "Libre"}</option>)}{area.id === "counter" && canOpenCounter && <option value={NEW_COUNTER_TARGET}>Puesto libre 1 · Libre</option>}</optgroup>)}
            </select>
          </label>
          {!moveWholeTable && editorLine && editorLine.quantity > 1 && <label className="field line-editor-field">Cantidad a mover
            <input type="number" min={1} max={editorLine.quantity} value={lineQuantityDraft} onChange={(event) => setLineQuantityDraft(Math.min(editorLine.quantity, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
          </label>}
          {moveTarget && !moveTarget.items.length && !moveWholeTable && <label className="field line-editor-field">Cubiertos de la mesa destino
            <input type="number" min={1} max={20} value={moveCovers} onChange={(event) => setMoveCovers(Math.min(20, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
            <small>La mesa se abrirá a nombre de {operator?.name}.</small>
          </label>}
          {moveTarget && moveTarget.items.length > 0 && !moveTarget.operatorId && <label className="field line-editor-field">Responsable de la mesa destino
            <select value={moveTargetOperatorId} onChange={(event) => { setMoveTargetOperatorId(event.target.value); setTargetMovePin(""); setMoveError(""); }}>
              <option value="">Elegí un empleado</option>{teamOptions.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}
            </select>
          </label>}
          {moveTarget?.billRequested && <p className="line-editor-notice">La cuenta solicitada volverá a estar abierta al agregar consumos.</p>}
          {moveWholeTable && moveTarget && <p className="line-editor-notice">Se trasladan los consumos, los cubiertos y el descuento. {moveTarget.items.length ? "Se sumarán a la cuenta de destino." : `La cuenta quedará a nombre de ${operator?.name}.`}</p>}
          {!moveWholeTable && moveTarget && selected.discount ? <p className="line-editor-notice">El descuento queda en la mesa de origen y se ajusta si supera el saldo restante.</p> : null}
          {!moveWholeTable && lineNoteDraft.trim() && <p className="line-editor-note-preview">Aclaración que se moverá: <strong>{lineNoteDraft.trim()}</strong></p>}
          {moveTarget && sourceNeedsMovePin && <label className="field line-editor-field">Código de {operator?.name}
            <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={sourceMovePin} onChange={(event) => { setSourceMovePin(event.target.value.replace(/\D/g, "").slice(0, 4)); setMoveError(""); }} />
            <small>Confirmá la primera comanda antes de moverla.</small>
          </label>}
          {moveTarget && destinationNeedsMovePin && <label className="field line-editor-field">Código de {destinationOwner?.name}
            <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={targetMovePin} onChange={(event) => { setTargetMovePin(event.target.value.replace(/\D/g, "").slice(0, 4)); setMoveError(""); }} />
            <small>Confirmá el responsable de la mesa destino.</small>
          </label>}
          {moveError && <p className="line-editor-error" role="alert">{moveError}</p>}
          <div className="line-editor-actions">
            <button className="button" onClick={() => { if (moveWholeTable) setLineEditorId(null); else setLineEditorMode("note"); setMoveError(""); }}>Volver</button>
            <button className="button primary" disabled={!moveTarget} onClick={moveLineToTable}>{moveWholeTable ? "Mover cuenta" : "Mover artículo"}</button>
          </div>
        </>}
      </motion.section>
    </motion.div>
  );
}
