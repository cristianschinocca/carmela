import type { Product } from "../data";
import { applySaleToStock, INVENTORY_MOVEMENTS_STORAGE, INVENTORY_STORAGE, loadStock } from "../stores/inventory";
import { loadSales, SALES_STORAGE, saveSale, type SaleRecord } from "../stores/sales";
import { applySaleToIngredients } from "./domain";
import { readStockCatalog, STOCK_CATALOG_CHANGED, STOCK_CATALOG_STORAGE } from "./repository";

/** Operación local de demostración; el backend deberá usar una transacción real. */
export function settleSaleLocally(sale: SaleRecord, products: Product[], floorKey: string, nextFloor: unknown) {
  if (loadSales().some((entry) => entry.id === sale.id)) return loadStock();
  const catalog = readStockCatalog();
  const updatedCatalog = applySaleToIngredients(catalog, sale);
  const keys = [SALES_STORAGE, INVENTORY_STORAGE, INVENTORY_MOVEMENTS_STORAGE, STOCK_CATALOG_STORAGE, floorKey];
  const previous = keys.map((key) => localStorage.getItem(key));
  try {
    saveSale(sale);
    const stock = applySaleToStock(sale, products);
    if (updatedCatalog !== catalog) {
      localStorage.setItem(STOCK_CATALOG_STORAGE, JSON.stringify(updatedCatalog));
      window.dispatchEvent(new Event(STOCK_CATALOG_CHANGED));
    }
    localStorage.setItem(floorKey, JSON.stringify(nextFloor));
    return stock;
  } catch (error) {
    keys.forEach((key, index) => {
      if (previous[index] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous[index]!);
    });
    throw error;
  }
}
