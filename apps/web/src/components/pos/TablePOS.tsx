import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import {
  Check,
  GripVertical,
  Grid2X2,
  LayoutGrid,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type { Product } from "../../data";
import { useFloorInteractions } from "../../pos/useFloorInteractions";
import { useFloorEditor } from "../../pos/useFloorEditor";
import { useFloorLayout } from "../../pos/useFloorLayout";
import { useTableAccount } from "../../pos/useTableAccount";
import { lineUnitPrice, makeCounterTable } from "../../pos/accountModel";
import { money } from "../../data";
import { press, transitions } from "../../motion";
import {
  loadTeamMembers,
  type TeamMember,
} from "../../stores/team";
import type { Stock } from "../../stores/inventory";
import { settleSaleLocally } from "../../stock/settleSale";
import PosCatalog from "./PosCatalog";
import PosAccountTicket from "./PosAccountTicket";
import PosPaymentDialog, { type PaymentMethod } from "./PosPaymentDialog";
import EmployeePickerDialog from "./dialogs/EmployeePickerDialog";
import CoversDialog from "./dialogs/CoversDialog";
import EmployeePinDialog from "./dialogs/EmployeePinDialog";
import TableEditDialog from "./dialogs/TableEditDialog";
import LineEditorDialog from "./dialogs/LineEditorDialog";
import AccountDialog from "./dialogs/AccountDialog";
import {
  KEY, SECTORS_KEY, COUNTER_LIMIT, TABLE_SLOT_LIMIT, compactCounterSlots, loadSectors, makeDefaultMosaic, loadInitialFloor,
  type Area, type Sector, type Table, type PinPurpose,
} from "../../pos/floorModel";
import { previewCounterTableNumber } from "../../stores/counterSequence";

export default function TablePOS({
  products,
  categories,
  onToast,
  onStockChange,
}: {
  products: Product[];
  categories: string[];
  onToast: (message: string) => void;
  onStockChange: (stock: Stock) => void;
}) {
  const [tables, setTables] = useState<Table[]>(loadInitialFloor);
  const [sectors, setSectors] = useState<Sector[]>(loadSectors);
  const [tableColumns, setTableColumns] = useState<Record<Area, number>>({});
  const reducedMotion = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const accountDialogRef = useRef<HTMLElement>(null);
  const [categoryContainer, setCategoryContainer] = useState<HTMLDivElement | null>(null);
  const [boardHeight, setBoardHeight] = useState(400);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [previousOperator, setPreviousOperator] = useState<TeamMember | null>(null);
  const [coversOpen, setCoversOpen] = useState(false);
  const [coversDraft, setCoversDraft] = useState(2);
  const [teamOptions, setTeamOptions] = useState<TeamMember[]>([]);
  const [operator, setOperator] = useState<TeamMember | null>(null);
  const [operatorMenuOpen, setOperatorMenuOpen] = useState(false);
  const operatorMenuRef = useRef<HTMLDivElement>(null);
  const operatorTriggerRef = useRef<HTMLButtonElement>(null);
  const [exitPinOpen, setExitPinOpen] = useState(false);
  const exitPinOpenRef = useRef(false);
  exitPinOpenRef.current = exitPinOpen;
  const [exitPin, setExitPin] = useState("");
  const [exitPinError, setExitPinError] = useState("");
  const [pinPurpose, setPinPurpose] = useState<PinPurpose>("enter");
  const [layoutMode, setLayoutMode] = useState(false);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [utilityRail, setUtilityRail] = useState<HTMLElement | null>(null);
  const planTriggerRef = useRef<HTMLButtonElement>(null);
  const planControlsRef = useRef<HTMLDivElement>(null);
  const [counterHovered, setCounterHovered] = useState(false);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [activeArea, setActiveArea] = useState<Area>("salon");
  const [payment, setPayment] = useState<PaymentMethod>("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentDialogRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [confirmClearTable, setConfirmClearTable] = useState(false);
  const scrollUnlockTimer = useRef<number | null>(null);
  const scrollLockSnapshot = useRef<{
    bodyOverflow: string;
    rootOverflow: string;
    scrollY: number;
  } | null>(null);
  const selected = tables.find((table) => table.id === selectedId) || null;
  const displayTableName = (table: Table) =>
    table.area === "counter" && table.counterTurnNumber
      ? `Mesa ${table.counterTurnNumber}`
      : table.area === "counter" && !layoutMode && !table.items.length
        ? "Nueva mesa"
        : table.name;
  const displayTableNumber = (table: Table) =>
    displayTableName(table).match(/\d+/)?.[0] || displayTableName(table);
  const areaCounts = Object.fromEntries(sectors.map((area) => [area.id, tables.filter((table) => table.area === area.id).length]));
  const canOpenCounter = sectors.some((sector) => sector.id === "counter") && (areaCounts.counter || 0) < COUNTER_LIMIT;
  const floorCapacity = sectors.reduce((sum, sector) => sum + sector.limit, 0);
  const isFreeform = sectors.every((sector) => Boolean(sector.layout));
  const { sectorName, setSectorName, addingSector, setAddingSector, addingTables, setAddingTables,
    addArea, setAddArea, addCount, setAddCount, selectingTables, setSelectingTables,
    selectedTableIds, setSelectedTableIds, confirmDeleteTables, setConfirmDeleteTables,
    occupiedSelection, openAddTables, createTables, deleteSelectedTables, arrangeTables, moveSelectedArea, createSector, deleteSector,
  } = useFloorEditor({ tables, setTables, sectors, setSectors, selected, setSelectedId, activeArea, setActiveArea,
    setLayoutMode, areaCounts, isFreeform, boardHeight, onToast });
  useEffect(() => {
    setUtilityRail(document.querySelector<HTMLElement>(".workspace-utility-rail"));
  }, []);
  useEffect(() => {
    if (!planMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!planControlsRef.current?.contains(event.target as Node)) {
        setPlanMenuOpen(false);
        setAddingTables(false);
        setAddingSector(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPlanMenuOpen(false);
      setAddingTables(false);
      setAddingSector(false);
      planTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [planMenuOpen, setAddingTables, setAddingSector]);
  const { update, lines, editorLine, editorProduct, moveWholeTable, moveTarget, destinationOwner,
    sourceNeedsMovePin, destinationNeedsMovePin, subtotal, discount, total,
    lineEditorId, setLineEditorId, selectedLineId, setSelectedLineId, lineNoteDraft, setLineNoteDraft,
    linePriceDraft, setLinePriceDraft, lineDiscountDraft, setLineDiscountDraft, lineQuantityDraft, setLineQuantityDraft,
    lineEditorMode, setLineEditorMode, moveTargetId, setMoveTargetId, moveCovers, setMoveCovers,
    moveTargetOperatorId, setMoveTargetOperatorId, sourceMovePin, setSourceMovePin, targetMovePin, setTargetMovePin,
    moveError, setMoveError, lineDialogRef, lineOpenedAtRef, addProduct, changeQuantity, openLineEditor,
    openTableMove, saveLineNote, moveLineToTable,
  } = useTableAccount({ tables, setTables, selectedId, selected, products, operator, setOperator, setAccountOpen,
    canOpenCounter, displayTableName, onToast });
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;
  const { draggedTableId, setDraggedTableId, dropTarget, setDropTarget, suppressTableClickRef,
    draggingSectorId, resizingSectorId, sectorGestureSettling, resizeRef, suppressSectorClick,
    startSectorDrag, moveSectorDrag, finishSectorDrag, moveSectorWithKeyboard,
    startSectorResize, moveSectorResize, finishSectorResize, resizeSectorWithKeyboard,
    slotAtPointer, moveTableTo, startTableTouch, moveTableTouch, finishTableTouch,
  } = useFloorInteractions({ boardRef, boardHeight, setBoardHeight, sectorsRef, sectors, setSectors, tables, setTables,
    areaCounts, layoutMode, selectingTables, setActiveArea, setSelectedId, setTableColumns, onToast });
  const { normalizedLayoutRef, autoFitWidthRef } = useFloorLayout({ boardRef, sectorsRef, resizeRef, sectors, setSectors, tables,
    tableColumns, setTableColumns, setBoardHeight, layoutMode, isFreeform, draggingSectorId, resizingSectorId });
  const openNextCounter = () => {
    if (!canOpenCounter) return;
    const nextTable = makeCounterTable(tables);
    setTables((current) => [...current, nextTable]);
    setSelectedId(nextTable.id);
    setTeamOptions(loadTeamMembers().filter((member) => member.active));
    setOperator(null);
    setEmployeePickerOpen(true);
  };
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(tables)), [tables]);
  useEffect(() => localStorage.setItem(SECTORS_KEY, JSON.stringify(sectors)), [sectors]);
  useEffect(() => {
    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };
    const leaveWindow = () => { pointerPositionRef.current = null; setCounterHovered(false); };
    document.addEventListener("pointermove", trackPointer, true);
    document.addEventListener("mouseleave", leaveWindow);
    return () => {
      document.removeEventListener("pointermove", trackPointer, true);
      document.removeEventListener("mouseleave", leaveWindow);
    };
  }, []);
  useLayoutEffect(() => {
    if (accountOpen || employeePickerOpen || coversOpen || exitPinOpen || layoutMode) return;
    const syncCounterHover = () => {
      const point = pointerPositionRef.current;
      const counter = boardRef.current?.querySelector<HTMLElement>('[data-sector-id="counter"]');
      if (!counter) { setCounterHovered(false); return; }
      if (!point) { setCounterHovered(counter.matches(":hover")); return; }
      const rect = counter.getBoundingClientRect();
      setCounterHovered(point.x >= 0 && point.y >= 0 && point.x < window.innerWidth && point.y < window.innerHeight &&
        point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom);
    };
    syncCounterHover();
    // El bloqueo de la página restaura el scroll después de la salida del modal.
    const timer = window.setTimeout(syncCounterHover, 270);
    window.addEventListener("scroll", syncCounterHover, true);
    window.addEventListener("resize", syncCounterHover);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", syncCounterHover, true);
      window.removeEventListener("resize", syncCounterHover);
    };
  }, [accountOpen, employeePickerOpen, coversOpen, exitPinOpen, layoutMode, sectors]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        !counterHovered ||
        layoutMode ||
        !canOpenCounter ||
        accountOpen ||
        employeePickerOpen ||
        coversOpen ||
        exitPinOpen
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      openNextCounter();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    accountOpen,
    counterHovered,
    coversOpen,
    employeePickerOpen,
    exitPinOpen,
    canOpenCounter,
    layoutMode,
  ]);
  useLayoutEffect(() => {
    if (!accountOpen && !employeePickerOpen && !coversOpen && !exitPinOpen) return;
    if (scrollUnlockTimer.current !== null) {
      window.clearTimeout(scrollUnlockTimer.current);
      scrollUnlockTimer.current = null;
    }
    const body = document.body;
    const root = document.documentElement;
    if (!scrollLockSnapshot.current) {
      scrollLockSnapshot.current = {
        bodyOverflow: body.style.overflow,
        rootOverflow: root.style.overflow,
        scrollY: window.scrollY,
      };
    }
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    return () => {
      scrollUnlockTimer.current = window.setTimeout(() => {
        const snapshot = scrollLockSnapshot.current;
        if (snapshot) {
          body.style.overflow = snapshot.bodyOverflow;
          root.style.overflow = snapshot.rootOverflow;
          window.scrollTo({
            top: snapshot.scrollY,
            left: 0,
            behavior: "instant",
          });
          scrollLockSnapshot.current = null;
        }
        scrollUnlockTimer.current = null;
      }, 240);
    };
  }, [accountOpen, employeePickerOpen, coversOpen, exitPinOpen]);
  useEffect(() => {
    if (!accountOpen && !editing && !employeePickerOpen && !coversOpen && !exitPinOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (operatorMenuOpen) { setOperatorMenuOpen(false); operatorTriggerRef.current?.focus(); }
      else if (lineEditorId) setLineEditorId(null);
      else if (editing) setEditing(false);
      else if (exitPinOpen) cancelOperatorPin();
      else if (paymentOpen) setPaymentOpen(false);
      else if (confirmClearTable) setConfirmClearTable(false);
      else if (discountOpen) setDiscountOpen(false);
      else if (coversOpen) {
        setCoversOpen(false);
        setEmployeePickerOpen(true);
      }
      else if (employeePickerOpen) cancelEmployeeSelection();
      else if (accountOpen) requestAccountClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [accountOpen, editing, employeePickerOpen, coversOpen, exitPinOpen, operator, selected, lineEditorId, discountOpen, confirmClearTable, paymentOpen, operatorMenuOpen]);
  useEffect(() => {
    if (!accountOpen) { setSelectedLineId(null); setDiscountOpen(false); setConfirmClearTable(false); setPaymentOpen(false); setOperatorMenuOpen(false); }
  }, [accountOpen, selectedId]);
  useEffect(() => {
    if (!operatorMenuOpen) return;
    const frame = requestAnimationFrame(() => operatorMenuRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus({ preventScroll: true }));
    const closeOutside = (event: PointerEvent) => {
      if (!operatorMenuRef.current?.contains(event.target as Node)) setOperatorMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", closeOutside); };
  }, [operatorMenuOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => accountDialogRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [accountOpen]);
  useEffect(() => {
    if (!accountOpen || editing || exitPinOpen || lineEditorId || paymentOpen) return;
    const keepFocusInAccount = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !accountDialogRef.current) return;
      const focusable = Array.from(accountDialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"))
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === accountDialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInAccount);
    return () => document.removeEventListener("keydown", keepFocusInAccount);
  }, [accountOpen, editing, exitPinOpen, lineEditorId, paymentOpen]);
  useEffect(() => {
    if (!paymentOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => paymentDialogRef.current?.querySelector<HTMLElement>('input[type="radio"]')?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(frame); if (!exitPinOpenRef.current && previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [paymentOpen]);
  useEffect(() => {
    if (!lineEditorId) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => lineDialogRef.current?.querySelector<HTMLElement>("textarea, select, input")?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [lineEditorId]);
  useEffect(() => {
    if (!lineEditorId || lineEditorMode !== "move") return;
    const frame = requestAnimationFrame(() => lineDialogRef.current?.querySelector<HTMLElement>("select")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [lineEditorId, lineEditorMode]);
  const tableTotal = (table: Table) => {
    const tableSubtotal = table.items.reduce(
      (sum, line) =>
        sum +
        lineUnitPrice(line, products.find((product) => product.id === line.productId)?.price || 0) *
          line.quantity,
      0,
    );
    return Math.max(0, tableSubtotal - Math.min(table.discount, tableSubtotal));
  };
  const openTable = (id: string) => {
    setSelectedId(id);
    if (!layoutMode) {
      const team = loadTeamMembers().filter((member) => member.active);
      const table = tables.find((item) => item.id === id);
      const assigned = table?.items.length
        ? team.find((member) => member.id === table.operatorId)
        : undefined;
      setTeamOptions(team);
      setOperator(assigned || null);
      if (assigned) {
        setExitPin("");
        setExitPinError("");
        setPinPurpose("enter");
        setExitPinOpen(true);
      } else {
        setEmployeePickerOpen(true);
      }
    }
  };
  const chooseOperator = (member: TeamMember) => {
    setOperator(member);
    setEmployeePickerOpen(false);
    if (selected?.items.length) {
      setExitPin("");
      setExitPinError("");
      setPinPurpose("enter");
      setExitPinOpen(true);
    } else {
      setCoversDraft(2);
      setCoversOpen(true);
    }
  };
  const changeOperator = (memberId: number) => {
    const members = loadTeamMembers().filter((member) => member.active);
    setTeamOptions(members);
    const member = members.find((item) => item.id === memberId);
    if (!member || member.id === operator?.id) return;
    if (selected?.items.length) {
      setPreviousOperator(operator);
      setOperator(member);
      setExitPin("");
      setExitPinError("");
      setPinPurpose("transfer");
      setExitPinOpen(true);
      return;
    }
    setPreviousOperator(null);
    setOperator(member);
    onToast(`${member.name} quedó a cargo de ${selected ? displayTableName(selected) : "la mesa"}.`);
  };
  const cancelEmployeeSelection = () => {
    if (selected?.area === "counter" && !selected.items.length) setTables((current) => compactCounterSlots(current.filter((table) => table.id !== selected.id)));
    setEmployeePickerOpen(false);
    setSelectedId(null);
  };
  const cancelOperatorPin = () => {
    if (pinPurpose === "transfer") {
      setOperator(previousOperator);
      setPreviousOperator(null);
    }
    if (pinPurpose === "settle") setPaymentOpen(true);
    setExitPinOpen(false);
    setExitPin("");
    setExitPinError("");
  };
  const confirmCovers = () => {
    if (!selected || !operator) return;
    const guests = Math.min(20, Math.max(1, Math.floor(coversDraft) || 1));
    const counterTurnNumber =
      selected.area === "counter" && !selected.counterTurnNumber
        ? previewCounterTableNumber(
            tables
              .filter((table) => table.area === "counter")
              .map((table) => table.counterTurnNumber || 0),
          )
        : undefined;
    update((table) => ({
      ...table,
      guests,
      ...(counterTurnNumber ? { counterTurnNumber } : {}),
    }));
    setCoversOpen(false);
    setAccountOpen(true);
  };
  const returnToEmployeePicker = () => {
    setCoversOpen(false);
    setEmployeePickerOpen(true);
  };
  const requestAccountClose = () => {
    if (selected?.items.length && !selected.operatorId && operator) {
      setExitPin("");
      setExitPinError("");
      setPinPurpose("confirm-command");
      setExitPinOpen(true);
      return;
    }
    if (selected?.area === "counter" && !selected.items.length)
      setTables((current) => compactCounterSlots(current.filter((table) => table.id !== selected.id)));
    setAccountOpen(false);
    setOperator(null);
  };
  const verifyOperatorPin = () => {
    if (!operator || exitPin !== operator.pin) {
      setExitPinError("El código no corresponde al empleado seleccionado.");
      setExitPin("");
      return;
    }
    if (pinPurpose === "confirm-command") {
      update((table) => ({ ...table, operatorId: operator.id }));
      setExitPinOpen(false);
      setAccountOpen(false);
      setOperator(null);
      onToast(`${operator.name} confirmó la comanda de ${selected ? displayTableName(selected) : "la mesa"}.`);
      return;
    }
    if (pinPurpose === "request-bill") {
      update((table) => ({
        ...table,
        operatorId: operator.id,
        billRequested: true,
      }));
      setExitPinOpen(false);
      setAccountOpen(false);
      setOperator(null);
      onToast(`${selected ? displayTableName(selected) : "La mesa"}: cuenta entregada, pendiente de cobro.`);
      return;
    }
    if (pinPurpose === "settle") {
      setExitPinOpen(false);
      closeSale();
      return;
    }
    if (pinPurpose === "transfer") {
      update((table) => ({ ...table, operatorId: operator.id }));
      setExitPinOpen(false);
      setExitPin("");
      setExitPinError("");
      setPreviousOperator(null);
      setAccountOpen(true);
      onToast(`${operator.name} quedó a cargo de ${selected ? displayTableName(selected) : "la mesa"}.`);
      return;
    }
    if (selected?.items.length && selected.operatorId !== operator.id)
      update((table) => ({ ...table, operatorId: operator.id }));
    setExitPinOpen(false);
    setAccountOpen(true);
    onToast(`${operator.name} ingresó a ${selected ? displayTableName(selected) : "la mesa"}.`);
  };
  const closingSaleRef = useRef(false);
  useEffect(() => { if (!accountOpen) closingSaleRef.current = false; }, [accountOpen]);
  const closeSale = () => {
    if (!selected || !selected.items.length || !payment || closingSaleRef.current) return;
    if (localStorage.getItem(KEY) !== JSON.stringify(tables)) {
      onToast("El plano cambió en otra pestaña. Recargá antes de cobrar.");
      return;
    }
    closingSaleRef.current = true;
    const name = displayTableName(selected);
    const closedAt = new Date().toISOString();
    const subtotalAmount = lines.reduce(
      (sum, { line, product }) => sum + line.quantity * lineUnitPrice(line, product.price),
      0,
    );
    const sale = {
      id: `${selected.id}-${Date.now()}`,
      tableName: name,
      closedAt,
      guests: selected.guests,
      subtotal: subtotalAmount,
      discount,
      total,
      payment,
      items: lines.map(({ line, product }) => ({
        productId: product.id,
        name: product.name,
        category: product.category,
        quantity: line.quantity,
        unitPrice: lineUnitPrice(line, product.price),
        ...(line.note ? { note: line.note } : {}),
      })),
    };
    const nextTables = selected.area === "counter"
      ? compactCounterSlots(tables.filter((table) => table.id !== selected.id))
      : tables.map((table) => table.id === selected.id ? { ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined } : table);
    try {
      onStockChange(settleSaleLocally(sale, products, KEY, nextTables));
    } catch (error) {
      closingSaleRef.current = false;
      onToast(error instanceof Error && error.message.startsWith("Stock insuficiente:") ? error.message : "No se pudo cerrar la mesa. Revisá las recetas y el almacenamiento del navegador.");
      return;
    }
    setTables(nextTables);
    setAccountOpen(false);
    setOperator(null);
    onToast(`${name} cobrada y cerrada por ${money(total)} · ${payment}.`);
  };
  const confirmPayment = () => {
    if (!selected || !selected.items.length || !payment) return;
    setPaymentOpen(false);
    if (!selected.operatorId && operator) {
      setExitPin("");
      setExitPinError("");
      setPinPurpose("settle");
      setExitPinOpen(true);
      return;
    }
    closeSale();
  };
  const toggleBillRequest = () => {
    if (!selected) return;
    const next = !selected.billRequested;
    if (next && !selected.operatorId && operator) {
      setExitPin("");
      setExitPinError("");
      setPinPurpose("request-bill");
      setExitPinOpen(true);
      return;
    }
    update((table) => ({ ...table, billRequested: next }));
    onToast(next ? `${displayTableName(selected)}: cuenta entregada, pendiente de cobro.` : `${displayTableName(selected)} volvió a consumo.`);
    if (next) { setAccountOpen(false); setOperator(null); }
  };
  return (
    <div className="floor-manager">
      {utilityRail && createPortal(<div className="floor-plan-controls" ref={planControlsRef}>
          <button
            ref={planTriggerRef}
            type="button"
            className={`utility-rail-button floor-plan-trigger${layoutMode ? " is-editing" : ""}`}
            aria-label="Configurar plano de mesas"
            title="Configurar plano de mesas"
            aria-expanded={planMenuOpen}
            aria-controls="floor-plan-tools"
            onClick={() => {
              setPlanMenuOpen((open) => !open);
              setAddingTables(false);
              setAddingSector(false);
            }}
          >
            <Settings2 size={17} aria-hidden="true" />
          </button>
        <AnimatePresence initial={false}>
          {planMenuOpen && (
            <motion.div
              id="floor-plan-tools"
              className="floor-plan-popover"
              initial={{ opacity: 0, x: 8, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0 : 0.16, ease: "easeOut" }}
            >
          <div className="floor-plan-toolbar" role="group" aria-label="Opciones del plano">
            <div className="table-add-anchor">
              <button className="button" aria-expanded={addingTables} onClick={() => { setAddingSector(false); addingTables ? setAddingTables(false) : openAddTables(); }}>
                <Plus size={16} /> Agregar mesa
              </button>
              {addingTables && <div className="panel table-add-panel" role="region" aria-label="Agregar mesas" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setAddingTables(false); } }}>
                <div className="table-add-heading">
                  <span><strong>Agregar mesas</strong><small>Elegí dónde y cuántas agregar.</small></span>
                  <button type="button" className="table-add-close" aria-label="Cerrar" onClick={() => setAddingTables(false)}><X size={16} /></button>
                </div>
                <label>Sector<select value={addArea} onChange={(event) => { setAddArea(event.target.value); setAddCount(1); }}>{sectors.filter((area) => area.id !== "counter").map((area) => <option key={area.id} value={area.id}>{area.label} · {area.limit - areaCounts[area.id]} libres</option>)}</select></label>
                <div className="table-add-quantity">
                  <span>Cantidad de mesas</span>
                  <div className="table-add-stepper">
                    <button type="button" aria-label="Restar una mesa" disabled={addCount <= 1} onClick={() => setAddCount(Math.max(1, addCount - 1))}><Minus size={15} /></button>
                    <input aria-label="Cantidad de mesas" type="number" min={1} max={Math.max(1, (sectors.find((area) => area.id === addArea)?.limit || 0) - (areaCounts[addArea] || 0))} value={addCount} onChange={(event) => setAddCount(Math.min(Math.max(1, (sectors.find((area) => area.id === addArea)?.limit || 0) - (areaCounts[addArea] || 0)), Math.max(1, Math.floor(Number(event.target.value) || 1))))} onKeyDown={(event) => { if (event.key === "Enter") createTables(); }} />
                    <button type="button" aria-label="Sumar una mesa" disabled={addCount >= Math.max(1, (sectors.find((area) => area.id === addArea)?.limit || 0) - (areaCounts[addArea] || 0))} onClick={() => setAddCount(addCount + 1)}><Plus size={15} /></button>
                  </div>
                </div>
                {(areaCounts[addArea] || 0) >= (sectors.find((area) => area.id === addArea)?.limit || 0) && <p>Este sector está completo. Eliminá mesas libres o creá otro sector.</p>}
                <button className="button primary table-add-submit" onClick={createTables} disabled={(areaCounts[addArea] || 0) >= (sectors.find((area) => area.id === addArea)?.limit || 0)}><Plus size={15} /> Agregar {addCount === 1 ? "mesa" : "mesas"}</button>
              </div>}
            </div>
          {layoutMode && <>
            <button className={selectingTables ? "button !border-[var(--brand)] !bg-[var(--brand-soft)] !text-[var(--brand-deep)]" : "button"} aria-pressed={selectingTables} onClick={() => {
              setSelectingTables((value) => !value);
              setSelectedTableIds([]);
              setConfirmDeleteTables(false);
            }}><Check size={16} /> {selectingTables ? "Cancelar selección" : "Seleccionar mesas"}</button>
            {selectingTables && <span className="whitespace-nowrap px-[3px] text-[10px] text-[var(--muted)]" aria-live="polite">{selectedTableIds.length} {selectedTableIds.length === 1 ? "seleccionada" : "seleccionadas"}</span>}
            {selectedTableIds.length > 0 && <button className="button danger-button" onClick={() => setConfirmDeleteTables(true)}>
              <Trash2 size={15} /> Eliminar ({selectedTableIds.length})
            </button>}
            <button className="button" aria-expanded={addingSector} onClick={() => { setAddingTables(false); setAddingSector((value) => !value); }}><Plus size={16} /> Agregar sector</button>
            {addingSector && <div className="panel sector-create" role="region" aria-label="Agregar sector"><label htmlFor="new-sector-name">Nombre del sector</label><input id="new-sector-name" autoFocus maxLength={32} value={sectorName} onChange={(event) => setSectorName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createSector(); if (event.key === "Escape") { event.stopPropagation(); setAddingSector(false); } }} placeholder="Ej. Terraza" /><button className="button primary" onClick={createSector} disabled={!sectorName.trim()}>Crear sector</button><button className="button" onClick={() => setAddingSector(false)}>Cancelar</button></div>}
            <button className="button" onClick={() => arrangeTables()} title="Alinear todas las mesas"><LayoutGrid size={16} /> Alinear</button>
            {sectors.length === 3 && ["salon", "patio", "counter"].every((id) => sectors.some((sector) => sector.id === id)) && (
            <button className="button" onClick={() => {
              const width = boardRef.current?.clientWidth;
              if (!width) return;
              const board = boardRef.current!;
              const minimumHeight = Math.max(0, window.innerHeight - board.getBoundingClientRect().top - window.scrollY - 18);
              const mosaic = makeDefaultMosaic(width, tables, minimumHeight);
              autoFitWidthRef.current = width;
              setSectors((current) => current.map((sector) => ({ ...sector, layout: mosaic[sector.id], autoFit: true })));
              normalizedLayoutRef.current = true;
              onToast("Distribución inicial aplicada.");
            }} title="Restablecer distribución"><RotateCcw size={16} /> Restablecer</button>
            )}
          </>}
            <button
              className={layoutMode ? "button primary floor-plan-edit-toggle" : "button floor-plan-edit-toggle"}
              aria-pressed={layoutMode}
              onClick={() => {
                setLayoutMode((value) => !value);
                setSelectedId(null);
                setSelectingTables(false);
                setSelectedTableIds([]);
                setConfirmDeleteTables(false);
                setAddingTables(false);
                setAddingSector(false);
                setPlanMenuOpen(false);
              }}
            >
              <Grid2X2 size={16} />
              {layoutMode ? "Terminar edición" : "Editar plano"}
            </button>
          </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>, utilityRail)}
      {confirmDeleteTables && <div className="panel table-delete-panel" role="region" aria-labelledby="table-delete-title" aria-describedby="table-delete-description">
        <div><strong id="table-delete-title">Eliminar {selectedTableIds.length} {selectedTableIds.length === 1 ? "mesa" : "mesas"}</strong><p id="table-delete-description">{occupiedSelection.length ? `${occupiedSelection.length} ${occupiedSelection.length === 1 ? "tiene consumos o una cuenta solicitada. Cerrá esa mesa o sacala" : "tienen consumos o una cuenta solicitada. Cerrá esas mesas o sacalas"} de la selección para continuar.` : "Se quitarán del plano las mesas seleccionadas. Esta acción no se puede deshacer."}</p></div>
        <button className="button danger-button" disabled={Boolean(occupiedSelection.length)} onClick={deleteSelectedTables}>Confirmar eliminación</button>
        <button className="button" onClick={() => setConfirmDeleteTables(false)}>Cancelar</button>
      </div>}
      <section className="panel floor-stage">
        <div ref={boardRef} className={`floor-board ${isFreeform ? "freeform" : "legacy-layout"}${layoutMode ? " editing" : ""}${selectingTables ? " selecting" : ""}`} style={{ "--floor-board-height": `${boardHeight + (draggingSectorId || resizingSectorId ? window.innerHeight : 0)}px` } as CSSProperties}>
          <AnimatePresence initial={false}>
          {sectors.map((area) => {
            const occupied = tables.filter((table) => table.area === area.id && table.items.length).length;
            const areaTables = tables.filter((table) => table.area === area.id && (area.id !== "counter" || table.items.length || table.billRequested));
            const sectorStyle = isFreeform && area.layout
              ? { "--free-x": `${area.layout.x * 100}%`, "--free-y": `${area.layout.y}px`, "--free-width": `${area.layout.width * 100}%`, "--free-height": `${area.layout.height}px` }
              : { "--sector-columns": area.columns, "--sector-start": area.start, "--sector-min-height": `${area.minHeight}px` };
            return <motion.section key={area.id} layout={layoutMode && !draggingSectorId && !resizingSectorId && !sectorGestureSettling && !reducedMotion} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ ...transitions.fast, layout: transitions.base }} data-sector-id={area.id} className={`floor-sector${area.autoFit ? " auto-fit" : ""}${activeArea === area.id && layoutMode ? " current" : ""}${area.id === "counter" && counterHovered ? " hovered" : ""}${layoutMode ? " editing" : ""}${draggingSectorId === area.id ? " dragging" : ""}${resizingSectorId === area.id ? " resizing" : ""}`}
              style={sectorStyle as CSSProperties}
              onMouseEnter={(event) => { if (area.id === "counter") { pointerPositionRef.current = { x: event.clientX, y: event.clientY }; setCounterHovered(true); } }}
              onMouseLeave={() => { if (area.id === "counter") setCounterHovered(false); }}
              onDragOver={(event) => { if (layoutMode && draggedTableId) {
                event.preventDefault();
                const slot = slotAtPointer(area.id, event.clientX, event.clientY);
                setDropTarget((current) => current?.area === area.id && current.slot === slot ? current : { area: area.id, slot });
              } }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget((current) => current?.area === area.id ? null : current); }}
              onDrop={(event) => { if (draggedTableId) { event.preventDefault(); event.stopPropagation(); moveTableTo(draggedTableId, area.id, slotAtPointer(area.id, event.clientX, event.clientY)); } }}>
              <div className="floor-sector-head">
                <button className="floor-sector-title" title={layoutMode ? `Arrastrar ${area.label} libremente` : undefined} onPointerDown={(event) => startSectorDrag(event, area)} onPointerMove={moveSectorDrag} onPointerUp={finishSectorDrag} onPointerCancel={finishSectorDrag} onKeyDown={(event) => moveSectorWithKeyboard(event, area)} onClick={() => { if (suppressSectorClick.current) { suppressSectorClick.current = false; return; } setActiveArea(area.id); setSelectedId(null); }} aria-pressed={activeArea === area.id}>
                  {layoutMode && <GripVertical size={16} className="sector-grip" aria-hidden="true" />}
                  <span><strong>{area.label}</strong><small>{area.description}</small></span>
                  <b>{area.id === "counter" ? `${occupied}/${area.limit} abiertas` : `${occupied ? `${occupied} abiertas · ` : ""}${areaCounts[area.id]}/${area.limit}`}</b>
                </button>
                {layoutMode && <div className="sector-controls">
                  <button title={`Alinear mesas de ${area.label}`} aria-label={`Alinear mesas de ${area.label}`} onClick={() => arrangeTables(area.id)}><LayoutGrid size={14}/></button>
                  <button title={`Eliminar ${area.label}`} aria-label={`Eliminar ${area.label}`} onClick={() => deleteSector(area)}><Trash2 size={14}/></button>
                </div>}
              </div>
              {area.id === "counter" && counterHovered && !layoutMode && canOpenCounter && <kbd className="floor-enter-hint">↵ Enter para abrir</kbd>}
              <div className="floor-sector-tables" style={{ "--table-columns": tableColumns[area.id] || 1 } as CSSProperties}>
                <AnimatePresence initial={false}>
                {areaTables.map((table, index) => {
                  const amount = tableTotal(table);
                  const status = table.billRequested && amount ? "billing" : amount ? "occupied" : "free";
                  const slot = table.slot ?? index;
                  const columns = tableColumns[area.id] || 1;
                  return <motion.button key={table.id} layout={layoutMode && !draggingSectorId && !resizingSectorId && !sectorGestureSettling && !reducedMotion ? "position" : false} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ ...transitions.fast, layout: transitions.fast }} className={`floor-table ${status}${layoutMode && selectedId === table.id && !selectingTables ? " selected" : ""}${selectedTableIds.includes(table.id) ? " bulk-selected" : ""}${dropTarget?.area === area.id && dropTarget.slot === slot ? " drop-target" : ""}`} whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={layoutMode ? undefined : press}
                    style={{ gridColumn: slot % columns + 1, gridRow: Math.floor(slot / columns) + 1 }}
                    draggable={layoutMode && !selectingTables} onDragStart={(event) => { event.stopPropagation(); setDraggedTableId(table.id); setSelectedId(table.id); }} onDragEnd={() => { setDraggedTableId(null); setDropTarget(null); }}
                    onPointerDown={(event) => startTableTouch(event, table)} onPointerMove={moveTableTouch} onPointerUp={(event) => finishTableTouch(event)} onPointerCancel={(event) => finishTableTouch(event, true)}
                    aria-pressed={layoutMode && selectingTables ? selectedTableIds.includes(table.id) : undefined}
                    title={layoutMode && !selectingTables ? "Arrastrá o usá las flechas para mover la mesa" : undefined}
                    onKeyDown={(event) => {
                      if (!layoutMode || selectingTables) return;
                      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : 0;
                      if (!delta) return;
                      event.preventDefault();
                      const target = slot + delta;
                      if (target >= 0 && target < TABLE_SLOT_LIMIT) moveTableTo(table.id, area.id, target);
                    }}
                    aria-label={`${layoutMode ? selectingTables ? "Seleccionar" : "Mover" : "Abrir"} ${displayTableName(table)}, ${status === "free" ? "libre" : status === "billing" ? "cuenta solicitada" : "ocupada"}`}
                    onClick={() => {
                      if (suppressTableClickRef.current) return;
                      if (layoutMode && selectingTables) setSelectedTableIds((current) => current.includes(table.id) ? current.filter((id) => id !== table.id) : [...current, table.id]);
                      else openTable(table.id);
                    }}><strong>{displayTableNumber(table)}</strong><i/>{layoutMode && selectingTables && <span className="floor-table-check"><Check size={11}/></span>}</motion.button>;
                })}
                </AnimatePresence>
                {layoutMode && draggedTableId && dropTarget?.area === area.id && !areaTables.some((table, index) => (table.slot ?? index) === dropTarget.slot) && <div className="floor-drop-slot" style={{ gridColumn: dropTarget.slot % (tableColumns[area.id] || 1) + 1, gridRow: Math.floor(dropTarget.slot / (tableColumns[area.id] || 1)) + 1 }} />}
                {!areaTables.length && area.id !== "counter" && <div className="floor-sector-empty">Sin mesas en este sector</div>}
                {area.id === "counter" && !layoutMode && canOpenCounter && <button className="floor-counter-open" onClick={openNextCounter}>Abrir mesa</button>}
              </div>
              {layoutMode && <>
                <button className="sector-resize-handle left" aria-label={`Cambiar tamaño de ${area.label} desde la izquierda`} title="Arrastrar para cambiar el ancho y alto" onPointerDown={(event) => startSectorResize(event, area, -1)} onPointerMove={moveSectorResize} onPointerUp={finishSectorResize} onPointerCancel={finishSectorResize} onKeyDown={(event) => resizeSectorWithKeyboard(event, area)}><span aria-hidden="true" /></button>
                <button className="sector-resize-handle" aria-label={`Cambiar tamaño de ${area.label}`} title="Arrastrar para cambiar el ancho y alto" onPointerDown={(event) => startSectorResize(event, area, 1)} onPointerMove={moveSectorResize} onPointerUp={finishSectorResize} onPointerCancel={finishSectorResize} onKeyDown={(event) => resizeSectorWithKeyboard(event, area)}><span aria-hidden="true" /></button>
              </>}
            </motion.section>;
          })}
          </AnimatePresence>
        </div>
      </section>
      <AnimatePresence>
        {employeePickerOpen && selected && (
          <EmployeePickerDialog
            tableName={displayTableName(selected)}
            members={teamOptions}
            onChoose={chooseOperator}
            onClose={cancelEmployeeSelection}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {coversOpen && selected && operator && (
          <CoversDialog
            tableName={displayTableName(selected)}
            operator={operator}
            covers={coversDraft}
            onCoversChange={setCoversDraft}
            onBack={returnToEmployeePicker}
            onConfirm={confirmCovers}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && selected && (
          <AccountDialog
            table={selected} tableName={displayTableName(selected)} operator={operator} teamOptions={teamOptions}
            operatorMenuOpen={operatorMenuOpen} onOperatorMenuOpenChange={setOperatorMenuOpen}
            onOperatorChange={changeOperator} onClose={requestAccountClose} onEditTable={() => setEditing(true)}
            onGuestsChange={(change) => update((table) => ({ ...table, guests: Math.max(1, Math.min(20, table.guests + change)) }))}
            dialogRef={accountDialogRef} operatorMenuRef={operatorMenuRef} operatorTriggerRef={operatorTriggerRef}
            onCategoryContainerChange={setCategoryContainer}
          >
                <PosCatalog products={products} categories={categories} onAddProduct={addProduct} categoryContainer={categoryContainer} />
                <PosAccountTicket
                  table={selected}
                  lines={lines}
                  selectedLineId={selectedLineId}
                  onSelectLine={setSelectedLineId}
                  onEditLine={openLineEditor}
                  onChangeQuantity={changeQuantity}
                  onMoveTable={openTableMove}
                  onToggleBill={toggleBillRequest}
                  onClearTable={() => {
                    if (selected.area === "counter") {
                      setTables((current) => compactCounterSlots(current.filter((table) => table.id !== selected.id)));
                      setAccountOpen(false);
                      setOperator(null);
                    } else update((table) => ({ ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined }));
                    setSelectedLineId(null);
                    setConfirmClearTable(false);
                  }}
                  discountOpen={discountOpen}
                  onDiscountOpenChange={setDiscountOpen}
                  confirmClear={confirmClearTable}
                  onConfirmClearChange={setConfirmClearTable}
                  onDiscountChange={(value) => update((table) => ({ ...table, billRequested: false, discount: Math.max(0, Math.min(subtotal, value)) }))}
                  subtotal={subtotal}
                  discount={discount}
                  total={total}
                  onOpenPayment={() => { setPayment(""); setPaymentOpen(true); }}
                />

          </AccountDialog>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && selected && paymentOpen && (
          <PosPaymentDialog
            dialogRef={paymentDialogRef}
            tableName={displayTableName(selected)}
            total={total}
            payment={payment}
            onPaymentChange={setPayment}
            onClose={() => setPaymentOpen(false)}
            onConfirm={confirmPayment}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && selected && (moveWholeTable || (editorLine && editorProduct)) && (
          <LineEditorDialog
            lineDialogRef={lineDialogRef}
            lineOpenedAtRef={lineOpenedAtRef}
            displayTableName={displayTableName}
            state={{
              selected, selectedId, editorLine, editorProduct: editorProduct || undefined,
              moveWholeTable, lineEditorMode, total, linePriceDraft, lineDiscountDraft,
              lineNoteDraft, lineQuantityDraft, moveTargetId, moveTarget, moveCovers,
              moveTargetOperatorId, sourceMovePin, targetMovePin, moveError, sectors,
              tables, canOpenCounter, operator, teamOptions, destinationOwner,
              sourceNeedsMovePin, destinationNeedsMovePin,
            }}
            actions={{
              setLineEditorId, setLineEditorMode, setLinePriceDraft, setLineDiscountDraft,
              setLineNoteDraft, setLineQuantityDraft, saveLineNote, setMoveTargetId,
              setMoveCovers, setMoveTargetOperatorId, setSourceMovePin, setTargetMovePin,
              setMoveError, moveLineToTable,
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {exitPinOpen && operator && (
          <EmployeePinDialog
            operator={operator}
            tableName={selected ? displayTableName(selected) : "la mesa"}
            purpose={pinPurpose}
            pin={exitPin}
            error={exitPinError}
            onPinChange={(value) => { setExitPinError(""); setExitPin(value); }}
            onClose={cancelOperatorPin}
            onConfirm={verifyOperatorPin}
          />
        )}
      </AnimatePresence>      <AnimatePresence>
        {editing && selected && (
          <TableEditDialog
            table={selected}
            tableName={displayTableName(selected)}
            sectors={sectors}
            tables={tables}
            onNameChange={(name) => update((table) => ({ ...table, name }))}
            onAreaChange={moveSelectedArea}
            onClose={() => setEditing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
