import { Router } from "express";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { parseSettlement, settleTable, SettlementError } from "./settlement.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
export const posRoutes = Router({ mergeParams: true });
posRoutes.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && !isTrustedAdminOrigin(req.get("origin"), config.frontendOrigin, process.env.NODE_ENV === "development")) return res.sendStatus(403);
    const session = await auth.api.getSession({ headers: new Headers({ cookie: req.headers.cookie ?? "" }) });
    if (!session || session.user.banned) return res.sendStatus(401);
    if (typeof req.params.workspaceId !== "string") return res.sendStatus(404);
    const access = await tenantAccess(session.user.id, req.params.workspaceId);
    if (!access) return res.sendStatus(404);
    if (req.method !== "GET" && access.role !== "owner") return res.sendStatus(403);
    res.locals.posDb = access.db;
    res.set("Cache-Control", "no-store");
    return next();
  } catch (error) { return next(error); }
});
posRoutes.get("/tables", async (_req, res, next) => {
  try {
    const db = res.locals.posDb as Db;
    return res.json(await db.floorSector.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], include: { tables: { orderBy: { number: "asc" }, include: { items: true } } } }));
  } catch (error) { return next(error); }
});
posRoutes.post("/settlements", async (req, res, next) => {
  const input = parseSettlement(req.body);
  if (!input) return res.status(400).json({ error: "Datos de cobro inválidos." });
  try {
    const result = await settleTable(res.locals.posDb as Db, input);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof SettlementError) return res.status(error.reason === "missing" ? 404 : 409).json({ error: error.message });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return res.status(409).json({ error: "La cuenta o el stock cambiaron. Actualizá y volvé a intentar." });
    return next(error);
  }
});
