import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Product } from "../data";
import { loadTeamMembers, type TeamMember } from "../stores/team";
import { allocateCounterTableNumber, ensureCounterTableSequenceAtLeast } from "../stores/counterSequence";
import { newLineId, NEW_COUNTER_TARGET, type Line, type Table } from "./floorModel";
import { lineUnitPrice, makeCounterTable, sameLinePrice } from "./accountModel";

type Props = {
  tables: Table[]; setTables: Dispatch<SetStateAction<Table[]>>; selectedId: string | null; selected: Table | null;
  products: Product[]; operator: TeamMember | null; setOperator: Dispatch<SetStateAction<TeamMember | null>>;
  setAccountOpen: Dispatch<SetStateAction<boolean>>; canOpenCounter: boolean;
  displayTableName: (table: Table) => string; onToast: (message: string) => void;
};

/** Artículos, descuentos y traslados de la cuenta activa. */
export function useTableAccount({ tables, setTables, selectedId, selected, products, operator, setOperator, setAccountOpen, canOpenCounter, displayTableName, onToast }: Props) {
  const [lineEditorId, setLineEditorId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lineNoteDraft, setLineNoteDraft] = useState("");
  const [linePriceDraft, setLinePriceDraft] = useState("");
  const [lineDiscountDraft, setLineDiscountDraft] = useState("");
  const [lineQuantityDraft, setLineQuantityDraft] = useState(1);
  const [lineEditorMode, setLineEditorMode] = useState<"note" | "move">("note");
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moveCovers, setMoveCovers] = useState(1);
  const [moveTargetOperatorId, setMoveTargetOperatorId] = useState("");
  const [sourceMovePin, setSourceMovePin] = useState("");
  const [targetMovePin, setTargetMovePin] = useState("");
  const [moveError, setMoveError] = useState("");
  const lineDialogRef = useRef<HTMLElement>(null);
  const lineOpenedAtRef = useRef(0);
  const update = (change: (table: Table) => Table) =>
    selectedId &&
    setTables((current) =>
      current.map((table) => (table.id === selectedId ? change(table) : table)),
    );
  const lines = (selected?.items || [])
    .map((line) => ({
      line,
      product: products.find((product) => product.id === line.productId),
    }))
    .filter((item) => item.product) as { line: Line; product: Product }[];
  const editorLine = selected?.items.find((line) => line.id === lineEditorId);
  const editorProduct = editorLine && products.find((product) => product.id === editorLine.productId);
  const moveWholeTable = lineEditorId === "__move_table__";
  const moveTarget = moveTargetId === NEW_COUNTER_TARGET && canOpenCounter
    ? makeCounterTable(tables, NEW_COUNTER_TARGET)
    : tables.find((table) => table.id === moveTargetId && table.id !== selectedId);
  const destinationOwner = moveTarget?.items.length
    ? moveTarget.operatorId
      ? loadTeamMembers().find((member) => member.id === moveTarget.operatorId)
      : loadTeamMembers().find((member) => member.id === Number(moveTargetOperatorId) && member.active)
    : operator;
  const sourceNeedsMovePin = Boolean(selected && !selected.operatorId);
  const destinationNeedsMovePin = Boolean(moveTarget?.items.length && destinationOwner && destinationOwner.id !== operator?.id);
  const subtotal = lines.reduce(
    (sum, { line, product }) => sum + line.quantity * lineUnitPrice(line, product.price),
    0,
  );
  const discount = Math.min(selected?.discount || 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  const addProduct = (productId: number) => {
    const lineId = newLineId();
    if (selected?.area === "counter" && selected.counterTurnNumber)
      ensureCounterTableSequenceAtLeast(selected.counterTurnNumber);
    const counterTurnNumber =
      selected?.area === "counter" && !selected.counterTurnNumber
        ? allocateCounterTableNumber(
            tables
              .filter((table) => table.area === "counter")
              .map((table) => table.counterTurnNumber || 0),
          )
        : undefined;
    update((table) => ({
      ...table,
      ...(counterTurnNumber ? { counterTurnNumber } : {}),
      billRequested: false,
      items: (() => {
        const existing = table.items.find((line) => line.productId === productId && !line.note && line.unitPrice === undefined && !line.unitDiscount);
        return existing
          ? table.items.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line)
          : [...table.items, { id: lineId, productId, quantity: 1, note: "" }];
      })(),
    }));
  };
  const changeQuantity = (lineId: string, amount: number) =>
    update((table) => {
      const items = table.items
        .map((line) =>
          line.id === lineId
            ? { ...line, quantity: line.quantity + amount }
            : line,
        )
        .filter((line) => line.quantity > 0);
      const remaining = items.reduce((sum, line) => sum + line.quantity * lineUnitPrice(line, products.find((product) => product.id === line.productId)?.price || 0), 0);
      return {
        ...table,
        billRequested: false,
        operatorId: items.length ? table.operatorId : undefined,
        counterTurnNumber: items.length ? table.counterTurnNumber : undefined,
        discount: Math.min(table.discount, remaining),
        items,
      };
    });
  const openLineEditor = (line: Line, mode: "note" | "move" = "note") => {
    lineOpenedAtRef.current = performance.now();
    setSelectedLineId(line.id);
    setLineEditorId(line.id);
    setLineNoteDraft(line.note || "");
    setLinePriceDraft(String(line.unitPrice ?? products.find((product) => product.id === line.productId)?.price ?? 0));
    setLineDiscountDraft(line.unitDiscount ? String(line.unitDiscount) : "");
    setLineQuantityDraft(1);
    setLineEditorMode(mode);
    setMoveTargetId("");
    setMoveCovers(1);
    setMoveTargetOperatorId("");
    setSourceMovePin("");
    setTargetMovePin("");
    setMoveError("");
  };
  const openTableMove = () => {
    lineOpenedAtRef.current = performance.now();
    setLineEditorId("__move_table__");
    setLineNoteDraft("");
    setLineEditorMode("move");
    setMoveTargetId("");
    setMoveCovers(1);
    setMoveTargetOperatorId("");
    setSourceMovePin("");
    setTargetMovePin("");
    setMoveError("");
  };
  const saveLineNote = () => {
    if (!editorLine || !editorProduct) return;
    const note = lineNoteDraft.trim();
    const unitPrice = linePriceDraft === "" || (editorLine.unitPrice === undefined && Number(linePriceDraft) === editorProduct.price) ? undefined : Number(linePriceDraft);
    const unitDiscount = lineDiscountDraft === "" ? 0 : Number(lineDiscountDraft);
    if ((unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice < 0)) || !Number.isFinite(unitDiscount) || unitDiscount < 0 || unitDiscount > (unitPrice ?? editorProduct.price)) return;
    const changed = note !== (editorLine.note || "") || unitPrice !== editorLine.unitPrice || unitDiscount !== (editorLine.unitDiscount || 0);
    const quantity = Math.min(editorLine.quantity, Math.max(1, Math.floor(lineQuantityDraft) || 1));
    const splitId = newLineId();
    update((table) => ({
      ...table,
      billRequested: changed ? false : table.billRequested,
      items: table.items.flatMap((line) => {
        if (line.id !== editorLine.id || !changed) return [line];
        if (quantity >= line.quantity) return [{ ...line, note, unitPrice, unitDiscount }];
        return [{ ...line, quantity: line.quantity - quantity }, { ...line, id: splitId, quantity, note, unitPrice, unitDiscount }];
      }),
    }));
    setLineEditorId(null);
  };
  const moveLineToTable = () => {
    if (!selected || !operator || !moveTarget || (!moveWholeTable && (!editorLine || !editorProduct))) return;
    if (sourceNeedsMovePin && sourceMovePin !== operator.pin) {
      setMoveError(`El código de ${operator.name} no es correcto.`);
      return;
    }
    if (moveTarget.items.length && !destinationOwner) {
      setMoveError(moveTarget.operatorId ? "El responsable de la mesa destino no está disponible. Actualizalo desde esa mesa." : "Elegí el responsable de la mesa destino.");
      return;
    }
    if (destinationNeedsMovePin && targetMovePin !== destinationOwner?.pin) {
      setMoveError(`El código de ${destinationOwner?.name} no es correcto.`);
      return;
    }
    const counterNumber = moveTarget.area === "counter" && !moveTarget.items.length && !moveTarget.counterTurnNumber
      ? allocateCounterTableNumber(tables.filter((table) => table.area === "counter").map((table) => table.counterTurnNumber || 0))
      : moveTarget.counterTurnNumber;
    const newCounter = moveTarget.id === NEW_COUNTER_TARGET ? { ...moveTarget, id: makeCounterTable(tables).id } : null;
    const destinationId = newCounter?.id || moveTarget.id;
    if (moveWholeTable) {
      setTables((current) => (newCounter ? [...current, newCounter] : current).flatMap((table) => {
        if (table.id === selected.id && table.area === "counter") return [];
        if (table.id === selected.id) return { ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined };
        if (table.id !== destinationId) return table;
        const items = table.items.map((line) => ({ ...line }));
        for (const line of selected.items) {
          const existing = items.find((item) => item.productId === line.productId && (item.note || "") === (line.note || "") && sameLinePrice(item, line));
          if (existing) existing.quantity += line.quantity;
          else items.push({ ...line });
        }
        const destinationSubtotal = table.items.reduce((sum, line) => sum + line.quantity * lineUnitPrice(line, products.find((product) => product.id === line.productId)?.price || 0), 0);
        return { ...table, items, discount: Math.min(table.discount, destinationSubtotal) + discount,
          billRequested: false, operatorId: table.operatorId || destinationOwner?.id || operator.id,
          guests: table.items.length ? table.guests + selected.guests : selected.guests, counterTurnNumber: counterNumber };
      }));
      setLineEditorId(null);
      setAccountOpen(false);
      setOperator(null);
      const name = moveTarget.area === "counter" && !moveTarget.items.length && counterNumber ? `Mesa ${counterNumber} de Mostrador` : displayTableName(moveTarget);
      onToast(`Cuenta movida a ${name}.`);
      return;
    }
    if (!editorLine) return;
    const quantity = Math.min(editorLine.quantity, Math.max(1, Math.floor(lineQuantityDraft) || 1));
    const movedId = newLineId();
    const movedNote = lineNoteDraft.trim();
    setTables((current) => (newCounter ? [...current, newCounter] : current).map((table) => {
      if (table.id === selected.id) {
        const items = table.items.flatMap((line) => line.id !== editorLine.id ? [line]
          : line.quantity > quantity ? [{ ...line, quantity: line.quantity - quantity }] : []);
        const remaining = items.reduce((sum, line) => sum + line.quantity * lineUnitPrice(line, products.find((product) => product.id === line.productId)?.price || 0), 0);
        return { ...table, items, discount: Math.min(table.discount, remaining), billRequested: false,
          operatorId: items.length ? table.operatorId || operator.id : undefined,
          counterTurnNumber: items.length ? table.counterTurnNumber : undefined };
      }
      if (table.id !== destinationId) return table;
      const matching = table.items.find((line) => line.productId === editorLine.productId && (line.note || "") === movedNote && sameLinePrice(line, editorLine));
      const items = matching
        ? table.items.map((line) => line.id === matching.id ? { ...line, quantity: line.quantity + quantity } : line)
        : [...table.items, { ...editorLine, id: movedId, quantity, note: movedNote }];
      return { ...table, items, billRequested: false, operatorId: table.operatorId || destinationOwner?.id || operator.id,
        guests: table.items.length ? table.guests : Math.min(20, Math.max(1, Math.floor(moveCovers) || 1)), counterTurnNumber: counterNumber };
    }));
    setLineEditorId(null);
    const destinationName = moveTarget.area === "counter" && !moveTarget.items.length && counterNumber
      ? `Mesa ${counterNumber} de Mostrador` : displayTableName(moveTarget);
    onToast(`${quantity} ${quantity === 1 ? "artículo movido" : "artículos movidos"} a ${destinationName}.`);
  };
  return { update, lines, editorLine, editorProduct, moveWholeTable, moveTarget, destinationOwner, sourceNeedsMovePin, destinationNeedsMovePin, subtotal, discount, total,
    lineEditorId, setLineEditorId, selectedLineId, setSelectedLineId, lineNoteDraft, setLineNoteDraft, linePriceDraft, setLinePriceDraft,
    lineDiscountDraft, setLineDiscountDraft, lineQuantityDraft, setLineQuantityDraft, lineEditorMode, setLineEditorMode, moveTargetId, setMoveTargetId,
    moveCovers, setMoveCovers, moveTargetOperatorId, setMoveTargetOperatorId, sourceMovePin, setSourceMovePin, targetMovePin, setTargetMovePin,
    moveError, setMoveError, lineDialogRef, lineOpenedAtRef, addProduct, changeQuantity, openLineEditor, openTableMove, saveLineNote, moveLineToTable };
}
