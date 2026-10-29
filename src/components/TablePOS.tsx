import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRightLeft,
  BadgePercent,
  Check,
  ChevronDown,
  Eraser,
  GripVertical,
  Grid2X2,
  LayoutGrid,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { Product } from "../data";
import { money } from "../data";
import { fadeUp, modalVariants, overlayVariants, press, transitions } from "../motion";
import {
  loadTeamMembers,
  type TeamMember,
} from "../stores/team";
import { saveSale } from "../stores/sales";
import PosCatalog from "./PosCatalog";
import PosAccountTicket from "./PosAccountTicket";
import PosPaymentDialog, { type PaymentMethod } from "./PosPaymentDialog";
import EmployeePickerDialog from "./pos-dialogs/EmployeePickerDialog";
import CoversDialog from "./pos-dialogs/CoversDialog";
import EmployeePinDialog from "./pos-dialogs/EmployeePinDialog";
import TableEditDialog from "./pos-dialogs/TableEditDialog";
import {
  KEY, newLineId, SECTORS_KEY, FREEFORM_MIN_HEIGHT, SECTOR_GAP, COUNTER_LIMIT,
  MAX_SECTOR_HEIGHT, TABLE_SLOT_LIMIT, tableGridMetrics,
  materializeTableSlots, loadSectors, makeDefaultMosaic, sectorRect,
  sectorsTouch, sectorObstacles, moveSectorRect, resizeSectorRect,
  tablePosition, loadInitialFloor,
  type Line, type Area, type SectorLayout, type Sector, type Table,
  type PinPurpose, type SectorRect,
} from "../pos/floorModel";
import {
  allocateCounterTableNumber,
} from "../stores/counterSequence";

const lineUnitPrice = (line: Line, productPrice: number) => Math.max(0, (line.unitPrice ?? productPrice) - (line.unitDiscount ?? 0));
const sameLinePrice = (a: Line, b: Line) => a.unitPrice === b.unitPrice && (a.unitDiscount || 0) === (b.unitDiscount || 0);
const NEW_COUNTER_TARGET = "__new_counter__";
const makeCounterTable = (tables: Table[], id = `counter-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`): Table => {
  const occupied = new Set(materializeTableSlots(tables).filter((table) => table.area === "counter").map((table) => table.slot));
  let slot = 0;
  while (occupied.has(slot)) slot++;
  return { id, name: "Mostrador", area: "counter", guests: 2, items: [], discount: 0, billRequested: false, slot, ...tablePosition(slot, "counter") };
};
export default function TablePOS({
  products,
  categories,
  onToast,
}: {
  products: Product[];
  categories: string[];
  onToast: (message: string) => void;
}) {
  const [tables, setTables] = useState<Table[]>(loadInitialFloor);
  const [sectors, setSectors] = useState<Sector[]>(loadSectors);
  const [sectorName, setSectorName] = useState("");
  const [addingSector, setAddingSector] = useState(false);
  const [addingTables, setAddingTables] = useState(false);
  const [addArea, setAddArea] = useState<Area>("salon");
  const [addCount, setAddCount] = useState(1);
  const [selectingTables, setSelectingTables] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [confirmDeleteTables, setConfirmDeleteTables] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ area: Area; slot: number } | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<Area, number>>({});
  const tableTouchDragRef = useRef<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressTableClickRef = useRef(false);
  const [draggingSectorId, setDraggingSectorId] = useState<string | null>(null);
  const [resizingSectorId, setResizingSectorId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const accountDialogRef = useRef<HTMLElement>(null);
  const [categoryContainer, setCategoryContainer] = useState<HTMLDivElement | null>(null);
  const [boardHeight, setBoardHeight] = useState(400);
  const sectorDragRef = useRef<{ id: string; pointerId: number; x: number; pageY: number; layout: SectorLayout; lastLayout: SectorLayout; boardWidth: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ id: string; pointerId: number; x: number; pageY: number; layout: SectorLayout; boardWidth: number; edge: -1 | 1; moved: boolean } | null>(null);
  const scrollGestureRef = useRef<{ pointerId: number; mode: "drag" | "resize"; clientX: number; clientY: number; frame: number } | null>(null);
  const suppressSectorClick = useRef(false);
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
  const [counterHovered, setCounterHovered] = useState(false);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [activeArea, setActiveArea] = useState<Area>("salon");
  const [payment, setPayment] = useState<PaymentMethod>("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentDialogRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [lineEditorId, setLineEditorId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [confirmClearTable, setConfirmClearTable] = useState(false);
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
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;
  const normalizedLayoutRef = useRef(false);
  const autoFitWidthRef = useRef<number | null>(null);
  const reconcileBoard = () => {
    const board = boardRef.current;
    if (!board) return;
    const compact = window.innerWidth <= 1100 || board.clientWidth < 760;
    const minimumBoardHeight = Math.max(0, window.innerHeight - board.getBoundingClientRect().top - window.scrollY - 18);
    const current = sectorsRef.current;
    const elements = Array.from(board.querySelectorAll<HTMLElement>(".floor-sector"));
    const measuredColumns: Record<Area, number> = {};
    for (const element of elements) {
      const list = element.querySelector<HTMLElement>(".floor-sector-tables");
      const area = element.dataset.sectorId;
      if (list && area && list.clientWidth) measuredColumns[area] = tableGridMetrics(list.clientWidth).columns;
    }
    setTableColumns((previous) => Object.entries(measuredColumns).every(([area, count]) => previous[area] === count)
      ? previous : { ...previous, ...measuredColumns });
    if (current.some((sector) => !sector.layout)) {
      if (current.length === 3 && ["salon", "patio", "counter"].every((id) => current.some((sector) => sector.id === id)) && current.every((sector) => !sector.layout)) {
        const mosaic = makeDefaultMosaic(Math.max(board.clientWidth, 1000), tables, minimumBoardHeight);
        normalizedLayoutRef.current = true;
        autoFitWidthRef.current = compact ? null : board.clientWidth;
        setSectors((items) => items.map((sector) => ({ ...sector, layout: mosaic[sector.id], autoFit: true })));
        return;
      }
      if (compact) return;
      const bounds = board.getBoundingClientRect();
      if (!bounds.width || elements.length !== current.length) return;
      setSectors((items) => items.map((sector) => {
        if (sector.layout) return sector;
        const element = elements.find((item) => item.dataset.sectorId === sector.id);
        if (!element) return sector;
        const rect = element.getBoundingClientRect();
        return { ...sector, layout: {
          x: Math.max(0, (rect.left - bounds.left) / bounds.width),
          y: Math.max(0, rect.top - bounds.top),
          width: Math.min(1, rect.width / bounds.width),
          height: Math.max(FREEFORM_MIN_HEIGHT, rect.height),
        } };
      }));
      return;
    }
    if (compact) return;
    if (current.length === 3 && current.every((sector) => sector.autoFit === true) &&
      ["salon", "patio", "counter"].every((id) => current.some((sector) => sector.id === id)) &&
      autoFitWidthRef.current !== board.clientWidth) {
      autoFitWidthRef.current = board.clientWidth;
      const mosaic = makeDefaultMosaic(board.clientWidth, tables, minimumBoardHeight);
      setSectors((items) => items.map((sector) => ({ ...sector, layout: mosaic[sector.id] })));
      return;
    }
    if (!normalizedLayoutRef.current && !draggingSectorId && !resizingSectorId) {
      normalizedLayoutRef.current = true;
      const salon = current.find((sector) => sector.id === "salon")?.layout;
      const patio = current.find((sector) => sector.id === "patio")?.layout;
      const counter = current.find((sector) => sector.id === "counter")?.layout;
      if (current.length === 3 && salon && patio && counter && current.every((sector) => sector.autoFit !== false)) {
        const width = board.clientWidth;
        const horizontalGap = (counter.x - salon.x - salon.width) * width;
        const verticalGap = patio.y - salon.y - salon.height;
        if (Math.abs(salon.x - patio.x) < .001 && Math.abs(salon.width - patio.width) < .001 &&
          Math.abs(counter.y - salon.y) < 1 && horizontalGap >= 0 && horizontalGap < 32 &&
          verticalGap >= 0 && verticalGap < 32 &&
          Math.abs(counter.height - (patio.y + patio.height - salon.y)) < 32) {
          const mosaic = makeDefaultMosaic(width, tables, minimumBoardHeight);
          autoFitWidthRef.current = width;
          setSectors((items) => items.map((sector) => ({ ...sector, layout: mosaic[sector.id], autoFit: true })));
          return;
        }
      }
      const placed: SectorRect[] = [];
      const normalized = current.map((sector) => {
        const layout = sector.layout!;
        const rect = sectorRect(layout, board.clientWidth);
        while (placed.some((other) => sectorsTouch(rect, other))) {
          rect.y = Math.max(...placed.filter((other) => sectorsTouch(rect, other)).map((other) => other.y + other.height + SECTOR_GAP));
        }
        placed.push(rect);
        return { ...sector, layout: { ...layout, y: rect.y } };
      });
      if (normalized.some((sector, index) => sector.layout.y !== current[index].layout!.y)) {
        setSectors(normalized);
        return;
      }
    }
    const salon = current.find((sector) => sector.id === "salon");
    const patio = current.find((sector) => sector.id === "patio");
    const counter = current.find((sector) => sector.id === "counter");
    if (current.length === 3 && salon?.layout && patio?.layout && counter?.layout && current.every((sector) => sector.autoFit !== false)) {
      const width = board.clientWidth;
      const horizontalGap = (counter.layout.x - salon.layout.x - salon.layout.width) * width;
      const verticalGap = patio.layout.y - salon.layout.y - salon.layout.height;
      const isMosaic = Math.abs(salon.layout.x - patio.layout.x) < .001 && Math.abs(salon.layout.width - patio.layout.width) < .001 &&
        Math.abs(counter.layout.y - salon.layout.y) < 1 && Math.abs(horizontalGap - SECTOR_GAP) < 1 &&
        Math.abs(verticalGap - SECTOR_GAP) < 1 && Math.abs(counter.layout.height - (patio.layout.y + patio.layout.height - salon.layout.y)) < 1;
      if (isMosaic) {
        const requiredHeight = (id: string) => {
          const element = elements.find((item) => item.dataset.sectorId === id);
          if (!element) return FREEFORM_MIN_HEIGHT;
          const cards = Array.from(element.querySelectorAll<HTMLElement>(".floor-table"));
          const elementBounds = element.getBoundingClientRect();
          const lastCardBottom = Math.max(elementBounds.top, ...cards.map((card) => card.getBoundingClientRect().bottom));
          const bottomPadding = parseFloat(getComputedStyle(element).paddingBottom) || 20;
          return Math.max(300, Math.ceil(lastCardBottom - elementBounds.top + bottomPadding + 8));
        };
        let salonHeight = requiredHeight("salon");
        let patioHeight = requiredHeight("patio");
        const extraHeight = Math.max(0, Math.max(minimumBoardHeight, requiredHeight("counter")) - salonHeight - patioHeight - SECTOR_GAP);
        salonHeight += Math.floor(extraHeight / 2);
        patioHeight += Math.ceil(extraHeight / 2);
        const patioY = salon.layout.y + salonHeight + SECTOR_GAP;
        const counterHeight = salonHeight + SECTOR_GAP + patioHeight;
        if (Math.abs(salon.layout.height - salonHeight) > 1 || Math.abs(patio.layout.height - patioHeight) > 1 ||
          Math.abs(patio.layout.y - patioY) > 1 || Math.abs(counter.layout.height - counterHeight) > 1 || current.some((sector) => sector.autoFit !== true)) {
          setSectors((items) => items.map((sector) => {
            if (!sector.layout) return sector;
            if (sector.id === "salon") return { ...sector, autoFit: true, layout: { ...sector.layout, height: salonHeight } };
            if (sector.id === "patio") return { ...sector, autoFit: true, layout: { ...sector.layout, y: patioY, height: patioHeight } };
            return { ...sector, autoFit: true, layout: { ...sector.layout, height: counterHeight } };
          }));
          return;
        }
      }
    }
    const nextHeight = Math.max(300, ...current.map((sector) => {
      const element = elements.find((item) => item.dataset.sectorId === sector.id);
      return (sector.layout?.y || 0) + (element?.offsetHeight || sector.layout?.height || 0) + 16;
    }));
    setBoardHeight((height) => Math.abs(height - nextHeight) < 1 ? height : nextHeight);
  };
  useLayoutEffect(() => { reconcileBoard(); }, [sectors, layoutMode, tables, tableColumns]);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(reconcileBoard);
    observer.observe(board);
    board.querySelectorAll<HTMLElement>(".floor-sector").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectors.length, isFreeform]);
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
  const itemCount = lines.reduce((sum, item) => sum + item.line.quantity, 0);
  const editorLine = selected?.items.find((line) => line.id === lineEditorId);
  const editorProduct = editorLine && products.find((product) => product.id === editorLine.productId);
  const selectedLine = selected?.items.find((line) => line.id === selectedLineId);
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
    if (selected?.area === "counter" && !selected.items.length) setTables((current) => current.filter((table) => table.id !== selected.id));
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
        ? allocateCounterTableNumber(
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
      setTables((current) => current.filter((table) => table.id !== selected.id));
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
  const addProduct = (productId: number) => {
    const lineId = newLineId();
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
  const openAddTables = (area = activeArea) => {
    const target = area === "counter" ? sectors.find((sector) => sector.id !== "counter")?.id : area;
    if (!target) { onToast("Agregá un sector para crear mesas."); return; }
    setAddArea(target);
    setAddCount(1);
    setAddingTables(true);
    setLayoutMode(true);
    setSelectingTables(false);
    setSelectedTableIds([]);
  };
  const createTables = () => {
    const sector = sectors.find((item) => item.id === addArea);
    if (!sector) return;
    const remaining = sector.limit - tables.filter((table) => table.area === addArea).length;
    const quantity = Math.min(remaining, Math.max(1, Math.floor(addCount)));
    if (quantity < 1) return;
    setTables((current) => {
      const normalized = materializeTableSlots(current);
      const usedNames = new Set(normalized.map((table) => Number(table.name.match(/\d+/)?.[0])).filter(Boolean));
      const usedSlots = new Set(normalized.filter((table) => table.area === addArea).map((table) => table.slot!));
      const additions: Table[] = [];
      let number = 1;
      let slot = 0;
      for (let index = 0; index < quantity; index++) {
        while (usedNames.has(number)) number++;
        while (usedSlots.has(slot)) slot++;
        usedNames.add(number);
        usedSlots.add(slot);
        additions.push({
          id: `table-${Date.now()}-${index}`, name: `Mesa ${number}`, guests: 2,
          items: [], discount: 0, billRequested: false, area: addArea,
          slot, ...tablePosition(slot, addArea),
        });
      }
      return [...normalized, ...additions];
    });
    setActiveArea(addArea);
    setAddingTables(false);
    onToast(`${quantity} ${quantity === 1 ? "mesa agregada" : "mesas agregadas"} en ${sector.label}.`);
  };
  const selectedTables = tables.filter((table) => selectedTableIds.includes(table.id));
  const occupiedSelection = selectedTables.filter((table) => table.items.length || table.billRequested);
  const deleteSelectedTables = () => {
    if (!selectedTables.length || occupiedSelection.length) return;
    const ids = new Set(selectedTableIds);
    setTables((current) => materializeTableSlots(current).filter((table) => !ids.has(table.id)));
    setSelectedId(null);
    setSelectedTableIds([]);
    setSelectingTables(false);
    setConfirmDeleteTables(false);
    onToast(`${ids.size} ${ids.size === 1 ? "mesa eliminada" : "mesas eliminadas"} del plano.`);
  };
  const arrangeTables = (area?: Area) => {
    setTables((current) => {
      const positions = new Map<string, number>();
      for (const sector of sectors) {
        if (area && sector.id !== area) continue;
        current.filter((table) => table.area === sector.id).sort((a, b) =>
          Number(a.name.match(/\d+/)?.[0] || 0) - Number(b.name.match(/\d+/)?.[0] || 0),
        ).forEach((table, index) => positions.set(table.id, index));
      }
      return current.map((table) => positions.has(table.id) ? { ...table, slot: positions.get(table.id) } : table);
    });
    setSelectedId(null);
    onToast(area ? `${sectors.find((sector) => sector.id === area)?.label} se alineó por número.` : "Todas las mesas se alinearon por número.");
  };
  const moveSelectedArea = (area: Area) => {
    if (!selected || selected.area === area) return;
    if (selected.area === "counter" || area === "counter") { onToast("Usá mover cuenta para trasladar consumos desde o hacia Mostrador."); return; }
    const target = sectors.find((item) => item.id === area)!;
    const targetCount = tables.filter((table) => table.area === area).length;
    if (targetCount >= target.limit) {
      onToast(`${target.label} admite hasta ${target.limit} mesas.`);
      return;
    }
    const occupiedSlots = new Set(materializeTableSlots(tables).filter((table) => table.area === area).map((table) => table.slot!));
    let slot = 0;
    while (occupiedSlots.has(slot)) slot++;
    setTables((current) => materializeTableSlots(current).map((table) => table.id === selected.id
      ? { ...table, area, slot, ...tablePosition(targetCount, area) } : table));
    setActiveArea(area);
    onToast(`${selected.name} se movió a ${target.label}.`);
  };
  const updateSectorDrag = (clientX: number, clientY: number) => {
    const drag = sectorDragRef.current;
    if (!drag) return;
    const dx = clientX - drag.x;
    const dy = clientY + window.scrollY - drag.pageY;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.moved) return;
    const firstMove = !drag.moved;
    drag.moved = true;
    setSectors((current) => {
      const previous = sectorRect(drag.lastLayout, drag.boardWidth);
      const next = moveSectorRect(previous, drag.layout.x * drag.boardWidth + dx, drag.layout.y + dy, sectorObstacles(current, drag.id, drag.boardWidth), drag.boardWidth);
      drag.lastLayout = { ...drag.lastLayout, x: next.x / drag.boardWidth, y: Math.round(next.y) };
      return current.map((sector) => sector.id === drag.id && sector.layout
        ? { ...sector, layout: drag.lastLayout, autoFit: false }
        : firstMove ? { ...sector, autoFit: false } : sector);
    });
  };
  const updateSectorResize = (clientX: number, clientY: number) => {
    const resize = resizeRef.current;
    if (!resize) return;
    if (Math.abs(clientX - resize.x) + Math.abs(clientY + window.scrollY - resize.pageY) < 3 && !resize.moved) return;
    const firstMove = !resize.moved;
    resize.moved = true;
    const deltaX = (clientX - resize.x) / resize.boardWidth;
    const minimumWidth = Math.min(1, Math.max(220 / resize.boardWidth, 0.16));
    let x = resize.layout.x;
    let width = resize.layout.width;
    if (resize.edge === 1) {
      width = Math.max(minimumWidth, Math.min(1, resize.layout.width + deltaX));
      x = Math.max(0, Math.min(x, 1 - width));
    } else {
      const right = resize.layout.x + resize.layout.width;
      x = Math.max(0, Math.min(right - minimumWidth, resize.layout.x + deltaX));
      width = right - x;
    }
    const height = Math.max(FREEFORM_MIN_HEIGHT, Math.min(MAX_SECTOR_HEIGHT, Math.round(resize.layout.height + clientY + window.scrollY - resize.pageY)));
    setSectors((current) => current.map((sector) => {
      if (sector.id !== resize.id || !sector.layout) return firstMove ? { ...sector, autoFit: false } : sector;
      const next = resizeSectorRect(sectorRect(resize.layout, resize.boardWidth), { x: x * resize.boardWidth, y: resize.layout.y, width: width * resize.boardWidth, height }, sectorObstacles(current, resize.id, resize.boardWidth), resize.boardWidth);
      return { ...sector, autoFit: false, layout: { ...sector.layout, x: next.x / resize.boardWidth, width: next.width / resize.boardWidth, height: next.height } };
    }));
  };
  const stopGestureScroll = () => {
    if (scrollGestureRef.current) cancelAnimationFrame(scrollGestureRef.current.frame);
    scrollGestureRef.current = null;
  };
  const tickGestureScroll = () => {
    const gesture = scrollGestureRef.current;
    if (!gesture) return;
    if (gesture.mode === "drag" ? !sectorDragRef.current?.moved : !resizeRef.current?.moved) {
      gesture.frame = requestAnimationFrame(tickGestureScroll);
      return;
    }
    const edge = 84;
    const bottom = window.innerHeight - gesture.clientY;
    const direction = gesture.clientY < edge ? -1 : bottom < edge ? 1 : 0;
    if (direction) {
      const distance = direction < 0 ? gesture.clientY : bottom;
      const speed = direction * Math.max(4, Math.min(22, (edge - distance) * .28));
      const previousY = window.scrollY;
      window.scrollBy(0, speed);
      if (window.scrollY !== previousY) {
        if (gesture.mode === "drag") updateSectorDrag(gesture.clientX, gesture.clientY);
        else updateSectorResize(gesture.clientX, gesture.clientY);
      }
    }
    gesture.frame = requestAnimationFrame(tickGestureScroll);
  };
  const startGestureScroll = (pointerId: number, mode: "drag" | "resize", clientX: number, clientY: number) => {
    stopGestureScroll();
    scrollGestureRef.current = { pointerId, mode, clientX, clientY, frame: requestAnimationFrame(tickGestureScroll) };
  };
  useEffect(() => () => stopGestureScroll(), []);
  const startSectorDrag = (event: ReactPointerEvent<HTMLButtonElement>, sector: Sector) => {
    const board = boardRef.current;
    if (!layoutMode || !board || board.clientWidth < 760 || !sector.layout) return;
    sectorDragRef.current = {
      id: sector.id,
      pointerId: event.pointerId,
      x: event.clientX,
      pageY: event.clientY + window.scrollY,
      layout: sector.layout,
      lastLayout: sector.layout,
      boardWidth: board.clientWidth,
      moved: false,
    };
    suppressSectorClick.current = false;
    setActiveArea(sector.id);
    setSelectedId(null);
    setDraggingSectorId(sector.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    startGestureScroll(event.pointerId, "drag", event.clientX, event.clientY);
  };
  const moveSectorDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sectorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (scrollGestureRef.current?.pointerId === event.pointerId) {
      scrollGestureRef.current.clientX = event.clientX;
      scrollGestureRef.current.clientY = event.clientY;
    }
    updateSectorDrag(event.clientX, event.clientY);
  };
  const finishSectorDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sectorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressSectorClick.current = drag.moved;
    sectorDragRef.current = null;
    stopGestureScroll();
    setDraggingSectorId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveSectorWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, sector: Sector) => {
    if (!layoutMode || !sector.layout || !boardRef.current) return;
    const step = event.shiftKey ? 40 : 10;
    const width = boardRef.current.clientWidth;
    const deltaX = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const deltaY = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if (!deltaX && !deltaY) return;
    event.preventDefault();
    setSectors((current) => current.map((item) => {
      if (item.id !== sector.id || !item.layout) return item;
      const rect = sectorRect(item.layout, width);
      const next = moveSectorRect(rect, rect.x + deltaX, rect.y + deltaY, sectorObstacles(current, sector.id, width), width);
      return { ...item, layout: { ...item.layout, x: next.x / width, y: next.y } };
    }).map((item) => ({ ...item, autoFit: false })));
  };
  const startSectorResize = (event: ReactPointerEvent<HTMLButtonElement>, sector: Sector, edge: -1 | 1) => {
    const board = boardRef.current;
    if (!sector.layout || !board || board.clientWidth < 760) return;
    resizeRef.current = {
      id: sector.id,
      x: event.clientX,
      pageY: event.clientY + window.scrollY,
      layout: sector.layout,
      boardWidth: board.clientWidth,
      pointerId: event.pointerId,
      edge,
      moved: false,
    };
    setActiveArea(sector.id);
    setSelectedId(null);
    setResizingSectorId(sector.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    startGestureScroll(event.pointerId, "resize", event.clientX, event.clientY);
    event.preventDefault();
    event.stopPropagation();
  };
  const moveSectorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (scrollGestureRef.current?.pointerId === event.pointerId) {
      scrollGestureRef.current.clientX = event.clientX;
      scrollGestureRef.current.clientY = event.clientY;
    }
    updateSectorResize(event.clientX, event.clientY);
  };
  const finishSectorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    stopGestureScroll();
    setResizingSectorId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const resizeSectorWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, sector: Sector) => {
    if (!sector.layout || !boardRef.current) return;
    const deltaWidth = event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0;
    const deltaHeight = event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0;
    if (!deltaWidth && !deltaHeight) return;
    event.preventDefault();
    const boardWidth = boardRef.current.clientWidth;
    setSectors((current) => current.map((item) => {
      if (item.id !== sector.id || !item.layout) return item;
      const width = Math.max(220 / boardWidth, Math.min(1, item.layout.width + deltaWidth / boardWidth));
      const next = resizeSectorRect(sectorRect(item.layout, boardWidth), {
        x: item.layout.x * boardWidth, y: item.layout.y, width: width * boardWidth,
        height: Math.max(FREEFORM_MIN_HEIGHT, Math.min(MAX_SECTOR_HEIGHT, item.layout.height + deltaHeight)),
      }, sectorObstacles(current, sector.id, boardWidth), boardWidth);
      return { ...item, layout: { ...item.layout, x: next.x / boardWidth, width: next.width / boardWidth, height: next.height } };
    }).map((item) => ({ ...item, autoFit: false })));
  };
  const slotAtPointer = (area: Area, clientX: number, clientY: number) => {
    const sector = Array.from(boardRef.current?.querySelectorAll<HTMLElement>(".floor-sector") || [])
      .find((element) => element.dataset.sectorId === area);
    const list = sector?.querySelector<HTMLElement>(".floor-sector-tables");
    if (!list) return 0;
    const rect = list.getBoundingClientRect();
    const { size, gap, columns } = tableGridMetrics(list.clientWidth);
    const rowHeight = window.innerWidth <= 760 ? 52 : 56;
    const column = Math.max(0, Math.min(columns - 1, Math.floor((clientX - rect.left + gap / 2) / (size + gap))));
    const row = Math.max(0, Math.floor((clientY - rect.top + gap / 2) / (rowHeight + gap)));
    return Math.min(TABLE_SLOT_LIMIT - 1, row * columns + column);
  };
  const moveTableTo = (id: string, area: Area, slot: number) => {
    const sector = sectors.find((item) => item.id === area);
    if (!sector) return;
    const original = tables.find((table) => table.id === id);
    if (!original) return;
    if (original.area !== area && (original.area === "counter" || area === "counter")) { onToast("Usá mover cuenta para trasladar consumos desde o hacia Mostrador."); setDraggedTableId(null); setDropTarget(null); return; }
    if (original.area !== area && areaCounts[area] >= sector.limit) {
      onToast(`${sector.label} ya tiene ${sector.limit} mesas.`);
      setDraggedTableId(null);
      setDropTarget(null);
      return;
    }
    setTables((current) => {
      const normalized = materializeTableSlots(current);
      const moving = normalized.find((table) => table.id === id);
      if (!moving) return current;
      const occupant = normalized.find((table) => table.area === area && table.slot === slot && table.id !== id);
      const sourceSlot = moving.slot!;
      let displacedSlot = sourceSlot;
      if (occupant && moving.area !== area) {
        const used = new Set(normalized.filter((table) => table.area === area).map((table) => table.slot!));
        displacedSlot = (slot + 1) % TABLE_SLOT_LIMIT;
        while (used.has(displacedSlot)) displacedSlot = (displacedSlot + 1) % TABLE_SLOT_LIMIT;
      }
      return normalized.map((table) => {
        if (table.id === id) return { ...table, area, slot };
        if (table.id === occupant?.id) return { ...table, slot: displacedSlot };
        return table;
      });
    });
    setDraggedTableId(null);
    setDropTarget(null);
    setActiveArea(area);
  };
  const tableAreaAtPoint = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>(".floor-sector")?.dataset.sectorId;
  const startTableTouch = (event: ReactPointerEvent<HTMLButtonElement>, table: Table) => {
    if (event.pointerType !== "touch" || !layoutMode || selectingTables) return;
    tableTouchDragRef.current = { id: table.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTableTouch = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = tableTouchDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.moved) { drag.moved = true; setDraggedTableId(drag.id); }
    event.preventDefault();
    const area = tableAreaAtPoint(event.clientX, event.clientY);
    if (!area) { setDropTarget(null); return; }
    const slot = slotAtPointer(area, event.clientX, event.clientY);
    setDropTarget((current) => current?.area === area && current.slot === slot ? current : { area, slot });
  };
  const finishTableTouch = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = tableTouchDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    tableTouchDragRef.current = null;
    if (drag.moved) {
      const area = cancelled ? undefined : tableAreaAtPoint(event.clientX, event.clientY);
      if (area) moveTableTo(drag.id, area, slotAtPointer(area, event.clientX, event.clientY));
      else { setDraggedTableId(null); setDropTarget(null); }
      suppressTableClickRef.current = true;
      window.setTimeout(() => { suppressTableClickRef.current = false; }, 0);
      event.preventDefault();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const createSector = () => {
    const label = sectorName.trim();
    if (!label) return;
    const id = `sector-${Date.now()}`;
    setSectors((current) => [...current, { id, label, description: "Sector personalizado", limit: 64, columns: 9, start: 1, minHeight: 186,
      layout: isFreeform ? { x: 0, y: boardHeight + 14, width: 0.72, height: FREEFORM_MIN_HEIGHT } : undefined,
    }]);
    setActiveArea(id);
    setSectorName("");
    setAddingSector(false);
    onToast(`${label} agregado al plano.`);
  };
  const deleteSector = (sector: Sector) => {
    if (sectors.length <= 1) return;
    if (areaCounts[sector.id]) {
      onToast(`Mové o eliminá las mesas de ${sector.label} antes de quitar el sector.`);
      return;
    }
    setSectors((current) => current.filter((item) => item.id !== sector.id));
    if (activeArea === sector.id) setActiveArea(sectors.find((item) => item.id !== sector.id)!.id);
    onToast(`${sector.label} eliminado del plano.`);
  };
  const closeSale = () => {
    if (!selected || !selected.items.length || !payment) return;
    const name = displayTableName(selected);
    const closedAt = new Date().toISOString();
    const subtotalAmount = lines.reduce(
      (sum, { line, product }) => sum + line.quantity * lineUnitPrice(line, product.price),
      0,
    );
    saveSale({
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
    });
    if (selected.area === "counter") setTables((current) => current.filter((table) => table.id !== selected.id));
    else update((table) => ({
      ...table,
      items: [],
      discount: 0,
      billRequested: false,
      operatorId: undefined,
      counterTurnNumber: undefined,
    }));
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
      <section className="panel floor-toolbar">
        <div className="floor-toolbar-main">
          <div className="floor-toolbar-heading">
            <span className="eyebrow">SECTORES</span>
            <h2>Plano de mesas</h2>
            <p>
              {tables.filter((table) => table.items.length).length} abiertas ·{" "}
              {tables.length} de {floorCapacity} lugares · {sectors.length} sectores
            </p>
          </div>
          <div className="floor-actions">
            <button className="button" onClick={() => openAddTables()}>
              <Plus size={16} /> Agregar mesa
            </button>
            <button
              className={layoutMode ? "button primary" : "button"}
              aria-pressed={layoutMode}
              onClick={() => {
                setLayoutMode((value) => !value);
                setSelectedId(null);
                setSelectingTables(false);
                setSelectedTableIds([]);
                setConfirmDeleteTables(false);
                setAddingTables(false);
                setAddingSector(false);
              }}
            >
              <Grid2X2 size={16} />
              {layoutMode ? "Terminar edición" : "Editar plano"}
            </button>
          </div>
        </div>
        {layoutMode && <div className="floor-edit-tools" role="group" aria-label="Herramientas de edición del plano">
          <div className="floor-edit-group">
            <span className="floor-edit-label">Mesas</span>
            <button className={selectingTables ? "button floor-selection-active" : "button"} aria-pressed={selectingTables} onClick={() => {
              setSelectingTables((value) => !value);
              setSelectedTableIds([]);
              setConfirmDeleteTables(false);
            }}><Check size={16} /> {selectingTables ? "Cancelar selección" : "Seleccionar mesas"}</button>
            {selectingTables && <span className="floor-selection-count" aria-live="polite">{selectedTableIds.length} {selectedTableIds.length === 1 ? "seleccionada" : "seleccionadas"}</span>}
            {selectedTableIds.length > 0 && <button className="button danger-button" onClick={() => setConfirmDeleteTables(true)}>
              <Trash2 size={15} /> Eliminar ({selectedTableIds.length})
            </button>}
          </div>
          <div className="floor-edit-group">
            <span className="floor-edit-label">Sectores</span>
            <button className="button" onClick={() => setAddingSector(true)}><Plus size={16} /> Agregar sector</button>
          </div>
          <div className="floor-edit-group">
            <span className="floor-edit-label">Distribución</span>
            <button className="button" onClick={() => arrangeTables()}><LayoutGrid size={16} /> Alinear todas</button>
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
            }}><RotateCcw size={16} /> Restablecer distribución</button>
            )}
          </div>
        </div>}
      </section>
      {layoutMode && (
        <motion.div
          className="floor-tip"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <span>
            {selectingTables ? "Seleccioná las mesas que querés eliminar." : "Arrastrá las mesas o los sectores para acomodarlos. Cambiá el tamaño de cada sector desde sus esquinas."}
          </span>
          <strong>Los cambios se guardan automáticamente.</strong>
        </motion.div>
      )}
      {addingSector && <div className="panel sector-create"><label htmlFor="new-sector-name">Nombre del sector</label><input id="new-sector-name" autoFocus maxLength={32} value={sectorName} onChange={(event) => setSectorName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createSector(); if (event.key === "Escape") setAddingSector(false); }} placeholder="Ej. Terraza" /><button className="button primary" onClick={createSector} disabled={!sectorName.trim()}>Crear sector</button><button className="button" onClick={() => setAddingSector(false)}>Cancelar</button></div>}
      {addingTables && <div className="panel table-add-panel">
        <div><strong>Agregar mesas</strong><small>Elegí el sector y cuántas mesas querés crear.</small></div>
        <label>Sector<select value={addArea} onChange={(event) => { setAddArea(event.target.value); setAddCount(1); }}>{sectors.filter((area) => area.id !== "counter").map((area) => <option key={area.id} value={area.id}>{area.label} · {area.limit - areaCounts[area.id]} libres</option>)}</select></label>
        <label>Cantidad<input type="number" min={1} max={Math.max(1, (sectors.find((area) => area.id === addArea)?.limit || 0) - (areaCounts[addArea] || 0))} value={addCount} onChange={(event) => setAddCount(Math.min(Math.max(1, (sectors.find((area) => area.id === addArea)?.limit || 0) - (areaCounts[addArea] || 0)), Math.max(1, Math.floor(Number(event.target.value) || 1))))} onKeyDown={(event) => { if (event.key === "Enter") createTables(); if (event.key === "Escape") setAddingTables(false); }} /></label>
        <button className="button primary" onClick={createTables} disabled={(areaCounts[addArea] || 0) >= (sectors.find((area) => area.id === addArea)?.limit || 0)}>Agregar</button>
        <button className="button" onClick={() => setAddingTables(false)}>Cancelar</button>
        {(areaCounts[addArea] || 0) >= (sectors.find((area) => area.id === addArea)?.limit || 0) && <p>Este sector está completo. Eliminá mesas libres o creá otro sector.</p>}
      </div>}
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
            return <motion.section key={area.id} layout={layoutMode && !draggingSectorId && !resizingSectorId && !reducedMotion} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ ...transitions.fast, layout: transitions.base }} data-sector-id={area.id} className={`floor-sector${area.autoFit ? " auto-fit" : ""}${activeArea === area.id && layoutMode ? " current" : ""}${area.id === "counter" && counterHovered ? " hovered" : ""}${layoutMode ? " editing" : ""}${draggingSectorId === area.id ? " dragging" : ""}${resizingSectorId === area.id ? " resizing" : ""}`}
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
                  return <motion.button key={table.id} layout={layoutMode && !draggingSectorId && !resizingSectorId && !reducedMotion ? "position" : false} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ ...transitions.fast, layout: transitions.fast }} className={`floor-table ${status}${selectedId === table.id && !selectingTables ? " selected" : ""}${selectedTableIds.includes(table.id) ? " bulk-selected" : ""}${dropTarget?.area === area.id && dropTarget.slot === slot ? " drop-target" : ""}`} whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={layoutMode ? undefined : press}
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
            <motion.div
              className="modal-scrim account-scrim account-dialog-scrim"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={requestAccountClose}
            >
            <motion.section
              className="table-account-drawer"
              ref={accountDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={`Cuenta de ${displayTableName(selected)}`}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="modal-close"
                aria-label="Cerrar cuenta"
                onClick={requestAccountClose}
              >
                <X size={19} />
              </button>
              <header className="account-heading">
                <div className="account-heading-content">
                  <div className="account-heading-title">
                    <h2>{displayTableName(selected)}</h2>
                    <button
                      type="button"
                      className="icon-btn account-edit-button"
                      aria-label="Editar mesa"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil size={16} />
                    </button>
                    {selected.billRequested && <span className="account-heading-status">Cuenta solicitada</span>}
                  </div>
                  <div className="account-heading-meta">
                    <span className="account-guests"><UsersRound size={15} aria-hidden="true" /> {selected.guests} {selected.guests === 1 ? "persona" : "personas"}</span>
                    {operator && (
                      <div className="account-operator" ref={operatorMenuRef}>
                        <button ref={operatorTriggerRef} type="button" className="account-operator-trigger" aria-label={`Responsable de ${displayTableName(selected)}: ${operator.name}, ${operator.role}`} aria-haspopup="listbox" aria-expanded={operatorMenuOpen} aria-controls="account-operator-menu" onClick={() => setOperatorMenuOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && !operatorMenuOpen) { event.preventDefault(); setOperatorMenuOpen(true); } }}>
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
                            {(teamOptions.some((member) => member.id === operator.id) ? teamOptions : [operator, ...teamOptions]).map((member) => <button type="button" role="option" aria-selected={member.id === operator.id} key={member.id} onClick={() => { setOperatorMenuOpen(false); changeOperator(member.id); if (!selected.items.length || member.id === operator.id) requestAnimationFrame(() => operatorTriggerRef.current?.focus({ preventScroll: true })); }}>
                              <span className="account-operator-initials" aria-hidden="true">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                              <span className="account-operator-info"><strong>{member.name}</strong><small>{member.role}</small></span>
                              {member.id === operator.id && <Check size={15} aria-hidden="true" />}
                            </button>)}
                          </motion.div>}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
                <div className="account-heading-categories" ref={setCategoryContainer} />
              </header>
              <div className="account-body">
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
                  onClearTable={() => { update((table) => ({ ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined })); setSelectedLineId(null); setConfirmClearTable(false); }}
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
              </div>
            </motion.section>
            </motion.div>
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
