import { Router } from "express";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { validId } from "../catalog/validation.js";
import { parseIngredient, parseRecipe, compatibleUnits } from "./recipes.js";
const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 2147483647;
const isConstraintError = (error: unknown) => !!error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2003");
import { applyProductStockChange, parseStockChange, StockConflict } from "./productStock.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
export const inventoryRoutes = Router({ mergeParams: true });
inventoryRoutes.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && !isTrustedAdminOrigin(req.get("origin"), config.frontendOrigin, process.env.NODE_ENV === "development")) return res.sendStatus(403);
    const session = await auth.api.getSession({ headers: new Headers({ cookie: req.headers.cookie ?? "" }) });
    if (!session || session.user.banned) return res.sendStatus(401);
    const workspaceId = req.params.workspaceId;
    if (typeof workspaceId !== "string") return res.sendStatus(404);
    const access = await tenantAccess(session.user.id, workspaceId);
    if (!access) return res.sendStatus(404);
    if (req.method !== "GET" && access.role !== "owner") return res.sendStatus(403);
    res.locals.inventoryDb = access.db;
    res.set("Cache-Control", "no-store");
    return next();
  } catch (error) { return next(error); }
});
inventoryRoutes.get("/products", async (req, res, next) => {
  try {
    const raw = req.query.offset ?? "0";
    if (typeof raw !== "string" || !/^\d{1,7}$/.test(raw)) return res.status(400).json({ error: "Paginación inválida." });
    const db = res.locals.inventoryDb as Db;
    const products = await db.catalogProduct.findMany({
      orderBy: [{ position: "asc" }, { id: "asc" }], skip: Number(raw), take: 101,
      select: { id: true, legacyId: true, stock: true },
    });
    return res.json({
      items: products.slice(0, 100).map(({ id, legacyId, stock }) => ({ productId: id, legacyId: Number(legacyId), stock })),
      nextOffset: products.length > 100 ? Number(raw) + 100 : null,
    });
  } catch (error) { return next(error); }
});
inventoryRoutes.get("/products/:productId", async (req, res, next) => {
  try {
    if (!validId(req.params.productId)) return res.sendStatus(400);
    const db = res.locals.inventoryDb as Db;
    const product = await db.catalogProduct.findUnique({ where: { id: req.params.productId }, select: { stock: true } });
    if (!product) return res.sendStatus(404);
    return res.json(product.stock ?? { productId: req.params.productId, quantity: 0, minimum: 0, enabled: false, version: 0 });
  } catch (error) { return next(error); }
});
inventoryRoutes.post("/movements", async (req, res, next) => {
  try {
    const input = parseStockChange(req.body);
    if (!input) return res.status(400).json({ error: "Movimiento de stock inválido." });
    const result = await applyProductStockChange(res.locals.inventoryDb as Db, input);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof StockConflict) {
      if (error.reason === "missing") return res.status(404).json({ error: "Producto no encontrado." });
      const message = error.reason === "version" ? "El stock cambió; actualizá antes de continuar." : error.reason === "negative" ? "La cantidad resultante no es válida." : "La operación ya se utilizó con otros datos.";
      return res.status(409).json({ error: message });
    }
    return next(error);
  }
});

inventoryRoutes.get("/ingredients", async (_req, res, next) => {
  try { return res.json(await (res.locals.inventoryDb as Db).inventoryIngredient.findMany({ orderBy: { name: "asc" } })); }
  catch (error) { return next(error); }
});
inventoryRoutes.post("/ingredients", async (req, res, next) => {
  const input = parseIngredient(req.body);
  if (!input) return res.status(400).json({ error: "Insumo inválido." });
  try { return res.status(201).json(await (res.locals.inventoryDb as Db).inventoryIngredient.create({ data: input })); }
  catch (error) { if (isConstraintError(error)) return res.status(409).json({ error: "Ya existe un insumo con ese nombre." }); return next(error); }
});
inventoryRoutes.put("/ingredients/:id", async (req, res, next) => {
  const input = parseIngredient(req.body);
  if (!validId(req.params.id) || !input || !validVersion(req.body?.version)) return res.status(400).json({ error: "Insumo inválido." });
  try {
    const db = res.locals.inventoryDb as Db;
    const result = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{unit: string; version: number}>>`SELECT unit, version FROM inventory_ingredients WHERE id = ${req.params.id}::uuid FOR UPDATE`;
      if (!locked.length) return "missing";
      if (locked[0].version !== req.body.version) return "conflict";
      if (locked[0].unit !== input.unit && await tx.inventoryRecipeLine.count({ where: { ingredientId: req.params.id } })) return "used";
      await tx.inventoryIngredient.update({ where: { id: req.params.id }, data: { ...input, version: { increment: 1 } } });
      return "ok";
    });
    if (result === "missing") return res.sendStatus(404);
    if (result === "conflict") return res.status(409).json({ error: "El insumo cambió; actualizá antes de guardar." });
    if (result === "used") return res.status(409).json({ error: "No podés cambiar la unidad de un insumo vinculado a una receta." });
    return res.sendStatus(204);
  } catch (error) { if (isConstraintError(error)) return res.status(409).json({ error: "Ya existe un insumo con ese nombre." }); return next(error); }
});
inventoryRoutes.delete("/ingredients/:id", async (req, res, next) => {
  if (!validId(req.params.id) || !validVersion(req.body?.version)) return res.sendStatus(400);
  try {
    const result = await (res.locals.inventoryDb as Db).inventoryIngredient.deleteMany({ where: { id: req.params.id, version: req.body.version } });
    return res.sendStatus(result.count ? 204 : 409);
  } catch (error) { if (isConstraintError(error)) return res.status(409).json({ error: "El insumo está vinculado a una receta." }); return next(error); }
});
inventoryRoutes.get("/recipes", async (_req, res, next) => {
  try { return res.json(await (res.locals.inventoryDb as Db).inventoryRecipe.findMany({ include: { ingredients: true }, orderBy: { name: "asc" } })); }
  catch (error) { return next(error); }
});
inventoryRoutes.post("/recipes", async (req, res, next) => {
  const input = parseRecipe(req.body);
  if (!input) return res.status(400).json({ error: "Receta inválida." });
  try {
    const db = res.locals.inventoryDb as Db;
    const result = await db.$transaction(async (tx) => {
      for (const line of [...input.ingredients].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
        const ingredients = await tx.$queryRaw<Array<{unit: "unidad" | "kg" | "g" | "l" | "ml"}>>`SELECT unit FROM inventory_ingredients WHERE id = ${line.ingredientId}::uuid FOR UPDATE`;
        if (!ingredients.length || !compatibleUnits(ingredients[0].unit, line.unit)) return null;
      }
      if (!await tx.catalogProduct.findUnique({ where: { id: input.productId }, select: { id: true } })) return null;
      return tx.inventoryRecipe.create({ data: { name: input.name, productId: input.productId, ingredients: { create: input.ingredients } }, include: { ingredients: true } });
    });
    if (!result) return res.status(400).json({ error: "Producto, insumo o unidad inválidos." });
    return res.status(201).json(result);
  } catch (error) { if (isConstraintError(error)) return res.status(409).json({ error: "El producto ya tiene una receta o cambió durante la operación." }); return next(error); }
});
inventoryRoutes.delete("/recipes/:id", async (req, res, next) => {
  if (!validId(req.params.id) || !validVersion(req.body?.version)) return res.sendStatus(400);
  try {
    const result = await (res.locals.inventoryDb as Db).inventoryRecipe.deleteMany({ where: { id: req.params.id, version: req.body.version } });
    return res.sendStatus(result.count ? 204 : 409);
  } catch (error) { return next(error); }
});
inventoryRoutes.put("/recipes/:id", async (req, res, next) => {
  const input = parseRecipe(req.body);
  if (!validId(req.params.id) || !input || !validVersion(req.body?.version)) return res.status(400).json({ error: "Receta inválida." });
  try {
    const db = res.locals.inventoryDb as Db;
    const result = await db.$transaction(async (tx) => {
      const recipes = await tx.$queryRaw<Array<{id: string; version: number}>>`SELECT id, version FROM inventory_recipes WHERE id = ${req.params.id}::uuid FOR UPDATE`;
      if (!recipes.length) return "missing";
      if (recipes[0].version !== req.body.version) return "conflict";
      for (const line of [...input.ingredients].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
        const ingredients = await tx.$queryRaw<Array<{unit: "unidad" | "kg" | "g" | "l" | "ml"}>>`SELECT unit FROM inventory_ingredients WHERE id = ${line.ingredientId}::uuid FOR UPDATE`;
        if (!ingredients.length || !compatibleUnits(ingredients[0].unit, line.unit)) return "invalid";
      }
      if (!await tx.catalogProduct.findUnique({ where: { id: input.productId }, select: { id: true } })) return "invalid";
      await tx.inventoryRecipeLine.deleteMany({ where: { recipeId: req.params.id } });
      await tx.inventoryRecipe.update({ where: { id: req.params.id }, data: { name: input.name, productId: input.productId, version: { increment: 1 }, ingredients: { create: input.ingredients } } });
      return "ok";
    });
    if (result === "missing") return res.sendStatus(404);
    if (result === "conflict") return res.status(409).json({ error: "La receta cambió; actualizá antes de guardar." });
    if (result === "invalid") return res.status(400).json({ error: "Producto, insumo o unidad inválidos." });
    return res.sendStatus(204);
  } catch (error) { if (isConstraintError(error)) return res.status(409).json({ error: "El producto ya tiene una receta o cambió durante la operación." }); return next(error); }
});
