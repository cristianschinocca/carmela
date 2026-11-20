import type { tenantDatabase } from "@mistro/db/tenant";

type Db = ReturnType<typeof tenantDatabase>;
/** La caja y las existencias proceden de la misma lectura consistente de la cafetería. */
export async function readOfflineInventory(db: Db) {
  return db.$transaction(async (tx) => {
    const shift = await tx.cashShift.findFirst({ where: { closedAt: null }, select: { id: true, version: true, openingAmount: true } });
    const movements = shift ? await tx.cashMovement.findMany({ where: { shiftId: shift.id, payment: "Efectivo", voidedAt: null }, select: { amount: true, direction: true } }) : [];
    const sales = shift ? await tx.sale.aggregate({ where: { cashShiftId: shift.id, payment: "Efectivo" }, _sum: { total: true } }) : null;
    const productStock = await tx.productStock.findMany({ select: { productId: true, quantity: true, enabled: true, version: true } });
    const ingredients = await tx.inventoryIngredient.findMany({ select: { id: true, name: true, quantity: true, unit: true, version: true } });
    const recipes = await tx.inventoryRecipe.findMany({ select: { id: true, productId: true, version: true, ingredients: { select: { ingredientId: true, quantity: true, unit: true } } } });
    const cash = shift ? { id: shift.id, version: shift.version, expectedAmount: movements.reduce((sum, item) => sum + (item.direction === "in" ? item.amount : -item.amount), shift.openingAmount + (sales?._sum.total ?? 0n)).toString() } : null;
    return { cash, productStock, ingredients: ingredients.map((item) => ({ ...item, quantity: item.quantity.toString() })), recipes: recipes.map((recipe) => ({ ...recipe, ingredients: recipe.ingredients.map((line) => ({ ...line, quantity: line.quantity.toString() })) })) };
  }, { isolationLevel: "RepeatableRead" });
}
