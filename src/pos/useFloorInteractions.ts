import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type RefObject, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { FREEFORM_MIN_HEIGHT, MAX_SECTOR_HEIGHT, TABLE_SLOT_LIMIT, tableGridMetrics, materializeTableSlots, sectorRect, sectorObstacles, moveSectorRect, resizeSectorAndPush, type Area, type Sector, type SectorLayout, type SectorRect, type Table } from "./floorModel";

type SectorResizeMetrics = { widthOffset: number; chromeHeight: number; rowHeight: number; rowGap: number; lastSlot: number; compact: boolean };
type SectorDragGesture = {
  id: string; pointerId: number; x: number; pageY: number; layout: SectorLayout;
  latest: SectorLayout; boardWidth: number; moved: boolean;
  obstacles: SectorRect[]; element: HTMLElement; pending: { x: number; y: number } | null; frame: number | null;
};
type SectorResizeGesture = {
  id: string; pointerId: number; x: number; pageY: number; layout: SectorLayout;
  sectors: Sector[]; latest: Sector[]; boardWidth: number; edge: -1 | 1; moved: boolean;
  metrics: SectorResizeMetrics; elements: Map<string, HTMLElement>;
  pending: { x: number; y: number } | null; frame: number | null;
};

type Props = {
  boardRef: RefObject<HTMLDivElement | null>; boardHeight: number; setBoardHeight: Dispatch<SetStateAction<number>>;
  sectorsRef: RefObject<Sector[]>; sectors: Sector[]; setSectors: Dispatch<SetStateAction<Sector[]>>;
  tables: Table[]; setTables: Dispatch<SetStateAction<Table[]>>; areaCounts: Record<string, number>;
  layoutMode: boolean; selectingTables: boolean; setActiveArea: Dispatch<SetStateAction<Area>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>; setTableColumns: Dispatch<SetStateAction<Record<Area, number>>>;
  onToast: (message: string) => void;
};

/** Desplazamiento y redimensionamiento del plano y de sus mesas. */
export function useFloorInteractions({ boardRef, boardHeight, setBoardHeight, sectorsRef, sectors, setSectors, tables, setTables, areaCounts, layoutMode, selectingTables, setActiveArea, setSelectedId, setTableColumns, onToast }: Props) {
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ area: Area; slot: number } | null>(null);
  const tableTouchDragRef = useRef<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressTableClickRef = useRef(false);
  const [draggingSectorId, setDraggingSectorId] = useState<string | null>(null);
  const [resizingSectorId, setResizingSectorId] = useState<string | null>(null);
  const [sectorGestureSettling, setSectorGestureSettling] = useState(false);
  const sectorGestureFrameRef = useRef<number | null>(null);
  const sectorDragRef = useRef<SectorDragGesture | null>(null);
  const resizeRef = useRef<SectorResizeGesture | null>(null);
  const scrollGestureRef = useRef<{ pointerId: number; mode: "drag" | "resize"; clientX: number; clientY: number; frame: number; verticalDirection: number } | null>(null);
  const suppressSectorClick = useRef(false);
  const applySectorDrag = () => {
    const drag = sectorDragRef.current;
    if (!drag?.pending) return;
    drag.frame = null;
    const { x: clientX, y: clientY } = drag.pending;
    drag.pending = null;
    const dx = clientX - drag.x;
    const dy = clientY + window.scrollY - drag.pageY;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.moved) return;
    drag.moved = true;
    const previous = sectorRect(drag.latest, drag.boardWidth);
    const next = moveSectorRect(previous, drag.layout.x * drag.boardWidth + dx, drag.layout.y + dy, drag.obstacles, drag.boardWidth);
    drag.latest = { ...drag.latest, x: next.x / drag.boardWidth, y: Math.round(next.y) };
    drag.element.style.setProperty("--free-x", `${drag.latest.x * 100}%`);
    drag.element.style.setProperty("--free-y", `${drag.latest.y}px`);
    drag.element.classList.remove("auto-fit");
    boardRef.current?.style.setProperty("--floor-board-height", `${Math.max(boardHeight, drag.latest.y + drag.latest.height + 16) + window.innerHeight}px`);
  };
  const updateSectorDrag = (clientX: number, clientY: number) => {
    const drag = sectorDragRef.current;
    if (!drag) return;
    drag.pending = { x: clientX, y: clientY };
    if (drag.frame === null) drag.frame = requestAnimationFrame(applySectorDrag);
  };
  const sectorResizeMetrics = (id: string): SectorResizeMetrics | null => {
    const element = Array.from(boardRef.current?.querySelectorAll<HTMLElement>(".floor-sector") || [])
      .find((sector) => sector.dataset.sectorId === id);
    const list = element?.querySelector<HTMLElement>(".floor-sector-tables");
    const head = element?.querySelector<HTMLElement>(".floor-sector-head");
    if (!element || !list || !head) return null;

    const styles = getComputedStyle(element);
    const listStyles = getComputedStyle(list);
    const visible = tables.filter((table) => table.area === id && (id !== "counter" || table.items.length || table.billRequested));
    return {
      widthOffset: list.clientWidth - element.getBoundingClientRect().width,
      chromeHeight: parseFloat(styles.paddingTop) + head.offsetHeight +
        parseFloat(getComputedStyle(head).marginBottom) + parseFloat(styles.paddingBottom) +
        parseFloat(listStyles.paddingTop) + parseFloat(listStyles.paddingBottom) + 2,
      rowHeight: parseFloat(listStyles.gridAutoRows) || 56,
      rowGap: parseFloat(listStyles.rowGap) || 11,
      lastSlot: Math.max(-1, ...visible.map((table, index) => table.slot ?? index)),
      compact: id === "counter",
    };
  };
  const sectorGridColumns = (metrics: SectorResizeMetrics, width: number) =>
    tableGridMetrics(Math.max(0, width + metrics.widthOffset), metrics.compact).columns;
  const minimumSectorHeight = (metrics: SectorResizeMetrics, width: number) => {
    const rows = Math.floor(metrics.lastSlot / sectorGridColumns(metrics, width)) + 1;
    return Math.min(MAX_SECTOR_HEIGHT, Math.max(FREEFORM_MIN_HEIGHT, Math.ceil(
      metrics.chromeHeight + (rows ? rows * metrics.rowHeight + (rows - 1) * metrics.rowGap : 0),
    )));
  };
  const applySectorResize = () => {
    const resize = resizeRef.current;
    if (!resize?.pending) return;
    resize.frame = null;
    const { x: clientX, y: clientY } = resize.pending;
    resize.pending = null;
    const pointerDeltaY = clientY + window.scrollY - resize.pageY;
    if (Math.abs(clientX - resize.x) + Math.abs(pointerDeltaY) < 3 && !resize.moved) return;
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
    const height = Math.max(FREEFORM_MIN_HEIGHT, Math.min(MAX_SECTOR_HEIGHT, Math.round(resize.layout.height + pointerDeltaY)));
    const targetWidth = width * resize.boardWidth;
    const minimumHeight = minimumSectorHeight(resize.metrics, Math.min(targetWidth, resize.layout.width * resize.boardWidth));
    resize.latest = resizeSectorAndPush(resize.sectors, resize.id, {
      x: x * resize.boardWidth, y: resize.layout.y, width: targetWidth, height,
    }, resize.boardWidth, minimumHeight);
    for (const sector of resize.latest) {
      if (!sector.layout) continue;
      const element = resize.elements.get(sector.id);
      if (!element) continue;
      element.style.setProperty("--free-x", `${sector.layout.x * 100}%`);
      element.style.setProperty("--free-y", `${sector.layout.y}px`);
      element.style.setProperty("--free-width", `${sector.layout.width * 100}%`);
      element.style.setProperty("--free-height", `${sector.layout.height}px`);
      element.classList.remove("auto-fit");
    }
    const resized = resize.latest.find((sector) => sector.id === resize.id);
    const columns = sectorGridColumns(resize.metrics, (resized?.layout?.width || width) * resize.boardWidth);
    resize.elements.get(resize.id)?.querySelector<HTMLElement>(".floor-sector-tables")?.style.setProperty("--table-columns", String(columns));
    const boardHeight = Math.max(300, ...resize.latest.map((sector) => (sector.layout?.y || 0) + (sector.layout?.height || 0) + 16));
    boardRef.current?.style.setProperty("--floor-board-height", `${boardHeight + window.innerHeight}px`);
  };
  const updateSectorResize = (clientX: number, clientY: number) => {
    const resize = resizeRef.current;
    if (!resize) return;
    resize.pending = { x: clientX, y: clientY };
    if (resize.frame === null) resize.frame = requestAnimationFrame(applySectorResize);
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
    if (direction && direction === gesture.verticalDirection) {
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
    scrollGestureRef.current = { pointerId, mode, clientX, clientY, frame: requestAnimationFrame(tickGestureScroll), verticalDirection: 0 };
  };
  const trackGesturePointer = (pointerId: number, clientX: number, clientY: number) => {
    const gesture = scrollGestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    const deltaY = clientY - gesture.clientY;
    if (Math.abs(deltaY) > 1) {
      gesture.verticalDirection = Math.sign(deltaY);
    }
    gesture.clientX = clientX;
    gesture.clientY = clientY;
  };
  const beginSectorGesture = () => {
    if (sectorGestureFrameRef.current !== null) cancelAnimationFrame(sectorGestureFrameRef.current);
    sectorGestureFrameRef.current = null;
    setSectorGestureSettling(true);
  };
  const settleSectorGesture = () => {
    sectorGestureFrameRef.current = requestAnimationFrame(() => {
      sectorGestureFrameRef.current = requestAnimationFrame(() => {
        setSectorGestureSettling(false);
        sectorGestureFrameRef.current = null;
      });
    });
  };
  useEffect(() => () => {
    stopGestureScroll();
    if (sectorGestureFrameRef.current !== null) cancelAnimationFrame(sectorGestureFrameRef.current);
  }, []);
  const startSectorDrag = (event: ReactPointerEvent<HTMLButtonElement>, sector: Sector) => {
    const board = boardRef.current;
    const element = event.currentTarget.closest<HTMLElement>(".floor-sector");
    if (!layoutMode || !board || board.clientWidth < 760 || !sector.layout || !element) return;
    sectorDragRef.current = {
      id: sector.id,
      pointerId: event.pointerId,
      x: event.clientX,
      pageY: event.clientY + window.scrollY,
      layout: sector.layout,
      latest: sector.layout,
      boardWidth: board.clientWidth,
      moved: false,
      obstacles: sectorObstacles(sectorsRef.current, sector.id, board.clientWidth),
      element,
      pending: null,
      frame: null,
    };
    beginSectorGesture();
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
    trackGesturePointer(event.pointerId, event.clientX, event.clientY);
    updateSectorDrag(event.clientX, event.clientY);
  };
  const finishSectorDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sectorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    if (event.type === "pointerup") drag.pending = { x: event.clientX, y: event.clientY };
    applySectorDrag();
    suppressSectorClick.current = drag.moved;
    sectorDragRef.current = null;
    stopGestureScroll();
    setDraggingSectorId(null);
    settleSectorGesture();
    if (drag.moved) {
      const nextHeight = Math.max(300, ...sectorsRef.current.map((sector) => {
        const layout = sector.id === drag.id ? drag.latest : sector.layout;
        return (layout?.y || 0) + (layout?.height || 0) + 16;
      }));
      setSectors((current) => current.map((sector) => sector.id === drag.id
        ? { ...sector, layout: drag.latest, autoFit: false }
        : sector.autoFit ? { ...sector, autoFit: false } : sector));
      setBoardHeight(nextHeight);
      boardRef.current?.style.setProperty("--floor-board-height", `${nextHeight}px`);
    }
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
    const metrics = sectorResizeMetrics(sector.id);
    if (!metrics) return;
    resizeRef.current = {
      id: sector.id,
      x: event.clientX,
      pageY: event.clientY + window.scrollY,
      layout: sector.layout,
      sectors: sectorsRef.current,
      latest: sectorsRef.current,
      boardWidth: board.clientWidth,
      pointerId: event.pointerId,
      edge,
      moved: false,
      metrics,
      elements: new Map(Array.from(board.querySelectorAll<HTMLElement>(".floor-sector"))
        .map((element) => [element.dataset.sectorId!, element])),
      pending: null,
      frame: null,
    };
    beginSectorGesture();
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
    trackGesturePointer(event.pointerId, event.clientX, event.clientY);
    updateSectorResize(event.clientX, event.clientY);
  };
  const finishSectorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (resize.frame !== null) cancelAnimationFrame(resize.frame);
    if (event.type === "pointerup") resize.pending = { x: event.clientX, y: event.clientY };
    applySectorResize();
    resizeRef.current = null;
    stopGestureScroll();
    setResizingSectorId(null);
    settleSectorGesture();
    if (resize.moved) {
      const targetWidth = (resize.latest.find((sector) => sector.id === resize.id)?.layout?.width || resize.layout.width) * resize.boardWidth;
      const nextHeight = Math.max(300, ...resize.latest.map((sector) => (sector.layout?.y || 0) + (sector.layout?.height || 0) + 16));
      setSectors(resize.latest);
      setTableColumns((current) => ({ ...current, [resize.id]: sectorGridColumns(resize.metrics, targetWidth) }));
      setBoardHeight(nextHeight);
      boardRef.current?.style.setProperty("--floor-board-height", `${nextHeight}px`);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const resizeSectorWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, sector: Sector) => {
    if (!sector.layout || !boardRef.current) return;
    const deltaWidth = event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0;
    const deltaHeight = event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0;
    if (!deltaWidth && !deltaHeight) return;
    event.preventDefault();
    const boardWidth = boardRef.current.clientWidth;
    setSectors((current) => {
      const item = current.find((candidate) => candidate.id === sector.id);
      if (!item?.layout) return current;
      const width = Math.max(220, Math.min(boardWidth, item.layout.width * boardWidth + deltaWidth));
      const metrics = sectorResizeMetrics(sector.id);
      return resizeSectorAndPush(current, sector.id, {
        x: item.layout.x * boardWidth, y: item.layout.y, width,
        height: Math.max(FREEFORM_MIN_HEIGHT, Math.min(MAX_SECTOR_HEIGHT, item.layout.height + deltaHeight)),
      }, boardWidth, metrics ? minimumSectorHeight(metrics, Math.min(width, item.layout.width * boardWidth)) : FREEFORM_MIN_HEIGHT);
    });
  };
  const slotAtPointer = (area: Area, clientX: number, clientY: number) => {
    const sector = Array.from(boardRef.current?.querySelectorAll<HTMLElement>(".floor-sector") || [])
      .find((element) => element.dataset.sectorId === area);
    const list = sector?.querySelector<HTMLElement>(".floor-sector-tables");
    if (!list) return 0;
    const rect = list.getBoundingClientRect();
    const { size, gap, columns } = tableGridMetrics(list.clientWidth, area === "counter");
    const rowHeight = area === "counter" ? (window.innerWidth <= 760 ? 42 : 46) : (window.innerWidth <= 760 ? 52 : 56);
    const column = Math.max(0, Math.min(columns - 1, Math.floor((clientX - rect.left - 4 + gap / 2) / (size + gap))));
    const row = Math.max(0, Math.floor((clientY - rect.top - 4 + gap / 2) / (rowHeight + gap)));
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
        if (table.id === id) {
          if (moving.area === area) return { ...table, area, slot };
          const used = new Set(normalized.filter((candidate) => candidate.area === area).map((candidate) => Number(candidate.name.match(/\d+/)?.[0])));
          let number = 1;
          while (used.has(number)) number++;
          return { ...table, name: `Mesa ${number}`, area, slot };
        }
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
  return { draggedTableId, setDraggedTableId, dropTarget, setDropTarget, suppressTableClickRef,
    draggingSectorId, resizingSectorId, sectorGestureSettling, resizeRef, suppressSectorClick,
    startSectorDrag, moveSectorDrag, finishSectorDrag, moveSectorWithKeyboard,
    startSectorResize, moveSectorResize, finishSectorResize, resizeSectorWithKeyboard,
    slotAtPointer, moveTableTo, startTableTouch, moveTableTouch, finishTableTouch };
}
