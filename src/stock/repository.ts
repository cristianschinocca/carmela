import { emptyStockCatalog, type StockCatalog } from "./types";

export interface StockCatalogRepository {
  load(): Promise<StockCatalog>;
  save(catalog: StockCatalog): Promise<void>;
}

export const STOCK_CATALOG_STORAGE = "carmela.stock.catalog.v1";
export const STOCK_CATALOG_CHANGED = "carmela:stock-catalog-changed";

export function readStockCatalog(): StockCatalog {
  const raw = localStorage.getItem(STOCK_CATALOG_STORAGE);
  if (!raw) return emptyStockCatalog();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Datos de stock inválidos");
  const catalog = data as StockCatalog;
  if (!Array.isArray(catalog.ingredients) || !Array.isArray(catalog.suppliers) || !Array.isArray(catalog.recipes)) {
    throw new Error("Datos de stock incompletos");
  }
  return catalog;
}

// The repository is the only part of this module that knows about browser storage.
export const localStockCatalogRepository: StockCatalogRepository = {
  async load() {
    return readStockCatalog();
  },
  async save(catalog) { localStorage.setItem(STOCK_CATALOG_STORAGE, JSON.stringify(catalog)); window.dispatchEvent(new Event(STOCK_CATALOG_CHANGED)); },
};
