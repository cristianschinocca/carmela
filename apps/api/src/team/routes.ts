import { Router } from "express";
import { Prisma } from "@mistro/db/tenant";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { validId } from "../catalog/validation.js";
import { hashPin, parseEmployee, pinLookup } from "./employee.js";
import { clockEmployee, parseClock, reconcileClock } from "./attendance.js";
import { verifyEmployeeCode } from "./verify.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
const publicFields = { id: true, legacyId: true, name: true, role: true, active: true, pay: true, version: true, clockedIn: true, clockedInAt: true } as const;
const publicEmployee = (row: { legacyId: bigint }) => ({ ...row, legacyId: Number(row.legacyId) });
const duplicate = (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "P2002";
type Dependencies = {
  getSession: (cookie: string | undefined) => Promise<{ user: { id: string; banned?: boolean | null } } | null>;
  getAccess: typeof tenantAccess;
  allowedOrigin: (origin: string | undefined) => boolean;
};
export function createTeamRoutes(deps: Dependencies) {
const teamRoutes = Router({ mergeParams: true });
teamRoutes.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && !deps.allowedOrigin(req.get("origin"))) return res.sendStatus(403);
    const session = await deps.getSession(req.headers.cookie);
    if (!session || session.user.banned) return res.sendStatus(401);
    if (typeof req.params.workspaceId !== "string") return res.sendStatus(404);
    const access = await deps.getAccess(session.user.id, req.params.workspaceId);
    if (!access) return res.sendStatus(404);
    if (access.role !== "owner") return res.sendStatus(403);
    res.locals.teamDb = access.db; res.locals.workspaceId = req.params.workspaceId; res.locals.actorId = session.user.id;
    res.set("Cache-Control", "no-store");
    return next();
  } catch (error) { return next(error); }
});
teamRoutes.get("/attendance/status", async (_req, res, next) => {
  try {
    const rows = await (res.locals.teamDb as Db).employee.findMany({ where: { active: true, deletedAt: null }, select: { id: true, legacyId: true, name: true, role: true, clockedIn: true, clockedInAt: true }, orderBy: { name: "asc" } });
    return res.json(rows.map(publicEmployee));
  } catch (error) { return next(error); }
});
teamRoutes.post("/attendance/clock", async (req, res, next) => {
  const input = parseClock(req.body);
  if (!input) return res.status(400).json({ error: "Ingresá un código de cuatro números." });
  try {
    const result = await clockEmployee(res.locals.teamDb as Db, res.locals.workspaceId as string, res.locals.actorId as string, input);
    if (result.status === "completed") return res.json(result);
    if (result.status === "blocked") { res.set("Retry-After", String(result.retryAfter)); return res.status(429).json({ error: "Demasiados intentos. Esperá un minuto." }); }
    if (result.status === "invalid") return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
    return res.status(409).json({ error: "No se pudo completar este intento." });
  } catch (error) { return next(error); }
});
teamRoutes.post("/attendance/reconcile", async (req, res, next) => {
  if (!validId(req.body?.id)) return res.sendStatus(400);
  try {
    const result = await reconcileClock(res.locals.teamDb as Db, res.locals.actorId as string, req.body.id);
    if (result.status === "conflict") return res.sendStatus(409);
    return res.json(result);
  } catch (error) { return next(error); }
});
teamRoutes.post("/employees/verify-code", async (req, res, next) => {
  const { employeeId, pin } = req.body ?? {};
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || typeof pin !== "string" || !/^\d{4}$/.test(pin)) return res.sendStatus(400);
  try {
    const result = await verifyEmployeeCode(res.locals.teamDb as Db, res.locals.actorId as string, employeeId, pin);
    if (result === "valid") return res.sendStatus(204);
    if (result === "blocked") { res.set("Retry-After", "60"); return res.status(429).json({ error: "Demasiados intentos. Esperá antes de volver a intentar." }); }
    return res.status(400).json({ error: "Código incorrecto o empleado inactivo." });
  } catch (error) { return next(error); }
});
teamRoutes.get("/employees", async (_req, res, next) => {
  try {
    const rows = await (res.locals.teamDb as Db).employee.findMany({ where: { deletedAt: null }, select: publicFields, orderBy: [{ name: "asc" }, { id: "asc" }] });
    return res.json(rows.map(publicEmployee));
  } catch (error) { return next(error); }
});
teamRoutes.post("/employees", async (req, res, next) => {
  const input = parseEmployee(req.body, true);
  if (!input || !input.pin) return res.status(400).json({ error: "Revisá los datos y el código del empleado." });
  try {
    const pinHash = await hashPin(input.pin);
    const row = await (res.locals.teamDb as Db).employee.create({ data: { name: input.name, role: input.role, active: input.active, pay: input.pay ?? Prisma.DbNull, pinHash, pinLookup: pinLookup(input.pin, res.locals.workspaceId as string) }, select: publicFields });
    return res.status(201).json(publicEmployee(row));
  } catch (error) { if (duplicate(error)) return res.status(409).json({ error: "Ese código ya pertenece a otro empleado." }); return next(error); }
});
teamRoutes.put("/employees/:id", async (req, res, next) => {
  const input = parseEmployee(req.body, false);
  const version = req.body?.version;
  if (!validId(req.params.id) || !input || typeof version !== "number" || !Number.isSafeInteger(version) || version < 0 || version >= 2147483647) return res.status(400).json({ error: "Revisá los datos del empleado." });
  try {
    const pinData = input.pin ? { pinHash: await hashPin(input.pin), pinLookup: pinLookup(input.pin, res.locals.workspaceId as string) } : {};
    const result = await (res.locals.teamDb as Db).employee.updateMany({ where: { id: req.params.id, version, deletedAt: null, ...(input.active ? {} : { clockedIn: false }) }, data: { name: input.name, role: input.role, active: input.active, pay: input.pay ?? Prisma.DbNull, ...pinData, version: { increment: 1 } } });
    if (!result.count) return res.status(409).json({ error: "El empleado cambió, ya no existe o está en turno. Registrá su salida y actualizá antes de guardar." });
    return res.sendStatus(204);
  } catch (error) { if (duplicate(error)) return res.status(409).json({ error: "Ese código ya pertenece a otro empleado." }); return next(error); }
});
teamRoutes.delete("/employees/:id", async (req, res, next) => {
  const version = req.body?.version;
  if (!validId(req.params.id) || typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) return res.sendStatus(400);
  try {
    const result = await (res.locals.teamDb as Db).employee.updateMany({ where: { id: req.params.id, version, deletedAt: null, clockedIn: false }, data: { active: false, deletedAt: new Date(), pinHash: "archived", pinLookup: null, version: { increment: 1 } } });
    if (!result.count) return res.status(409).json({ error: "El empleado cambió, ya no existe o está en turno. Registrá su salida antes de eliminarlo." });
    return res.sendStatus(204);
  } catch (error) { return next(error); }
});

return teamRoutes;
}
export const teamRoutes = createTeamRoutes({
  getSession: (cookie) => auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) }),
  getAccess: tenantAccess,
  allowedOrigin: (origin) => isTrustedAdminOrigin(origin, config.frontendOrigin, process.env.NODE_ENV === "development"),
});
