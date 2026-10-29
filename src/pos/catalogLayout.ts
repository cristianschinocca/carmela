import type { CSSProperties } from "react";

export const catalogPalette = [
  { id: "rosa", label: "Rosa", value: "#d63e82" },
  { id: "rojo", label: "Rojo", value: "#dc5b63" },
  { id: "naranja", label: "Naranja", value: "#da8a40" },
  { id: "amarillo", label: "Amarillo", value: "#c6a032" },
  { id: "verde", label: "Verde", value: "#4ea576" },
  { id: "celeste", label: "Celeste", value: "#38a5c8" },
  { id: "azul", label: "Azul", value: "#678bd0" },
  { id: "violeta", label: "Violeta", value: "#a979cc" },
] as const;

export type CatalogColors = { categories: Record<string, string>; products: Record<string, string> };

export const catalogColorStyle = (color?: string): CSSProperties | undefined => {
  const value = color && /^#[0-9a-f]{6}$/i.test(color) ? color : catalogPalette.find((item) => item.id === color)?.value;
  if (!value) return undefined;
  const muted = [1, 3, 5].map((index) => Math.round(parseInt(value.slice(index, index + 2), 16) * 0.72 + 117 * 0.28));
  const channels = muted.map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return { "--catalog-color": `rgb(${muted.join(", ")})`, "--catalog-ink": luminance > 0.179 ? "#000000" : "#ffffff" } as CSSProperties;
};

export const PRODUCT_CARD_SIZE = 84;
export const PRODUCT_GAP = 8;
export const PRODUCT_CELL = PRODUCT_CARD_SIZE + PRODUCT_GAP;

export const catalogGridPosition = (index: number, columns: number) => ({
  x: (index % columns) * PRODUCT_CELL,
  y: Math.floor(index / columns) * PRODUCT_CELL,
});

export const catalogCellFromCoordinates = (x: number, y: number, columns: number, rows: number) => ({
  column: Math.max(0, Math.min(columns - 1, Math.round(x / PRODUCT_CELL))),
  row: Math.max(0, Math.min(rows - 1, Math.round(y / PRODUCT_CELL))),
});

export const catalogDefaultCells = (count: number, columns: number, rows: number) => {
  const usedColumns = Math.min(columns, Math.max(1, Math.ceil(count / rows), Math.ceil(Math.sqrt(count * columns / rows))));
  return Array.from({ length: count }, (_, index) => ({
    column: index % usedColumns,
    row: Math.floor(index / usedColumns),
  }));
};

export const catalogClosestFreeCell = (target: { column: number; row: number }, occupied: Set<number>, columns: number, rows: number) => {
  let best = -1;
  let distance = Infinity;
  for (let index = 0; index < columns * rows; index++) {
    if (occupied.has(index)) continue;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const nextDistance = (column - target.column) ** 2 + (row - target.row) ** 2;
    if (nextDistance < distance) { best = index; distance = nextDistance; }
  }
  return best;
};
