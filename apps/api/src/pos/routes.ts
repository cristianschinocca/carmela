import { Router } from "express";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { parseFloor, readFloor, saveFloor, FloorConflict } from "./floorSync.js";
import { parseAccountBatch, saveAccountBatch } from "./accountBatch.js";
import { readAccounts } from "./accountsRead.js";
import { parseAccountChange, saveTableAccount, AccountError } from "./account.js";
import { parseSettlement, reconcileSettlement, settleTable, SettlementError } from "./settlement.js";
import { verifyEmployeeCode } from "../team/verify.js";
import { readOfflineInventory } from "./offlineSnapshot.js";
import { openCounter, parseCounterOpen, CounterError } from "./counter.js";
import { validId } from "../catalog/validation.js";
import { parseRecipeVersions, settleOfflineAccount } from "./offlineSettlement.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
type Dependencies = {
  getSession: (cookie: string | undefined) => Promise<{ user: { id: string; banned?: boolean | null } } | null>;
  getAccess: typeof tenantAccess;
  allowedOrigin: (origin: string | undefined) => boolean;
};
export function createPosRoutes(deps: Dependencies) {
const posRoutes = Router({ mergeParams: true });
posRoutes.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && !deps.allowedOrigin(req.get("origin"))) return res.sendStatus(403);
    const session = await deps.getSession(req.headers.cookie);
    if (!session || session.user.banned) return res.sendStatus(401);
    if (typeof req.params.workspaceId !== "string") return res.sendStatus(404);
    const access = await deps.getAccess(session.user.id, req.params.workspaceId);
    if (!access) return res.sendStatus(404);
    if (req.method !== "GET" && access.role !== "owner") return res.sendStatus(403);
    res.locals.posDb = access.db; res.locals.posRole = access.role; res.locals.posActor = session.user.id;
    res.set("Cache-Control", "no-store");
    return next();
  } catch (error) { return next(error); }
});
posRoutes.post("/counter", async (req, res, next) => {
  const input = parseCounterOpen(req.body);
  if (!input) return res.status(400).json({ error: "Indicá el responsable y su código de cuatro números." });
  try {
    const db = res.locals.posDb as Db;
    const employee = await db.employee.findUnique({ where: { id: input.operatorId }, select: { legacyId: true, active: true, deletedAt: true, pinHash: true } });
    if (!employee?.active || employee.deletedAt || !Number.isSafeInteger(Number(employee.legacyId))) return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const verified = await verifyEmployeeCode(db, res.locals.posActor as string, Number(employee.legacyId), input.employeePin);
    if (verified === "blocked") return res.status(429).json({ error: "Demasiados intentos. Esperá antes de reintentar." });
    if (verified !== "valid") return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const result = await openCounter(db, input, employee.pinHash);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) { if (error instanceof CounterError) return res.status(409).json({ error: error.message }); return next(error); }
});
posRoutes.get("/tables", async (_req, res, next) => {
  try {
    const db = res.locals.posDb as Db;
    return res.json(await db.floorSector.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], include: { tables: { orderBy: { number: "asc" }, include: { items: true } } } }));
  } catch (error) { return next(error); }
});
posRoutes.get("/offline-snapshot", async (_req, res, next) => {
  if (res.locals.posRole !== "owner") return res.sendStatus(403);
  try { return res.json(await readOfflineInventory(res.locals.posDb as Db)); }
  catch (error) { return next(error); }
});
posRoutes.get("/accounts", async (_req, res, next) => {
  if (res.locals.posRole !== "owner") return res.sendStatus(403);
  try { return res.json(await readAccounts(res.locals.posDb as Db));
  } catch (error) { return next(error); }
});
posRoutes.get("/floor", async (_req, res, next) => {
  try { return res.json(await readFloor(res.locals.posDb as Db)); }
  catch (error) { if (error instanceof FloorConflict) return res.status(409).json({ error: error.message }); return next(error); }
});
posRoutes.put("/floor", async (req, res, next) => {
  const input = parseFloor(req.body);
  if (!input) return res.status(400).json({ error: "Plano inválido. Revisá los números y sectores." });
  try { return res.json(await saveFloor(res.locals.posDb as Db, input)); }
  catch (error) { if (error instanceof FloorConflict) return res.status(409).json({ error: error.message }); return next(error); }
});
posRoutes.post("/settlements", async (req, res, next) => {
  const input = parseSettlement(req.body);
  if (!input || !validId(req.body?.operatorId) || typeof req.body?.employeePin !== "string" || !/^\d{4}$/.test(req.body.employeePin)) return res.status(400).json({ error: "Indicá el responsable y su código de cuatro números." });
  try {
    const db = res.locals.posDb as Db;
    const [table, sale, employee] = await Promise.all([
      db.diningTable.findUnique({ where: { id: input.tableId }, select: { operatorId: true, version: true } }),
      db.sale.findUnique({ where: { id: input.id }, select: { tableId: true, operatorId: true } }),
      db.employee.findUnique({ where: { id: req.body.operatorId }, select: { legacyId: true, active: true, deletedAt: true, pinHash: true } }),
    ]);
    if (!table || sale && sale.tableId !== input.tableId) return res.status(404).json({ error: "La mesa no está disponible." });
    if (sale ? sale.operatorId !== req.body.operatorId : table.operatorId !== req.body.operatorId || table.version !== input.expectedVersion) return res.status(409).json({ error: "La cuenta o su responsable cambiaron. Actualizá antes de cobrar." });
    if (!employee || !employee.active || employee.deletedAt || !Number.isSafeInteger(Number(employee.legacyId))) return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const verified = await verifyEmployeeCode(db, res.locals.posActor as string, Number(employee.legacyId), req.body.employeePin);
    if (verified === "blocked") return res.status(429).json({ error: "Demasiados intentos. Esperá antes de reintentar." });
    if (verified !== "valid") return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const result = await settleTable(db, input, { operatorId: req.body.operatorId, pinHash: employee.pinHash });
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof SettlementError) return res.status(error.reason === "missing" ? 404 : 409).json({ error: error.message });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return res.status(409).json({ error: "La cuenta o el stock cambiaron. Actualizá y volvé a intentar." });
    return next(error);
  }
});

posRoutes.post("/offline-settlements", async (req, res, next) => {
  const account = parseAccountChange(req.body?.account);
  const settlement = parseSettlement(req.body?.settlement);
  const versions = parseRecipeVersions(req.body?.recipeVersions);
  const pin = req.body?.employeePin;
  if (!account?.operatorId || !settlement || !versions || !settlement.expectedShiftId || typeof req.body?.occurredAt !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "Indicá la cuenta, las recetas, la fecha, el turno y el código del responsable." });
  try {
    const db = res.locals.posDb as Db;
    const employee = await db.employee.findUnique({ where: { id: account.operatorId }, select: { legacyId: true, active: true, deletedAt: true, pinHash: true } });
    if (!employee?.active || employee.deletedAt || !Number.isSafeInteger(Number(employee.legacyId))) return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const verified = await verifyEmployeeCode(db, res.locals.posActor as string, Number(employee.legacyId), pin);
    if (verified === "blocked") return res.status(429).json({ error: "Demasiados intentos. Esperá antes de reintentar." });
    if (verified !== "valid") return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const result = await settleOfflineAccount(db, account, settlement, versions, req.body.occurredAt, { operatorId: account.operatorId, pinHash: employee.pinHash });
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof AccountError || error instanceof SettlementError) return res.status(error.reason === "missing" ? 404 : 409).json({ error: error.message });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return res.status(409).json({ error: "La cuenta o el stock cambiaron. Revisá antes de sincronizar." });
    return next(error);
  }
});

posRoutes.post("/settlements/reconcile", async (req, res, next) => {
  if (!validId(req.body?.id) || !validId(req.body?.tableId)) return res.sendStatus(400);
  try { return res.json(await reconcileSettlement(res.locals.posDb as Db, req.body.id, req.body.tableId)); }
  catch (error) { if (error instanceof SettlementError) return res.status(409).json({ error: error.message }); return next(error); }
});

posRoutes.put("/account-transfers", async (req, res, next) => {
  const input = parseAccountBatch(req.body);
  if (!input) return res.status(400).json({ error: "Datos de traslado inválidos." });
  try {
    const result = await saveAccountBatch(res.locals.posDb as Db, input);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof AccountError) return res.status(error.reason === "missing" ? 404 : 409).json({ error: error.message });
    if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2003")) return res.status(409).json({ error: "Las cuentas o el catálogo cambiaron. Actualizá antes de guardar." });
    return next(error);
  }
});
posRoutes.put("/accounts", async (req, res, next) => {
  const input = parseAccountChange(req.body);
  if (!input || !input.operatorId || typeof req.body?.employeePin !== "string" || !/^\d{4}$/.test(req.body.employeePin)) return res.status(400).json({ error: "Indicá el responsable y su código de cuatro números." });
  try {
    const db = res.locals.posDb as Db;
    const [table, prior, employee] = await Promise.all([
      db.diningTable.findUnique({ where: { id: input.tableId }, select: { operatorId: true, version: true } }),
      db.tableAccountOperation.findUnique({ where: { id: input.id }, select: { tableId: true } }),
      db.employee.findUnique({ where: { id: input.operatorId }, select: { legacyId: true, active: true, deletedAt: true, pinHash: true } }),
    ]);
    if (!table || prior && prior.tableId !== input.tableId) return res.status(404).json({ error: "La mesa no está disponible." });
    if (!prior && (table.version !== input.expectedVersion || table.operatorId && table.operatorId !== input.operatorId)) return res.status(409).json({ error: "La cuenta o su responsable cambiaron. Actualizá antes de guardar." });
    if (!employee || !employee.active || employee.deletedAt || !Number.isSafeInteger(Number(employee.legacyId))) return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const verified = await verifyEmployeeCode(db, res.locals.posActor as string, Number(employee.legacyId), req.body.employeePin);
    if (verified === "blocked") return res.status(429).json({ error: "Demasiados intentos. Esperá antes de reintentar." });
    if (verified !== "valid") return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    const result = await saveTableAccount(db, input, employee.pinHash);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof AccountError) return res.status(error.reason === "missing" ? 404 : 409).json({ error: error.message });
    if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2003")) return res.status(409).json({ error: "La cuenta o el catálogo cambiaron. Actualizá antes de guardar." });
    return next(error);
  }
});

return posRoutes;
}
export const posRoutes = createPosRoutes({
  getSession: (cookie) => auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) }),
  getAccess: tenantAccess,
  allowedOrigin: (origin) => isTrustedAdminOrigin(origin, config.frontendOrigin, process.env.NODE_ENV === "development"),
});
