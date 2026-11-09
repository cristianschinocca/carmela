import { useState, type Dispatch, type SetStateAction } from "react";
import { FREEFORM_MIN_HEIGHT, SECTOR_TABLE_LIMIT, materializeTableSlots, tablePosition, type Area, type Sector, type Table } from "./floorModel";

type Props = {
  tables: Table[]; setTables: Dispatch<SetStateAction<Table[]>>; sectors: Sector[]; setSectors: Dispatch<SetStateAction<Sector[]>>;
  selected: Table | null; setSelectedId: Dispatch<SetStateAction<string | null>>; activeArea: Area;
  setActiveArea: Dispatch<SetStateAction<Area>>; setLayoutMode: Dispatch<SetStateAction<boolean>>;
  areaCounts: Record<string, number>; isFreeform: boolean; boardHeight: number; onToast: (message: string) => void;
};

/** Creación, orden y eliminación de mesas y sectores del plano. */
export function useFloorEditor({ tables, setTables, sectors, setSectors, selected, setSelectedId, activeArea, setActiveArea, setLayoutMode, areaCounts, isFreeform, boardHeight, onToast }: Props) {
  const [sectorName, setSectorName] = useState("");
  const [addingSector, setAddingSector] = useState(false);
  const [addingTables, setAddingTables] = useState(false);
  const [addArea, setAddArea] = useState<Area>("salon");
  const [addCount, setAddCount] = useState(1);
  const [selectingTables, setSelectingTables] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [confirmDeleteTables, setConfirmDeleteTables] = useState(false);
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
      const usedNames = new Set(normalized.filter((table) => table.area === addArea).map((table) => Number(table.name.match(/\d+/)?.[0])).filter(Boolean));
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
      const combined = [...normalized, ...additions];
      const ordered = combined.filter((table) => table.area === addArea).sort((a, b) => Number(a.name.match(/\d+/)?.[0] || 0) - Number(b.name.match(/\d+/)?.[0] || 0));
      const positions = new Map(ordered.map((table, index) => [table.id, index]));
      return combined.map((table) => positions.has(table.id) ? { ...table, slot: positions.get(table.id) } : table);
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
    const usedNumbers = new Set(tables.filter((table) => table.area === area).map((table) => Number(table.name.match(/\d+/)?.[0])));
    let number = 1;
    while (usedNumbers.has(number)) number++;
    setTables((current) => materializeTableSlots(current).map((table) => table.id === selected.id
      ? { ...table, name: `Mesa ${number}`, area, slot, ...tablePosition(targetCount, area) } : table));
    setActiveArea(area);
    onToast(`${selected.name} se movió a ${target.label}.`);
  };
  const createSector = () => {
    const label = sectorName.trim();
    if (!label) return;
    const id = `sector-${Date.now()}`;
    setSectors((current) => [...current, { id, label, description: "Sector personalizado", limit: SECTOR_TABLE_LIMIT, columns: 9, start: 1, minHeight: 186,
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
  return { sectorName, setSectorName, addingSector, setAddingSector, addingTables, setAddingTables,
    addArea, setAddArea, addCount, setAddCount, selectingTables, setSelectingTables,
    selectedTableIds, setSelectedTableIds, confirmDeleteTables, setConfirmDeleteTables, occupiedSelection,
    openAddTables, createTables, deleteSelectedTables, arrangeTables, moveSelectedArea, createSector, deleteSector };
}
