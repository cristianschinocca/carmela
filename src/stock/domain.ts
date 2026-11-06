import type { StockCatalog } from "./types";

export const formatQuantity = (quantity: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(quantity);
export const validQuantity = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
export const isLowStock = (quantity: number, minimum: number) => quantity <= minimum;
export const ingredientInUse = (catalog: StockCatalog, id: string) => catalog.recipes.some((recipe) => recipe.ingredients.some((line) => line.ingredientId === id));
export const supplierInUse = (catalog: StockCatalog, id: string) => catalog.ingredients.some((ingredient) => ingredient.supplierIds.includes(id));
