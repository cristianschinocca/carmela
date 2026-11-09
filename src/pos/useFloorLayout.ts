import { useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { FREEFORM_MIN_HEIGHT, SECTOR_GAP, tableGridMetrics, makeDefaultMosaic, sectorRect, sectorsTouch, type Area, type Sector, type SectorRect, type Table } from "./floorModel";

type Props = {
  boardRef: RefObject<HTMLDivElement | null>; sectorsRef: RefObject<Sector[]>; resizeRef: RefObject<unknown>;
  sectors: Sector[]; setSectors: Dispatch<SetStateAction<Sector[]>>; tables: Table[]; tableColumns: Record<Area, number>;
  setTableColumns: Dispatch<SetStateAction<Record<Area, number>>>; setBoardHeight: Dispatch<SetStateAction<number>>;
  layoutMode: boolean; isFreeform: boolean; draggingSectorId: string | null; resizingSectorId: string | null;
};

/** Ajuste del tablero al contenido y al espacio disponible. */
export function useFloorLayout({ boardRef, sectorsRef, resizeRef, sectors, setSectors, tables, tableColumns, setTableColumns, setBoardHeight, layoutMode, isFreeform, draggingSectorId, resizingSectorId }: Props) {
  const normalizedLayoutRef = useRef(false);
  const autoFitWidthRef = useRef<number | null>(null);
  const reconcileBoard = () => {
    if (resizeRef.current) return;
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
  useLayoutEffect(() => { reconcileBoard(); }, [sectors, layoutMode, tables, tableColumns, resizingSectorId]);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(reconcileBoard);
    observer.observe(board);
    board.querySelectorAll<HTMLElement>(".floor-sector").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectors.length, isFreeform]);
  return { normalizedLayoutRef, autoFitWidthRef };
}
