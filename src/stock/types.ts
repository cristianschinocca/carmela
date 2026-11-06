export const units = ["unidad", "kg", "g", "l", "ml"] as const;
export type Unit = typeof units[number];

export type Supplier = { id: string; name: string; contact: string; phone: string; email: string; notes: string };
export type Ingredient = { id: string; name: string; unit: Unit; quantity: number; minimum: number; supplierIds: string[] };
export type RecipeLine = { ingredientId: string; quantity: number };
export type Recipe = { id: string; name: string; productId: number; ingredients: RecipeLine[] };
export type StockCatalog = { ingredients: Ingredient[]; suppliers: Supplier[]; recipes: Recipe[] };

export const emptyStockCatalog = (): StockCatalog => ({ ingredients: [], suppliers: [], recipes: [] });
