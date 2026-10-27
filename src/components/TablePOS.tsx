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
  ArrowDown,
  ArrowRightLeft,
  BadgePercent,
  Banknote,
  ArrowUp,
  Check,
  ChevronDown,
  CreditCard,
  GripVertical,
  Grid2X2,
  KeyRound,
  LayoutGrid,
  Minus,
  MoveRight,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Smartphone,
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
import {
  allocateCounterTableNumber,
  ensureCounterTableSequenceAtLeast,
} from "../stores/counterSequence";

type Line = { id: string; productId: number; quantity: number; note?: string };
type Area = string;
type SectorLayout = { x: number; y: number; width: number; height: number };
type Sector = { id: Area; label: string; description: string; limit: number; columns: number; start: number; minHeight: number; layout?: SectorLayout; autoFit?: boolean };
type PinPurpose = "enter" | "confirm-command" | "request-bill" | "transfer" | "settle";
type Table = {
  id: string;
  name: string;
  guests: number;
  items: Line[];
  discount: number;
  billRequested: boolean;
  operatorId?: number;
  counterTurnNumber?: number;
  x: number;
  y: number;
  area: Area;
  slot?: number;
};
const KEY = "carmela.pos.floor.v2";
const newLineId = () => `line-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const TABLE_GRID_COLUMNS = 16;
const TABLE_GRID_X_STEP = 66;
const TABLE_GRID_Y_STEP = 56;
const TABLE_GRID_START_X = 36;
const TABLE_GRID_START_Y = 58;
const SECTORS_KEY = "carmela.pos.sectors.v1";
const COUNTER_MAX_HEIGHT = 320;
const FREEFORM_MIN_HEIGHT = 220;
const SECTOR_GAP = 14;
const MAX_SECTOR_HEIGHT = 3000;
const TABLE_SLOT_LIMIT = 256;
const tableGridMetrics = (width: number) => {
  const mobile = window.innerWidth <= 760;
  const size = mobile ? 60 : 64;
  const gap = mobile ? 9 : 11;
  return { size, gap, columns: Math.max(1, Math.floor((Math.max(0, width - 4) + gap) / (size + gap))) };
};
const materializeTableSlots = (items: Table[]): Table[] => {
  const used = new Map<Area, Set<number>>();
  const assigned = new Map<string, number>();
  for (const table of items) {
    const taken = used.get(table.area) || new Set<number>();
    used.set(table.area, taken);
    if (Number.isInteger(table.slot) && table.slot! >= 0 && table.slot! < TABLE_SLOT_LIMIT && !taken.has(table.slot!)) {
      assigned.set(table.id, table.slot!);
      taken.add(table.slot!);
    }
  }
  return items.map((table) => {
    const taken = used.get(table.area)!;
    let slot = assigned.get(table.id);
    if (slot === undefined) {
      slot = 0;
      while (taken.has(slot)) slot++;
      taken.add(slot);
    }
    return { ...table, slot };
  });
};
const DEFAULT_SECTORS: Sector[] = [
  { id: "salon", label: "Salón", description: "Mesas interiores", limit: 64, columns: 9, start: 1, minHeight: 186 },
  {
    id: "counter",
    label: "Mostrador",
    description: "Atención rápida",
    limit: 5,
    columns: 3,
    start: 10,
    minHeight: 186,
  },
  { id: "patio", label: "Patio", description: "Mesas exteriores", limit: 64, columns: 12, start: 1, minHeight: 186 },
];
const clampSectorColumns = (value: number) => Math.min(12, Math.max(3, Math.round(value)));
const loadSectors = (): Sector[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(SECTORS_KEY) || "null");
    if (!Array.isArray(stored) || !stored.length) return DEFAULT_SECTORS;
    const valid = stored.filter((item) => typeof item.id === "string" && typeof item.label === "string");
    return valid.length ? valid.map((item) => {
      const columns = clampSectorColumns(Number.isFinite(item.columns) ? item.columns : item.width === "full" ? 12 : item.width === "narrow" ? 3 : 9);
      const defaultStart = item.id === "counter" && columns <= 3 ? 10 : 1;
      return {
        ...item,
        description: typeof item.description === "string" ? item.description : "Sector de mesas",
        limit: item.id === "counter" ? 5 : 64,
        columns,
        start: Math.min(13 - columns, Math.max(1, Number.isFinite(item.start) ? Math.round(item.start) : defaultStart)),
        minHeight: Number.isFinite(item.minHeight) ? Math.min(item.id === "counter" ? COUNTER_MAX_HEIGHT : 1400, Math.max(140, item.minHeight)) : 186,
        autoFit: typeof item.autoFit === "boolean" ? item.autoFit : undefined,
        layout: item.layout && [item.layout.x, item.layout.y, item.layout.width, item.layout.height].every(Number.isFinite)
          ? {
              width: Math.min(1, Math.max(0.16, item.layout.width)),
              x: Math.max(0, Math.min(item.layout.x, 1 - Math.min(1, Math.max(0.16, item.layout.width)))),
              y: Math.max(0, item.layout.y),
              height: Math.min(MAX_SECTOR_HEIGHT, Math.max(FREEFORM_MIN_HEIGHT, item.layout.height)),
            }
          : undefined,
      };
    }) : DEFAULT_SECTORS;
  } catch { return DEFAULT_SECTORS; }
};
const makeDefaultMosaic = (boardWidth: number, tables: Table[], minimumBoardHeight = 0): Record<string, SectorLayout> => {
  const leftWidth = Math.max(260, Math.min(boardWidth * 0.77, boardWidth - 226));
  const rightX = leftWidth + SECTOR_GAP;
  const leftHeight = (area: Area) => {
    const innerWidth = leftWidth - 40;
    const columns = Math.max(1, Math.floor((innerWidth + 11) / 75));
    const count = tables.filter((table) => table.area === area).length;
    const rows = Math.ceil(count / columns);
    return Math.max(300, 110 + rows * 67);
  };
  let salonHeight = leftHeight("salon");
  let patioHeight = leftHeight("patio");
  const extraHeight = Math.max(0, minimumBoardHeight - salonHeight - patioHeight - SECTOR_GAP);
  salonHeight += Math.floor(extraHeight / 2);
  patioHeight += Math.ceil(extraHeight / 2);
  return {
    salon: { x: 0, y: 0, width: leftWidth / boardWidth, height: salonHeight },
    patio: { x: 0, y: salonHeight + SECTOR_GAP, width: leftWidth / boardWidth, height: patioHeight },
    counter: { x: rightX / boardWidth, y: 0, width: (boardWidth - rightX) / boardWidth, height: salonHeight + SECTOR_GAP + patioHeight },
  };
};
type SectorRect = { x: number; y: number; width: number; height: number };
const sectorRect = (layout: SectorLayout, boardWidth: number): SectorRect => ({
  x: layout.x * boardWidth, y: layout.y, width: layout.width * boardWidth, height: layout.height,
});
const sectorsTouch = (a: SectorRect, b: SectorRect) =>
  a.x < b.x + b.width + SECTOR_GAP && a.x + a.width + SECTOR_GAP > b.x &&
  a.y < b.y + b.height + SECTOR_GAP && a.y + a.height + SECTOR_GAP > b.y;
const sectorObstacles = (items: Sector[], id: string, boardWidth: number) =>
  items.filter((item) => item.id !== id && item.layout).map((item) => sectorRect(item.layout!, boardWidth));
const moveSectorRect = (rect: SectorRect, desiredX: number, desiredY: number, obstacles: SectorRect[], boardWidth: number): SectorRect => {
  let x = Math.max(0, Math.min(boardWidth - rect.width, desiredX));
  let y = Math.max(0, desiredY);
  // Resolve each axis from the last valid position. A sector stops at its neighbour instead of jumping through it.
  const moveX = () => {
    for (const other of obstacles) {
      if (y >= other.y + other.height + SECTOR_GAP || y + rect.height + SECTOR_GAP <= other.y) continue;
      if (x > rect.x && rect.x + rect.width + SECTOR_GAP <= other.x) x = Math.min(x, other.x - SECTOR_GAP - rect.width);
      if (x < rect.x && rect.x >= other.x + other.width + SECTOR_GAP) x = Math.max(x, other.x + other.width + SECTOR_GAP);
    }
    if (obstacles.some((other) => sectorsTouch({ ...rect, x, y }, other))) x = rect.x;
  };
  const moveY = () => {
    for (const other of obstacles) {
      if (x >= other.x + other.width + SECTOR_GAP || x + rect.width + SECTOR_GAP <= other.x) continue;
      if (y > rect.y && rect.y + rect.height + SECTOR_GAP <= other.y) y = Math.min(y, other.y - SECTOR_GAP - rect.height);
      if (y < rect.y && rect.y >= other.y + other.height + SECTOR_GAP) y = Math.max(y, other.y + other.height + SECTOR_GAP);
    }
    if (obstacles.some((other) => sectorsTouch({ ...rect, x, y }, other))) y = rect.y;
  };
  if (Math.abs(x - rect.x) >= Math.abs(y - rect.y)) { moveX(); moveY(); }
  else { moveY(); moveX(); }
  return { ...rect, x, y };
};
const resizeSectorRect = (base: SectorRect, desired: SectorRect, obstacles: SectorRect[], boardWidth: number): SectorRect => {
  const valid = (rect: SectorRect) => rect.width >= 220 && rect.height >= FREEFORM_MIN_HEIGHT && rect.x >= 0 &&
    rect.x + rect.width <= boardWidth + 0.01 && !obstacles.some((other) => sectorsTouch(rect, other));
  const furthest = (from: SectorRect, target: SectorRect) => {
    if (valid(target)) return target;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 20; index++) {
      const middle = (low + high) / 2;
      const candidate = {
        ...from,
        x: from.x + (target.x - from.x) * middle,
        width: from.width + (target.width - from.width) * middle,
        height: from.height + (target.height - from.height) * middle,
      };
      if (valid(candidate)) low = middle;
      else high = middle;
    }
    return { ...from, x: from.x + (target.x - from.x) * low, width: from.width + (target.width - from.width) * low, height: from.height + (target.height - from.height) * low };
  };
  const horizontal = furthest(base, { ...base, x: desired.x, width: desired.width });
  return furthest(horizontal, { ...horizontal, height: desired.height });
};
const normalizeCounterNumbers = (tables: Table[]) => {
  const used = new Set(
    tables
      .filter((table) => table.area === "counter" && table.counterTurnNumber)
      .map((table) => table.counterTurnNumber!),
  );
  const normalized = tables.map((table) => {
    if (
      table.area !== "counter" ||
      !table.items.length ||
      table.counterTurnNumber
    )
      return table;
    let number = 1;
    while (used.has(number)) number++;
    used.add(number);
    return { ...table, counterTurnNumber: number };
  });
  ensureCounterTableSequenceAtLeast(Math.max(0, ...used));
  return normalized;
};
const tablePosition = (index: number, area: Area = "salon") =>
  area === "counter"
    ? { x: 93, y: TABLE_GRID_START_Y + index * TABLE_GRID_Y_STEP }
    : {
        x: TABLE_GRID_START_X + (index % TABLE_GRID_COLUMNS) * TABLE_GRID_X_STEP,
        y: TABLE_GRID_START_Y + Math.floor(index / TABLE_GRID_COLUMNS) * TABLE_GRID_Y_STEP,
      };
const distributeAreas = <T extends Omit<Table, "area">>(
  tables: T[],
): Table[] => {
  const counterCount = Math.min(5, Math.ceil(tables.length * 0.08));
  const salonCount = Math.ceil((tables.length - counterCount) / 2);
  const patioCount = tables.length - counterCount - salonCount;
  const counts: Record<Area, number> = { salon: 0, patio: 0, counter: 0 };
  return tables.map((table, index) => {
    const area: Area =
      index < salonCount
        ? "salon"
        : index < salonCount + patioCount
          ? "patio"
          : "counter";
    return { ...table, area, ...tablePosition(counts[area]++, area) };
  });
};
const initialTables = (): Table[] =>
  distributeAreas(
    Array.from({ length: 30 }, (_, index) => ({
      id: `table-${index + 1}`,
      name: `Mesa ${index + 1}`,
      guests: 2,
      items: [],
      discount: 0,
      billRequested: false,
      operatorId: undefined,
      ...tablePosition(index),
    })),
  );
const loadTables = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!Array.isArray(parsed)) return initialTables();
    if (!parsed.length) return [];
    const sectors = loadSectors();
    const valid = parsed.every((table) =>
      sectors.some((area) => area.id === table.area),
    );
    if (!valid)
      return normalizeCounterNumbers(
        distributeAreas(
          parsed.map((table) => ({
          ...table,
          billRequested: Boolean(table.billRequested),
          })),
        ),
      );
    const counts: Record<Area, number> = {};
    for (const table of parsed as Table[]) counts[table.area] = (counts[table.area] || 0) + 1;
    const exceedsLimit = sectors.some((area) => counts[area.id] > area.limit);
    const normalized = parsed.map((table: Table) => ({
      ...table,
      billRequested: Boolean(table.billRequested),
    }));
    if (exceedsLimit)
      return normalizeCounterNumbers(
        distributeAreas(
          normalized.map(({ area: _, ...table }: Table) => table),
        ),
      );
    let compacted = [...normalized];
    for (const area of ["salon", "patio"] as const) {
      const areaTables = compacted.filter((table) => table.area === area);
      const oldAutoLayout = areaTables.every(
        (table, index) =>
          table.x === 38 + (index % 8) * 133 &&
          table.y === 42 + Math.floor(index / 8) * 105,
      );
      const compactAutoLayout = areaTables.every(
        (table, index) =>
          table.x === 18 + (index % TABLE_GRID_COLUMNS) * TABLE_GRID_X_STEP &&
          table.y === 50 + Math.floor(index / TABLE_GRID_COLUMNS) * TABLE_GRID_Y_STEP,
      );
      if (oldAutoLayout || compactAutoLayout) {
        let index = 0;
        compacted = compacted.map((table) =>
          table.area === area
            ? { ...table, ...tablePosition(index++, area) }
            : table,
        );
      }
    }
    const counterTables = compacted.filter((table) => table.area === "counter");
    const counterTablesUseOldGrid = counterTables.every(
      (table, index) =>
        (table.x === 38 && table.y === 42 + index * 105) ||
        (table.x === 70 && table.y === 58 + index * 86),
    );
    const legacyCounterLayout =
      new Set(counterTables.map((table) => table.y)).size < counterTables.length ||
      counterTables.some((table) => table.x > 100) ||
      counterTablesUseOldGrid;
    if (legacyCounterLayout) {
      let counterIndex = 0;
      compacted = compacted.map((table) =>
        table.area === "counter"
          ? { ...table, ...tablePosition(counterIndex++, "counter") }
          : table,
      );
    }
    return normalizeCounterNumbers(compacted);
  } catch {
    return initialTables();
  }
};
const loadInitialFloor = (): Table[] => {
  const existing = loadTables().map((table) => ({
    ...table,
    items: table.items.map((line, index) => ({
      ...line,
      id: line.id || `legacy-${table.id}-${index}`,
      note: typeof line.note === "string" ? line.note : "",
    })),
  }));
  const seedKey = "carmela.pos.seed.128.v1";
  if (localStorage.getItem(seedKey)) return existing;
  const sectors = loadSectors();
  const next = [...existing];
  const usedNumbers = new Set(next.map((table) => Number(table.name.match(/\d+/)?.[0])).filter(Boolean));
  let number = 1;
  for (const area of ["salon", "patio", "counter"] as const) {
    if (!sectors.some((sector) => sector.id === area)) continue;
    const target = area === "counter" ? 5 : 64;
    const count = next.filter((table) => table.area === area).length;
    for (let index = count; index < target; index++) {
      while (usedNumbers.has(number)) number++;
      usedNumbers.add(number);
      next.push({
        id: `table-seed-${area}-${number}`,
        name: `Mesa ${number}`,
        guests: 2,
        items: [],
        discount: 0,
        billRequested: false,
        area,
        ...tablePosition(index, area),
      });
      number++;
    }
  }
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.setItem(seedKey, "1");
  return next;
};

export default function TablePOS({
  products,
  categories,
  onToast,
  onReorder,
}: {
  products: Product[];
  categories: string[];
  onToast: (message: string) => void;
  onReorder: (fromId: number, toId: number) => void;
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
  const [activeArea, setActiveArea] = useState<Area>("salon");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [payment, setPayment] = useState<"" | "Efectivo" | "Tarjeta" | "Transferencia">("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentDialogRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [sortingProducts, setSortingProducts] = useState(false);
  const [draggingProduct, setDraggingProduct] = useState<number | null>(null);
  const [lineEditorId, setLineEditorId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [confirmClearTable, setConfirmClearTable] = useState(false);
  const [lineNoteDraft, setLineNoteDraft] = useState("");
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
  const freeCounterTables = tables.filter(
    (table) => table.area === "counter" && !table.items.length && !table.billRequested,
  );
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
        const extraHeight = Math.max(0, minimumBoardHeight - salonHeight - patioHeight - SECTOR_GAP);
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
    const nextTable = freeCounterTables[0];
    if (!nextTable) return;
    setSelectedId(nextTable.id);
    setTeamOptions(loadTeamMembers().filter((member) => member.active));
    setOperator(null);
    setEmployeePickerOpen(true);
    setQuery("");
    setCategory("Todos");
  };
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(tables)), [tables]);
  useEffect(() => localStorage.setItem(SECTORS_KEY, JSON.stringify(sectors)), [sectors]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        !counterHovered ||
        layoutMode ||
        !freeCounterTables.length ||
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
    freeCounterTables,
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
      else if (accountOpen) {
        if (selected?.items.length && !selected.operatorId && operator) {
          setExitPin("");
          setExitPinError("");
          setPinPurpose("confirm-command");
          setExitPinOpen(true);
        } else {
          if (selected?.area === "counter" && !selected.items.length)
            update((table) => ({ ...table, counterTurnNumber: undefined }));
          setAccountOpen(false);
          setOperator(null);
        }
      }
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
  const available = useMemo(
    () =>
      products.filter(
        (product) =>
          product.available &&
          (category === "Todos" || product.category === category) &&
          product.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, category, query],
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
  const moveTarget = tables.find((table) => table.id === moveTargetId && table.id !== selectedId);
  const destinationOwner = moveTarget?.items.length
    ? moveTarget.operatorId
      ? loadTeamMembers().find((member) => member.id === moveTarget.operatorId)
      : loadTeamMembers().find((member) => member.id === Number(moveTargetOperatorId) && member.active)
    : operator;
  const sourceNeedsMovePin = Boolean(selected && !selected.operatorId);
  const destinationNeedsMovePin = Boolean(moveTarget?.items.length && destinationOwner && destinationOwner.id !== operator?.id);
  const subtotal = lines.reduce(
    (sum, { line, product }) => sum + line.quantity * product.price,
    0,
  );
  const discount = Math.min(selected?.discount || 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  const tableTotal = (table: Table) => {
    const tableSubtotal = table.items.reduce(
      (sum, line) =>
        sum +
        (products.find((product) => product.id === line.productId)?.price ||
          0) *
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
      setQuery("");
      setCategory("Todos");
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
    setEmployeePickerOpen(false);
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
      update((table) => ({ ...table, counterTurnNumber: undefined }));
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
        const existing = table.items.find((line) => line.productId === productId && !line.note);
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
      const remaining = items.reduce((sum, line) => sum + line.quantity * (products.find((product) => product.id === line.productId)?.price || 0), 0);
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
    if (!editorLine) return;
    const note = lineNoteDraft.trim();
    const quantity = Math.min(editorLine.quantity, Math.max(1, Math.floor(lineQuantityDraft) || 1));
    const splitId = newLineId();
    update((table) => ({
      ...table,
      billRequested: note === (editorLine.note || "") ? table.billRequested : false,
      items: table.items.flatMap((line) => {
        if (line.id !== editorLine.id || note === (line.note || "")) return [line];
        if (quantity >= line.quantity) return [{ ...line, note }];
        return [{ ...line, quantity: line.quantity - quantity }, { ...line, id: splitId, quantity, note }];
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
    if (moveWholeTable) {
      setTables((current) => current.map((table) => {
        if (table.id === selected.id) return { ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined };
        if (table.id !== moveTarget.id) return table;
        const items = table.items.map((line) => ({ ...line }));
        for (const line of selected.items) {
          const existing = items.find((item) => item.productId === line.productId && (item.note || "") === (line.note || ""));
          if (existing) existing.quantity += line.quantity;
          else items.push({ ...line });
        }
        const destinationSubtotal = table.items.reduce((sum, line) => sum + line.quantity * (products.find((product) => product.id === line.productId)?.price || 0), 0);
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
    setTables((current) => current.map((table) => {
      if (table.id === selected.id) {
        const items = table.items.flatMap((line) => line.id !== editorLine.id ? [line]
          : line.quantity > quantity ? [{ ...line, quantity: line.quantity - quantity }] : []);
        const remaining = items.reduce((sum, line) => sum + line.quantity * (products.find((product) => product.id === line.productId)?.price || 0), 0);
        return { ...table, items, discount: Math.min(table.discount, remaining), billRequested: false,
          operatorId: items.length ? table.operatorId || operator.id : undefined,
          counterTurnNumber: items.length ? table.counterTurnNumber : undefined };
      }
      if (table.id !== moveTarget.id) return table;
      const matching = table.items.find((line) => line.productId === editorLine.productId && (line.note || "") === movedNote);
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
  const moveCatalogProduct = (
    productId: number,
    index: number,
    direction: -1 | 1,
  ) => {
    const target = available[index + direction];
    if (target) onReorder(productId, target.id);
  };
  const openAddTables = (area = activeArea) => {
    setAddArea(area);
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
    if (!selected || !total || !payment) return;
    const name = displayTableName(selected);
    const closedAt = new Date().toISOString();
    const subtotalAmount = lines.reduce(
      (sum, { line, product }) => sum + line.quantity * product.price,
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
        unitPrice: product.price,
        ...(line.note ? { note: line.note } : {}),
      })),
    });
    update((table) => ({
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
    if (!selected || !total || !payment) return;
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
        <div>
          <span className="eyebrow">SECTORES</span>
          <h2>Plano de mesas</h2>
          <p>
            {tables.filter((table) => table.items.length).length} abiertas ·{" "}
            {tables.length} de {floorCapacity} lugares · {sectors.length} sectores
          </p>
        </div>
        <div className="floor-actions">
          {layoutMode && sectors.length === 3 && ["salon", "patio", "counter"].every((id) => sectors.some((sector) => sector.id === id)) && (
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
          {layoutMode && <button className={selectingTables ? "button primary" : "button"} aria-pressed={selectingTables} onClick={() => {
            setSelectingTables((value) => !value);
            setSelectedTableIds([]);
            setConfirmDeleteTables(false);
          }}><Check size={16} /> {selectingTables ? "Cancelar selección" : "Seleccionar mesas"}</button>}
          {layoutMode && selectedTableIds.length > 0 && <button className="button danger-button" onClick={() => setConfirmDeleteTables(true)}>
            <Trash2 size={15} /> Eliminar ({selectedTableIds.length})
          </button>}
          {layoutMode && (
            <button className="button" onClick={() => arrangeTables()}>
              <LayoutGrid size={16} /> Alinear todas
            </button>
          )}
          {layoutMode && <button className="button" onClick={() => setAddingSector(true)}><Plus size={16} /> Agregar sector</button>}
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
      </section>
      {layoutMode && (
        <motion.div
          className="floor-tip"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <span>
            Arrastrá mesas para ubicarlas en la cuadrícula. Arrastrá sectores desde el encabezado y cambiá su tamaño desde las esquinas.
          </span>
          <strong>Los cambios se guardan automáticamente.</strong>
        </motion.div>
      )}
      {addingSector && <div className="panel sector-create"><label htmlFor="new-sector-name">Nombre del sector</label><input id="new-sector-name" autoFocus maxLength={32} value={sectorName} onChange={(event) => setSectorName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createSector(); if (event.key === "Escape") setAddingSector(false); }} placeholder="Ej. Terraza" /><button className="button primary" onClick={createSector} disabled={!sectorName.trim()}>Crear sector</button><button className="button" onClick={() => setAddingSector(false)}>Cancelar</button></div>}
      {addingTables && <div className="panel table-add-panel">
        <div><strong>Agregar mesas</strong><small>Elegí el sector y cuántas mesas querés crear.</small></div>
        <label>Sector<select value={addArea} onChange={(event) => { setAddArea(event.target.value); setAddCount(1); }}>{sectors.map((area) => <option key={area.id} value={area.id}>{area.label} · {area.limit - areaCounts[area.id]} libres</option>)}</select></label>
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
            const areaTables = tables.filter((table) => table.area === area.id && (area.id !== "counter" || layoutMode || table.items.length || table.billRequested));
            const sectorStyle = isFreeform && area.layout
              ? { "--free-x": `${area.layout.x * 100}%`, "--free-y": `${area.layout.y}px`, "--free-width": `${area.layout.width * 100}%`, "--free-height": `${area.layout.height}px` }
              : { "--sector-columns": area.columns, "--sector-start": area.start, "--sector-min-height": `${area.minHeight}px` };
            return <motion.section key={area.id} layout={layoutMode && !draggingSectorId && !resizingSectorId && !reducedMotion} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ ...transitions.fast, layout: transitions.base }} data-sector-id={area.id} className={`floor-sector${area.autoFit ? " auto-fit" : ""}${activeArea === area.id && layoutMode ? " current" : ""}${area.id === "counter" && counterHovered ? " hovered" : ""}${layoutMode ? " editing" : ""}${draggingSectorId === area.id ? " dragging" : ""}${resizingSectorId === area.id ? " resizing" : ""}`}
              style={sectorStyle as CSSProperties}
              onMouseEnter={() => { if (area.id === "counter") setCounterHovered(true); }}
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
                  {area.id === "counter" && counterHovered && !layoutMode && freeCounterTables.length > 0 && <kbd className="floor-enter-hint">↵ Enter para abrir</kbd>}
                  <b>{occupied ? `${occupied} abiertas · ` : ""}{areaCounts[area.id]}/{area.limit}</b>
                </button>
                {layoutMode && <div className="sector-controls">
                  <button title={`Alinear mesas de ${area.label}`} aria-label={`Alinear mesas de ${area.label}`} onClick={() => arrangeTables(area.id)}><LayoutGrid size={14}/></button>
                  <button title={`Eliminar ${area.label}`} aria-label={`Eliminar ${area.label}`} onClick={() => deleteSector(area)}><Trash2 size={14}/></button>
                </div>}
              </div>
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
                {!areaTables.length && (area.id !== "counter" || layoutMode) && <div className="floor-sector-empty">Sin mesas en este sector</div>}
                {area.id === "counter" && !layoutMode && freeCounterTables.length > 0 && <button className="floor-counter-open" onClick={openNextCounter}>Abrir mesa</button>}
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
          <motion.div
            className="modal-scrim account-scrim"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={cancelEmployeeSelection}
          >
            <motion.section
              className="acrylic-modal operator-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="operator-title"
            >
              <button
                className="modal-close"
                aria-label="Cancelar selección de empleado"
                onClick={cancelEmployeeSelection}
              >
                <X size={19} />
              </button>
              <header className="operator-heading">
                <span className="eyebrow">{displayTableName(selected).toUpperCase()}</span>
                <h2 id="operator-title">¿Quién va a gestionar esta mesa?</h2>
                <p>Elegí un empleado para identificar la comanda.</p>
              </header>
              <div className="operator-list">
                {teamOptions.map((member) => {
                  const initials = member.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <motion.button
                      whileTap={press}
                      aria-label={`Trabajar como ${member.name}`}
                      onClick={() => chooseOperator(member)}
                      key={member.id}
                    >
                      <span className="operator-avatar">{initials}</span>
                      <span>
                        <strong>{member.name}</strong>
                        <small>{member.role}</small>
                      </span>
                      <em className={member.clockedIn ? "on-shift" : "off-shift"}>
                        {member.clockedIn ? "En turno" : "Fuera de turno"}
                      </em>
                    </motion.button>
                  );
                })}
                {!teamOptions.length && (
                  <div className="operator-empty">
                    <UserRound size={23} />
                    <strong>No hay empleados activos</strong>
                    <p>Creá o activá un usuario desde la sección Equipo.</p>
                  </div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {coversOpen && selected && operator && (
          <motion.div
            className="modal-scrim account-scrim"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={returnToEmployeePicker}
          >
            <motion.section
              className="acrylic-modal operator-modal covers-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="covers-title"
            >
              <button
                className="modal-close"
                aria-label="Volver a elegir empleado"
                onClick={returnToEmployeePicker}
              >
                <X size={19} />
              </button>
              <header className="operator-heading">
                <span className="eyebrow">{displayTableName(selected).toUpperCase()}</span>
                <h2 id="covers-title">¿Cuántos cubiertos?</h2>
                <p>Indicá cuántas personas se sientan en la mesa.</p>
              </header>
              <div className="covers-operator">
                <span className="operator-avatar">
                  {operator.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </span>
                <span><strong>{operator.name}</strong><small>{operator.role}</small></span>
              </div>
              <div className="covers-stepper">
                <button
                  type="button"
                  aria-label="Restar un cubierto"
                  disabled={coversDraft <= 1}
                  onClick={() => setCoversDraft((value) => Math.max(1, value - 1))}
                >
                  <Minus size={18} />
                </button>
                <label>
                  <input
                    autoFocus
                    aria-label="Cantidad de cubiertos"
                    type="number"
                    min="1"
                    max="20"
                    value={coversDraft}
                    onChange={(event) => setCoversDraft(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                  />
                  <span>{coversDraft === 1 ? "persona" : "personas"}</span>
                </label>
                <button
                  type="button"
                  aria-label="Sumar un cubierto"
                  disabled={coversDraft >= 20}
                  onClick={() => setCoversDraft((value) => Math.min(20, value + 1))}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="covers-modal-actions">
                <button className="button" onClick={returnToEmployeePicker}>Volver</button>
                <button className="button primary" onClick={confirmCovers}>Abrir mesa</button>
              </div>
            </motion.section>
          </motion.div>
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
                <button
                  className="icon-btn"
                  aria-label="Editar mesa"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} />
                </button>
              </header>
              <div className="account-body">
                <section className="account-catalog">
                  <div className="account-catalog-tools">
                    <span><strong>Productos</strong> · {available.length} disponibles</span>
                    <button
                      className={
                        sortingProducts ? "text-btn active" : "text-btn"
                      }
                      onClick={() => {
                        setSortingProducts((value) => !value);
                        setDraggingProduct(null);
                      }}
                    >
                      {sortingProducts ? (
                        <>
                          <Check size={14} /> Listo
                        </>
                      ) : (
                        <>
                          <GripVertical size={14} /> Ordenar productos
                        </>
                      )}
                    </button>
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="Buscar producto…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <div className="pos-categories">
                    {["Todos", ...categories].map((item) => (
                      <button
                        key={item}
                        className={category === item ? "active" : ""}
                        onClick={() => setCategory(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div
                    className={
                      sortingProducts
                        ? "compact-products sorting"
                        : "compact-products"
                    }
                  >
                    {available.map((product, index) =>
                      sortingProducts ? (
                        <motion.div
                          layout
                          draggable
                          className={
                            draggingProduct === product.id
                              ? "catalog-sort-card dragging"
                              : "catalog-sort-card"
                          }
                          onDragStart={() => setDraggingProduct(product.id)}
                          onDragEnd={() => setDraggingProduct(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (
                              draggingProduct !== null &&
                              draggingProduct !== product.id
                            )
                              onReorder(draggingProduct, product.id);
                            setDraggingProduct(null);
                          }}
                          key={product.id}
                        >
                          <GripVertical size={16} />
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.category}</small>
                          </span>
                          <b>{money(product.price)}</b>
                          <div>
                            <button
                              disabled={index === 0}
                              aria-label={`Subir ${product.name}`}
                              onClick={() =>
                                moveCatalogProduct(product.id, index, -1)
                              }
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              disabled={index === available.length - 1}
                              aria-label={`Bajar ${product.name}`}
                              onClick={() =>
                                moveCatalogProduct(product.id, index, 1)
                              }
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          layout
                          whileTap={{ scale: 0.985 }}
                          key={product.id}
                          aria-label={`Agregar ${product.name}`}
                          onClick={() => addProduct(product.id)}
                        >
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.category}</small>
                          </span>
                          <b>{money(product.price)}</b>
                          <i>
                            <Plus size={15} />
                          </i>
                        </motion.button>
                      ),
                    )}
                  </div>
                  {!available.length && (
                    <div className="empty">
                      <p>No encontramos productos.</p>
                    </div>
                  )}
                </section>
                <aside className="account-ticket">
                  <div className="ticket-heading"><strong>Cuenta</strong><span>{itemCount} {itemCount === 1 ? "artículo" : "artículos"}</span></div>
                  <div className="table-lines">
                    <AnimatePresence initial={false}>
                      {lines.length ? (
                        lines.map(({ line, product }) => (
                          <motion.div
                            layout
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className={`table-line${selectedLineId === line.id ? " active" : ""}`}
                            key={line.id}
                          >
                            <button className="table-line-details" aria-label={`Seleccionar ${product.name}`} aria-pressed={selectedLineId === line.id} title="Seleccionar; doble clic para aclaración" onClick={() => setSelectedLineId(line.id)} onDoubleClick={() => openLineEditor(line)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); openLineEditor(line); } }}>
                              <strong>{product.name}</strong>
                              <small>
                                {money(product.price * line.quantity)}
                              </small>
                              {line.note && <span className="table-line-note">{line.note}</span>}
                            </button>
                            <div className="quantity">
                              <button
                                aria-label={`Restar una unidad de ${product.name}`}
                                onClick={() => changeQuantity(line.id, -1)}
                              >
                                <Minus size={13} />
                              </button>
                              <span>{line.quantity}</span>
                              <button
                                aria-label={`Sumar una unidad de ${product.name}`}
                                onClick={() => changeQuantity(line.id, 1)}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <button
                              className="remove-line"
                              aria-label={`Eliminar ${product.name}`}
                              onClick={() =>
                                changeQuantity(line.id, -line.quantity)
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          className="ticket-empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <span>La mesa está disponible</span>
                          <p>Elegí un producto para abrir la cuenta.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="ticket-actions" role="toolbar" aria-label="Acciones de la cuenta">
                    <button type="button" aria-label="Aclaración del artículo seleccionado" title="Aclaración del artículo seleccionado" disabled={!selectedLine} onClick={() => selectedLine && openLineEditor(selectedLine)}><Pencil size={16} /></button>
                    <button type="button" aria-label="Mover artículo seleccionado" title="Mover artículo seleccionado" disabled={!selectedLine} onClick={() => selectedLine && openLineEditor(selectedLine, "move")}><ArrowRightLeft size={16} /></button>
                    <button type="button" aria-label="Mover cuenta a otra mesa" title="Mover cuenta a otra mesa" disabled={!lines.length} onClick={openTableMove}><MoveRight size={17} /></button>
                    <button type="button" aria-label="Descuento" title="Descuento" aria-expanded={discountOpen} aria-controls="ticket-discount" disabled={!subtotal} className={discountOpen || discount > 0 ? "active" : ""} onClick={() => setDiscountOpen((value) => !value)}><BadgePercent size={17} /></button>
                    <button type="button" aria-label={selected.billRequested ? "Volver a consumo" : "Entregar cuenta"} title={selected.billRequested ? "Volver a consumo" : "Entregar cuenta"} disabled={!total} className={selected.billRequested ? "active" : ""} onClick={toggleBillRequest}><ReceiptText size={17} /></button>
                    <button type="button" aria-label="Vaciar mesa" title="Vaciar mesa" disabled={!lines.length} onClick={() => setConfirmClearTable(true)}><Trash2 size={16} /></button>
                  </div>
                  {confirmClearTable && <div className="ticket-clear-confirm" role="group" aria-label="Confirmar vaciado de mesa"><span>¿Vaciar esta mesa?</span><button type="button" onClick={() => setConfirmClearTable(false)}>Cancelar</button><button type="button" onClick={() => { update((table) => ({ ...table, items: [], discount: 0, billRequested: false, operatorId: undefined, counterTurnNumber: undefined })); setSelectedLineId(null); setConfirmClearTable(false); }}>Vaciar</button></div>}
                  {discountOpen && <label id="ticket-discount" className="manual-discount">
                    <span>
                      <strong>Descuento manual</strong>
                      <small>Importe en pesos</small>
                    </span>
                    <div>
                      <b>$</b>
                      <input
                        aria-label="Descuento manual"
                        inputMode="numeric"
                        type="number"
                        autoFocus
                        min="0"
                        max={subtotal}
                        step="100"
                        disabled={!subtotal}
                        value={selected.discount || ""}
                        placeholder="0"
                        onChange={(event) =>
                          update((table) => ({
                            ...table,
                            billRequested: false,
                            discount: Math.max(
                              0,
                              Math.min(
                                subtotal,
                                Number(event.target.value) || 0,
                              ),
                            ),
                          }))
                        }
                      />
                      {selected.discount > 0 && (
                        <button
                          type="button"
                          aria-label="Quitar descuento"
                          onClick={() =>
                            update((table) => ({
                              ...table,
                              discount: 0,
                              billRequested: false,
                            }))
                          }
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </label>}
                  <div className="table-totals">
                    <span>
                      Subtotal <b>{money(subtotal)}</b>
                    </span>
                    {discount > 0 && (
                      <span className="discount-line">
                        Descuento <b>− {money(discount)}</b>
                      </span>
                    )}
                    <strong>
                      Total <b>{money(total)}</b>
                    </strong>
                  </div>
                  <button
                    className="button primary full"
                    disabled={!total}
                    onClick={() => { setPayment(""); setPaymentOpen(true); }}
                  >
                    <Check size={17} /> Cobrar y cerrar{" "}
                    {total > 0 && money(total)}
                  </button>
                </aside>
              </div>
            </motion.section>
            </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && selected && paymentOpen && (
          <motion.div className="modal-scrim line-editor-scrim payment-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={() => setPaymentOpen(false)}>
            <motion.section ref={paymentDialogRef} className="acrylic-modal line-editor-modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"
              variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
                if (!focusable.length) return;
                if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
                else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
              }}>
              <button className="modal-close" aria-label="Cerrar cobro" onClick={() => setPaymentOpen(false)}><X size={19} /></button>
              <span className="eyebrow">COBRO DE MESA</span>
              <h2 id="payment-title">Cobrar {displayTableName(selected)}</h2>
              <div className="payment-total"><span>Total a cobrar</span><strong>{money(total)}</strong></div>
              <fieldset className="payment-methods"><legend>Medio de pago</legend>
                {([
                  ["Efectivo", Banknote],
                  ["Tarjeta", CreditCard],
                  ["Transferencia", Smartphone],
                ] as const).map(([method, Icon]) => <label key={method} className={`payment-choice${payment === method ? " selected" : ""}`}>
                  <input type="radio" name="payment-method" value={method} checked={payment === method} onChange={() => setPayment(method)} />
                  <Icon size={19} aria-hidden="true" /><span>{method}</span>
                </label>)}
              </fieldset>
              <div className="line-editor-actions"><button className="button" onClick={() => setPaymentOpen(false)}>Cancelar</button><button className="button primary" disabled={!payment} onClick={confirmPayment}>Confirmar cobro · {money(total)}</button></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && selected && (moveWholeTable || (editorLine && editorProduct)) && (
          <motion.div className="modal-scrim line-editor-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={() => { if (performance.now() - lineOpenedAtRef.current > 400) setLineEditorId(null); }}>
            <motion.section ref={lineDialogRef} className="acrylic-modal line-editor-modal" role="dialog" aria-modal="true" aria-labelledby="line-editor-title"
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
                <label className="field line-editor-field">Aclaración
                  <textarea aria-label="Aclaración" maxLength={200} value={lineNoteDraft} onChange={(event) => setLineNoteDraft(event.target.value)} placeholder="Ej. sin azúcar, leche vegetal…" />
                  <small>Esta indicación queda guardada junto al artículo.</small>
                </label>
                {editorLine.quantity > 1 && <label className="field line-editor-field">Aplicar a cuántas unidades
                  <input type="number" min={1} max={editorLine.quantity} value={lineQuantityDraft} onChange={(event) => setLineQuantityDraft(Math.min(editorLine.quantity, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
                </label>}
                <div className="line-editor-actions">
                  <button className="button" onClick={() => { setLineEditorMode("move"); setMoveError(""); }}><ArrowRightLeft size={15} /> Mover a otra mesa</button>
                  <button className="button primary" onClick={saveLineNote}>Guardar aclaración</button>
                </div>
              </> : <>
                <label className="field line-editor-field">Mesa de destino
                  <select value={moveTargetId} onChange={(event) => { setMoveTargetId(event.target.value); setMoveTargetOperatorId(""); setSourceMovePin(""); setTargetMovePin(""); setMoveError(""); }}>
                    <option value="">Elegí una mesa</option>
                    {sectors.map((area) => <optgroup key={area.id} label={area.label}>{tables.filter((table) => table.area === area.id && table.id !== selectedId).map((table, index) => <option key={table.id} value={table.id}>{table.area === "counter" && !table.items.length ? `Puesto libre ${index + 1}` : displayTableName(table)} · {table.items.length ? table.billRequested ? "Cuenta solicitada" : "Ocupada" : "Libre"}</option>)}</optgroup>)}
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
          <motion.div
            className="modal-scrim operator-pin-scrim"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={cancelOperatorPin}
          >
            <motion.section
              className="acrylic-modal operator-pin-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="operator-pin-title"
            >
              <button
                className="modal-close"
                aria-label={pinPurpose === "enter" ? "Cancelar acceso" : pinPurpose === "settle" ? "Volver al cobro" : "Volver a la mesa"}
                onClick={cancelOperatorPin}
              >
                <X size={19} />
              </button>
              <div className="operator-pin-icon">
                <KeyRound size={21} />
              </div>
              <span className="eyebrow">VERIFICAR EMPLEADO</span>
              <h2 id="operator-pin-title">Código de {operator.name}</h2>
              <p>
                {pinPurpose === "enter"
                  ? `Ingresá tu código personal para entrar a ${selected ? displayTableName(selected) : "la mesa"}.`
                  : pinPurpose === "transfer"
                    ? `Confirmá tu código para quedar a cargo de ${selected ? displayTableName(selected) : "la mesa"}.`
                  : pinPurpose === "request-bill"
                    ? `Confirmá tu código para entregar la cuenta y salir de ${selected ? displayTableName(selected) : "la mesa"}.`
                  : pinPurpose === "settle"
                    ? `Confirmá tu código para cobrar y cerrar ${selected ? displayTableName(selected) : "la mesa"}.`
                    : `Confirmá tu código para guardar la comanda y salir de ${selected ? displayTableName(selected) : "la mesa"}.`}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  verifyOperatorPin();
                }}
              >
                <label className="field operator-pin-field">
                  Código de cuatro números
                  <input
                    autoFocus
                    aria-label={`Código de ${operator.name}`}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={exitPin}
                    onChange={(event) => {
                      setExitPinError("");
                      setExitPin(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      );
                    }}
                  />
                </label>
                {exitPinError && (
                  <motion.p
                    className="operator-pin-error"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                  >
                    {exitPinError}
                  </motion.p>
                )}
                <div className="operator-pin-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={cancelOperatorPin}
                  >
                    {pinPurpose === "enter" ? "Volver al plano" : pinPurpose === "settle" ? "Volver al cobro" : "Volver a la mesa"}
                  </button>
                  <button
                    className="button primary"
                    disabled={exitPin.length !== 4}
                  >
                    <Check size={16} />{" "}
                    {pinPurpose === "enter"
                      ? "Verificar y entrar"
                      : pinPurpose === "transfer"
                        ? "Confirmar cambio"
                      : pinPurpose === "request-bill"
                        ? "Confirmar y entregar"
                      : pinPurpose === "settle"
                        ? "Confirmar cobro"
                        : "Confirmar y salir"}
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editing && selected && (
          <>
            <motion.div
              className="modal-scrim nested-scrim"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />
            <motion.div
              className="acrylic-modal compact-modal table-edit-modal"
              role="dialog"
              aria-modal="true"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <button
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setEditing(false)}
              >
                <X size={18} />
              </button>
              <span className="eyebrow">DATOS DE LA MESA</span>
              <h2>Editar {displayTableName(selected)}</h2>
              <label className="field">
                Nombre
                <input
                  value={selected.name}
                  onChange={(event) =>
                    update((table) => ({ ...table, name: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                Sector
                <select
                  value={selected.area}
                  onChange={(event) =>
                    moveSelectedArea(event.target.value as Area)
                  }
                >
                  {sectors.map((area) => (
                    <option
                      value={area.id}
                      disabled={
                        area.limit !== undefined &&
                        tables.filter((table) => table.area === area.id)
                          .length >= area.limit &&
                        selected.area !== area.id
                      }
                      key={area.id}
                    >
                      {area.label}
                      {area.limit ? ` (máx. ${area.limit})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary full"
                onClick={() => setEditing(false)}
              >
                Guardar cambios
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
