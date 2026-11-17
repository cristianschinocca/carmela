import { Router, type Response, type NextFunction } from "express";
import { createHash } from "node:crypto";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { categoryInput, importInput, productInput, validId } from "./validation.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
const dbFor = (response: Response) => response.locals.catalogDb as Db;
const productResponse = <T extends { legacyId: bigint }>(product: T) => ({ ...product, legacyId: Number(product.legacyId) });

type Dependencies = {
  getSession: (cookie: string | undefined) => Promise<{ user: { id: string; banned?: boolean | null } } | null>;
  getAccess: typeof tenantAccess;
  allowedOrigin: (origin: string | undefined) => boolean;
};

export function createCatalogRoutes(deps: Dependencies) {
const catalogRoutes = Router({ mergeParams: true });

catalogRoutes.use(async (request, response, next) => {
  try {
    const write = !["GET", "HEAD"].includes(request.method);
    if (write && !deps.allowedOrigin(request.get("origin"))) return response.sendStatus(403);
    const session = await deps.getSession(request.headers.cookie);
    if (!session || session.user.banned) return response.sendStatus(401);
    const workspaceId = request.params.workspaceId;
    if (typeof workspaceId !== "string") return response.sendStatus(404);
    const access = await deps.getAccess(session.user.id, workspaceId);
    if (!access) return response.sendStatus(404);
    if (write && access.role !== "owner") return response.sendStatus(403);
    response.locals.catalogDb = access.db;
    response.set("Cache-Control", "no-store");
    return next();
  } catch (error) { return next(error); }
});

catalogRoutes.get("/categories", async (_req, res, next) => {
  try { return res.json(await dbFor(res).catalogCategory.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] })); }
  catch (error) { return next(error); }
});

catalogRoutes.get("/products", async (req, res, next) => {
  try {
    const raw = req.query.offset ?? "0";
    if (typeof raw !== "string" || !/^\d{1,7}$/.test(raw)) return res.status(400).json({ error: "Paginación inválida." });
    const products = await dbFor(res).catalogProduct.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], skip: Number(raw), take: 101 });
    return res.json({ items: products.slice(0, 100).map(productResponse), nextOffset: products.length > 100 ? Number(raw) + 100 : null });
  } catch (error) { return next(error); }
});

function databaseError(error: unknown, res: Response, next: NextFunction) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "P2002") return res.status(409).json({ error: "Ya existe un registro con ese nombre." });
  if (code === "P2003") return res.status(409).json({ error: "La categoría no existe o está en uso." });
  if (code === "P2025") return res.status(404).json({ error: "No se encontró el registro." });
  if (code === "P2034") return res.status(409).json({ error: "El catálogo cambió. Actualizá la página y volvé a intentar." });
  return next(error);
}

catalogRoutes.put("/order/:kind", async (req, res, next) => {
  const { kind } = req.params;
  const ids: unknown = req.body?.ids;
  if ((kind !== "products" && kind !== "categories") || !Array.isArray(ids) || ids.length > 1000 ||
      !ids.every(validId) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "El orden solicitado no es válido." });
  }
  try {
    const updated = await dbFor(res).$transaction(async (tx) => {
      const table = kind === "products" ? "catalog_products" : "catalog_categories";
      // El nombre de la tabla está limitado a las dos opciones anteriores.
      await tx.$executeRawUnsafe(`LOCK TABLE "${table}" IN SHARE ROW EXCLUSIVE MODE`);
      const rows = kind === "products" ? await tx.catalogProduct.findMany({ select: { id: true } }) : await tx.catalogCategory.findMany({ select: { id: true } });
      const present = new Set(rows.map((row) => row.id));
      if (rows.length !== ids.length || ids.some((id: string) => !present.has(id))) return false;
      for (const [position, id] of ids.entries()) {
        if (kind === "products") await tx.catalogProduct.update({ where: { id }, data: { position } });
        else await tx.catalogCategory.update({ where: { id }, data: { position } });
      }
      return true;
    }, { timeout: 30000 });
    return updated ? res.sendStatus(204) : res.status(409).json({ error: "El catálogo cambió. Actualizá la página y volvé a intentar." });
  } catch (error) { return databaseError(error, res, next); }
});

catalogRoutes.post("/import", async (req, res, next) => {
  const key = req.get("idempotency-key");
  const input = importInput(req.body);
  if (!validId(key) || !input) return res.status(400).json({ error: "Los datos o la clave de importación no son válidos." });
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  try {
    const result = await dbFor(res).$transaction(async (tx) => {
      // Serializa las importaciones y también impide escrituras simultáneas del catálogo.
      await tx.$executeRawUnsafe('LOCK TABLE "catalog_categories", "catalog_products", "catalog_imports" IN SHARE ROW EXCLUSIVE MODE');
      const previous = await tx.catalogImport.findUnique({ where: { key } });
      if (previous) return previous.payloadHash === hash ? "replayed" : "key-conflict";
      const [categories, products] = await Promise.all([tx.catalogCategory.count(), tx.catalogProduct.count()]);
      if (categories || products) return "not-empty";
      const categoryIds = new Map<string, string>();
      for (const category of input.categories) {
        const created = await tx.catalogCategory.create({ data: category });
        categoryIds.set(category.name, created.id);
      }
      for (const { legacyId, categoryName, categoryId: _unused, ...product } of input.products) {
        await tx.catalogProduct.create({ data: { ...product, categoryId: categoryIds.get(categoryName)!, legacyId: BigInt(legacyId) } });
      }
      await tx.catalogImport.create({ data: { key, payloadHash: hash } });
      return "created";
    }, { timeout: 30000 });
    if (result === "key-conflict") return res.status(409).json({ error: "La clave ya se utilizó con otros datos." });
    if (result === "not-empty") return res.status(409).json({ error: "El catálogo ya contiene datos. No se reemplazó." });
    return res.status(result === "created" ? 201 : 200).json({ imported: true });
  } catch (error) { return databaseError(error, res, next); }
});

catalogRoutes.post("/categories", async (req, res, next) => {
  try {
    const data = categoryInput(req.body);
    if (!data) return res.status(400).json({ error: "Datos de categoría inválidos." });
    return res.status(201).json(await dbFor(res).catalogCategory.create({ data }));
  } catch (error) { return databaseError(error, res, next); }
});
catalogRoutes.put("/categories/:id", async (req, res, next) => {
  try {
    const data = categoryInput(req.body);
    if (!validId(req.params.id) || !data) return res.status(400).json({ error: "Datos de categoría inválidos." });
    return res.json(await dbFor(res).catalogCategory.update({ where: { id: req.params.id }, data }));
  } catch (error) { return databaseError(error, res, next); }
});
catalogRoutes.delete("/categories/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.sendStatus(400);
    await dbFor(res).catalogCategory.delete({ where: { id: req.params.id } });
    return res.sendStatus(204);
  } catch (error) { return databaseError(error, res, next); }
});
catalogRoutes.post("/products", async (req, res, next) => {
  try {
    const data = productInput(req.body);
    if (!data) return res.status(400).json({ error: "Datos de producto inválidos." });
    return res.status(201).json(productResponse(await dbFor(res).catalogProduct.create({ data })));
  } catch (error) { return databaseError(error, res, next); }
});
catalogRoutes.put("/products/:id", async (req, res, next) => {
  try {
    const data = productInput(req.body);
    if (!validId(req.params.id) || !data) return res.status(400).json({ error: "Datos de producto inválidos." });
    return res.json(productResponse(await dbFor(res).catalogProduct.update({ where: { id: req.params.id }, data })));
  } catch (error) { return databaseError(error, res, next); }
});
catalogRoutes.delete("/products/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.sendStatus(400);
    await dbFor(res).catalogProduct.delete({ where: { id: req.params.id } });
    return res.sendStatus(204);
  } catch (error) { return databaseError(error, res, next); }
});
return catalogRoutes;
}

export const catalogRoutes = createCatalogRoutes({
  getSession: (cookie) => auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) }),
  getAccess: tenantAccess,
  allowedOrigin: (origin) => isTrustedAdminOrigin(origin, config.frontendOrigin, process.env.NODE_ENV === "development"),
});
