import type { Product } from "../data";
import type { SaleRecord } from "./sales";

export const INVENTORY_STORAGE = "carmela.inventory.v1";
export const INVENTORY_MOVEMENTS_STORAGE = "carmela.inventory.movements.v1";

export type StockItem = { quantity: number; minimum: number; enabled: boolean };
export type Stock = Record<number, StockItem>;
export type StockMovement = {
  id: string;
  productId: number;
  productName: string;
  at: string;
  type: "entrada" | "salida" | "ajuste" | "venta";
  change: number;
  balance: number;
  note: string;
  saleId?: string;
};

export function loadStock(): Stock {
  try {
    const value = JSON.parse(localStorage.getItem(INVENTORY_STORAGE) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function loadStockMovements(): StockMovement[] {
  try {
    const value = JSON.parse(localStorage.getItem(INVENTORY_MOVEMENTS_STORAGE) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function saveStockChange(product: Product, current: Stock, type: "entrada" | "salida" | "ajuste", amount: number, minimum: number, note: string) {
  const previous = current[product.id]?.quantity ?? 0;
  const quantity = type === "entrada" ? previous + amount : type === "salida" ? previous - amount : amount;
  if (!Number.isSafeInteger(quantity) || quantity < 0) return null;
  const next = { ...current, [product.id]: { quantity, minimum, enabled: true } };
  const movement: StockMovement = {
    id: crypto.randomUUID(), productId: product.id, productName: product.name,
    at: new Date().toISOString(), type, change: quantity - previous, balance: quantity,
    note: note.trim() || (type === "ajuste" ? "Conteo manual" : type === "entrada" ? "Reposición" : "Salida manual"),
  };
  localStorage.setItem(INVENTORY_STORAGE, JSON.stringify(next));
  localStorage.setItem(INVENTORY_MOVEMENTS_STORAGE, JSON.stringify([movement, ...loadStockMovements()]));
  return next;
}

export function setStockEnabled(product: Product, current: Stock, enabled: boolean) {
  const next = { ...current, [product.id]: { quantity: current[product.id]?.quantity ?? 0, minimum: current[product.id]?.minimum ?? 0, enabled } };
  localStorage.setItem(INVENTORY_STORAGE, JSON.stringify(next));
  return next;
}

export type StockCountInput = { productId: number; quantity: number; minimum: number };

export function saveStockCountBatch(products: Product[], current: Stock, entries: StockCountInput[]) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const ids = new Set<number>();
  for (const entry of entries) {
    if (!productById.has(entry.productId) || ids.has(entry.productId) ||
      !Number.isSafeInteger(entry.quantity) || entry.quantity < 0 ||
      !Number.isSafeInteger(entry.minimum) || entry.minimum < 0) return null;
    ids.add(entry.productId);
  }
  const next = { ...current };
  const at = new Date().toISOString();
  const movements: StockMovement[] = [];
  for (const entry of entries) {
    const previous = current[entry.productId];
    if (previous?.enabled && previous.quantity === entry.quantity && previous.minimum === entry.minimum) continue;
    const product = productById.get(entry.productId)!;
    next[entry.productId] = { quantity: entry.quantity, minimum: entry.minimum, enabled: true };
    movements.push({
      id: crypto.randomUUID(), productId: entry.productId, productName: product.name,
      at, type: "ajuste", change: entry.quantity - (previous?.quantity ?? 0),
      balance: entry.quantity,
      note: previous?.enabled && previous.quantity === entry.quantity ? "Mínimo actualizado en carga rápida" : "Conteo en carga rápida",
    });
  }
  if (movements.length) {
    localStorage.setItem(INVENTORY_STORAGE, JSON.stringify(next));
    localStorage.setItem(INVENTORY_MOVEMENTS_STORAGE, JSON.stringify([...movements, ...loadStockMovements()]));
  }
  return { stock: next, changed: movements.length };
}

export function applySaleToStock(sale: SaleRecord, products: Product[]) {
  const stock = loadStock();
  const movements = loadStockMovements();
  if (movements.some((movement) => movement.saleId === sale.id)) return stock;
  const next = { ...stock };
  const added: StockMovement[] = [];
  for (const line of sale.items) {
    const item = next[line.productId];
    if (!item?.enabled || !products.some((product) => product.id === line.productId)) continue;
    const balance = item.quantity - line.quantity;
    next[line.productId] = { ...item, quantity: balance };
    added.push({ id: crypto.randomUUID(), productId: line.productId, productName: line.name,
      at: sale.closedAt, type: "venta", change: -line.quantity, balance,
      note: sale.tableName, saleId: sale.id });
  }
  if (added.length) {
    localStorage.setItem(INVENTORY_STORAGE, JSON.stringify(next));
    localStorage.setItem(INVENTORY_MOVEMENTS_STORAGE, JSON.stringify([...added, ...movements]));
  }
  return next;
}

export function productsWithStock(products: Product[], stock: Stock): Product[] {
  return products.map((product) => ({
    ...product,
    available: product.available && (!stock[product.id]?.enabled || stock[product.id].quantity > 0),
  }));
}
