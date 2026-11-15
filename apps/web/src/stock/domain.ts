import type { StockCatalog, Unit } from "./types";
import type { SaleRecord } from "../stores/sales";

const unitGroups: Unit[][] = [["kg", "g"], ["l", "ml"], ["unidad"]];
const unitFactors: Record<Unit, number> = { kg: 1000, g: 1, l: 1000, ml: 1, unidad: 1 };

export function compatibleUnits(unit: Unit): Unit[] {
  return unitGroups.find((group) => group.includes(unit)) ?? [];
}

export function convertQuantity(quantity: number, from: Unit, to: Unit): number {
  if (!compatibleUnits(from).includes(to)) throw new Error("Unidades incompatibles");
  return quantity * unitFactors[from] / unitFactors[to];
}

export const formatQuantity = (quantity: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 }).format(quantity);
export const validQuantity = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
export const isLowStock = (quantity: number, minimum: number) => quantity <= minimum;
export const ingredientInUse = (catalog: StockCatalog, id: string) => catalog.recipes.some((recipe) => recipe.ingredients.some((line) => line.ingredientId === id));
export const supplierInUse = (catalog: StockCatalog, id: string) => catalog.ingredients.some((ingredient) => ingredient.supplierIds.includes(id));

export type RecipeCapacity = { kind: "available"; quantity: number } | { kind: "invalid" } | { kind: "none" };

/** Cantidad teórica de unidades completas según el insumo más limitante. */
export function recipeCapacity(catalog: StockCatalog, productId: number): RecipeCapacity {
  const recipe = catalog.recipes.find((item) => item.productId === productId);
  if (!recipe) return { kind: "none" };
  if (!recipe.ingredients.length) return { kind: "invalid" };
  const amounts = new Map<string, number>();
  let capacity = Infinity;
  for (const line of recipe.ingredients) {
    const ingredient = catalog.ingredients.find((item) => item.id === line.ingredientId);
    if (!ingredient || !Number.isFinite(ingredient.quantity) || !validQuantity(line.quantity) || line.quantity <= 0 || !compatibleUnits(ingredient.unit).includes(line.unit ?? ingredient.unit)) return { kind: "invalid" };
    const perUnit = convertQuantity(line.quantity, line.unit ?? ingredient.unit, ingredient.unit);
    if (!Number.isFinite(perUnit) || perUnit <= 0) return { kind: "invalid" };
    amounts.set(ingredient.id, (amounts.get(ingredient.id) ?? 0) + perUnit);
  }
  for (const [id, perUnit] of amounts) {
    const ingredient = catalog.ingredients.find((item) => item.id === id)!;
    const ratio = Math.max(0, ingredient.quantity) / perUnit;
    const rounded = Math.round(ratio);
    const whole = Math.abs(ratio - rounded) <= Number.EPSILON * Math.max(1, Math.abs(ratio)) * 4 ? rounded : Math.floor(ratio);
    capacity = Math.min(capacity, whole);
  }
  return { kind: "available", quantity: capacity };
}

/** Descuenta los insumos de una venta una sola vez, en la unidad de cada insumo. */
export function applySaleToIngredients(catalog: StockCatalog, sale: SaleRecord): StockCatalog {
  if (catalog.appliedSaleIds?.includes(sale.id)) return catalog;
  const quantities = new Map<string, number>();
  for (const item of sale.items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error("Cantidad de venta inválida");
    const recipe = catalog.recipes.find((entry) => entry.productId === item.productId);
    if (!recipe) continue;
    for (const line of recipe.ingredients) {
      const ingredient = catalog.ingredients.find((entry) => entry.id === line.ingredientId);
      if (!ingredient || !validQuantity(line.quantity) || line.quantity <= 0 || !Number.isFinite(ingredient.quantity)) throw new Error("Receta o insumo inválido");
      const amount = convertQuantity(line.quantity, line.unit ?? ingredient.unit, ingredient.unit) * item.quantity;
      quantities.set(ingredient.id, (quantities.get(ingredient.id) ?? 0) + amount);
    }
  }
  if (!quantities.size) return catalog;
  for (const ingredient of catalog.ingredients) {
    if ((quantities.get(ingredient.id) ?? 0) > ingredient.quantity + 1e-9)
      throw new Error(`Stock insuficiente: ${ingredient.name}.`);
  }
  return {
    ...catalog,
    ingredients: catalog.ingredients.map((ingredient) => quantities.has(ingredient.id)
      ? { ...ingredient, quantity: Math.round((ingredient.quantity - quantities.get(ingredient.id)!) * 1e9) / 1e9 }
      : ingredient),
    appliedSaleIds: [...(catalog.appliedSaleIds ?? []), sale.id],
  };
}
