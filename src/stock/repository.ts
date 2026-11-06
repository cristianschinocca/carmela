import { emptyStockCatalog, type StockCatalog } from "./types";

export interface StockCatalogRepository {
  load(): Promise<StockCatalog>;
  save(catalog: StockCatalog): Promise<void>;
}

const key = "carmela.stock.catalog.v1";

// The repository is the only part of this module that knows about browser storage.
export const localStockCatalogRepository: StockCatalogRepository = {
  async load() {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyStockCatalog();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") throw new Error("Datos de stock inválidos");
    const catalog = data as StockCatalog;
    if (!Array.isArray(catalog.ingredients) || !Array.isArray(catalog.suppliers) || !Array.isArray(catalog.recipes)) {
      throw new Error("Datos de stock incompletos");
    }
    return catalog;
  },
  async save(catalog) { localStorage.setItem(key, JSON.stringify(catalog)); },
};
