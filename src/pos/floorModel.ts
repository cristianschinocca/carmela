import { ensureCounterTableSequenceAtLeast } from "../stores/counterSequence";

export type Line = { id: string; productId: number; quantity: number; note?: string; unitPrice?: number; unitDiscount?: number };
export type Area = string;
export type SectorLayout = { x: number; y: number; width: number; height: number };
export type Sector = { id: Area; label: string; description: string; limit: number; columns: number; start: number; minHeight: number; layout?: SectorLayout; autoFit?: boolean };
export type PinPurpose = "enter" | "confirm-command" | "request-bill" | "transfer" | "settle";
export type Table = {
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
export const KEY = "carmela.pos.floor.v2";
export const newLineId = () => `line-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const TABLE_GRID_COLUMNS = 16;
const TABLE_GRID_X_STEP = 66;
const TABLE_GRID_Y_STEP = 56;
const TABLE_GRID_START_X = 36;
const TABLE_GRID_START_Y = 58;
export const SECTORS_KEY = "carmela.pos.sectors.v1";
export const COUNTER_LIMIT = 50;
const COUNTER_MAX_HEIGHT = 320;
export const FREEFORM_MIN_HEIGHT = 220;
export const SECTOR_GAP = 14;
export const MAX_SECTOR_HEIGHT = 3000;
export const TABLE_SLOT_LIMIT = 256;
export const tableGridMetrics = (width: number) => {
  const mobile = window.innerWidth <= 760;
  const size = mobile ? 60 : 64;
  const gap = mobile ? 9 : 11;
  return { size, gap, columns: Math.max(1, Math.floor((Math.max(0, width - 4) + gap) / (size + gap))) };
};
export const materializeTableSlots = (items: Table[]): Table[] => {
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
    limit: COUNTER_LIMIT,
    columns: 3,
    start: 10,
    minHeight: 186,
  },
  { id: "patio", label: "Patio", description: "Mesas exteriores", limit: 64, columns: 12, start: 1, minHeight: 186 },
];
const clampSectorColumns = (value: number) => Math.min(12, Math.max(3, Math.round(value)));
export const loadSectors = (): Sector[] => {
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
        limit: item.id === "counter" ? COUNTER_LIMIT : 64,
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
export const makeDefaultMosaic = (boardWidth: number, tables: Table[], minimumBoardHeight = 0): Record<string, SectorLayout> => {
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
  const counterWidth = Math.max(1, boardWidth - rightX - 40);
  const counterColumns = Math.max(1, Math.floor((counterWidth + 11) / 75));
  const counterTables = tables.filter((table) => table.area === "counter" && (table.items.length || table.billRequested));
  const lastCounterSlot = Math.max(-1, ...counterTables.map((table, index) => table.slot ?? index));
  const counterHeight = 110 + Math.ceil((lastCounterSlot + 1) / counterColumns) * 67;
  const extraHeight = Math.max(0, Math.max(minimumBoardHeight, counterHeight) - salonHeight - patioHeight - SECTOR_GAP);
  salonHeight += Math.floor(extraHeight / 2);
  patioHeight += Math.ceil(extraHeight / 2);
  return {
    salon: { x: 0, y: 0, width: leftWidth / boardWidth, height: salonHeight },
    patio: { x: 0, y: salonHeight + SECTOR_GAP, width: leftWidth / boardWidth, height: patioHeight },
    counter: { x: rightX / boardWidth, y: 0, width: (boardWidth - rightX) / boardWidth, height: salonHeight + SECTOR_GAP + patioHeight },
  };
};
export type SectorRect = { x: number; y: number; width: number; height: number };
export const sectorRect = (layout: SectorLayout, boardWidth: number): SectorRect => ({
  x: layout.x * boardWidth, y: layout.y, width: layout.width * boardWidth, height: layout.height,
});
export const sectorsTouch = (a: SectorRect, b: SectorRect) =>
  a.x < b.x + b.width + SECTOR_GAP && a.x + a.width + SECTOR_GAP > b.x &&
  a.y < b.y + b.height + SECTOR_GAP && a.y + a.height + SECTOR_GAP > b.y;
export const sectorObstacles = (items: Sector[], id: string, boardWidth: number) =>
  items.filter((item) => item.id !== id && item.layout).map((item) => sectorRect(item.layout!, boardWidth));
export const moveSectorRect = (rect: SectorRect, desiredX: number, desiredY: number, obstacles: SectorRect[], boardWidth: number): SectorRect => {
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
export const resizeSectorRect = (base: SectorRect, desired: SectorRect, obstacles: SectorRect[], boardWidth: number): SectorRect => {
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
export const tablePosition = (index: number, area: Area = "salon") =>
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
    const exceedsLimit = sectors.some((area) => area.id !== "counter" && counts[area.id] > area.limit);
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
export const loadInitialFloor = (): Table[] => {
  const existing = loadTables().filter((table) => table.area !== "counter" || table.items.length > 0 || table.billRequested).map((table) => ({
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
  for (const area of ["salon", "patio"] as const) {
    if (!sectors.some((sector) => sector.id === area)) continue;
    const target = 64;
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

