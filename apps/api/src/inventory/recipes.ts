import { validId } from "../catalog/validation.js";
const units = ["unidad", "kg", "g", "l", "ml"] as const;
type Unit = typeof units[number];
const unit = (value: unknown): value is Unit => typeof value === "string" && (units as readonly string[]).includes(value);
const quantity = (value: unknown, positive = false): value is number => typeof value === "number" && Number.isFinite(value) && value <= 1_000_000_000 && (positive ? value >= 0.000001 : value >= 0) && Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) < 0.0001;
const name = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;
export const compatibleUnits = (a: Unit, b: Unit) => a === b || (["kg", "g"].includes(a) && ["kg", "g"].includes(b)) || (["l", "ml"].includes(a) && ["l", "ml"].includes(b));
export function parseIngredient(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  if (!name(v.name) || !unit(v.unit) || !quantity(v.quantity) || !quantity(v.minimum)) return null;
  return { name: v.name.trim(), unit: v.unit, quantity: v.quantity, minimum: v.minimum };
}
export function parseRecipe(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  if (!name(v.name) || !validId(v.productId) || !Array.isArray(v.ingredients) || !v.ingredients.length || v.ingredients.length > 100) return null;
  const lines: { ingredientId: string; quantity: number; unit: Unit }[] = [];
  for (const entry of v.ingredients) {
    if (!entry || typeof entry !== "object") return null;
    const line = entry as Record<string, unknown>;
    if (!validId(line.ingredientId) || !quantity(line.quantity, true) || !unit(line.unit) || lines.some((item) => item.ingredientId === line.ingredientId)) return null;
    lines.push({ ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit });
  }
  return { name: v.name.trim(), productId: v.productId, ingredients: lines };
}
