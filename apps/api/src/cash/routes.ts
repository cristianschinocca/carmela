import { Router } from "express";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { CashConflict, cashOperation, parseCashOperation, readCash } from "./service.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
type Dependencies = { getSession: (cookie: string | undefined) => Promise<{ user: { id: string; banned?: boolean | null } } | null>; getAccess: typeof tenantAccess; allowedOrigin: (origin: string | undefined) => boolean };
export function createCashRoutes(deps: Dependencies) {
  const routes = Router({ mergeParams: true });
  routes.use(async (req, res, next) => {
    try {
      if (req.method !== 'GET' && !deps.allowedOrigin(req.get('origin'))) return res.sendStatus(403);
      const session = await deps.getSession(req.headers.cookie);
      if (!session || session.user.banned) return res.sendStatus(401);
      if (typeof req.params.workspaceId !== 'string') return res.sendStatus(404);
      const access = await deps.getAccess(session.user.id, req.params.workspaceId);
      if (!access) return res.sendStatus(404);
      if (access.role !== 'owner') return res.sendStatus(403);
      res.locals.cashDb = access.db; res.locals.actorId = session.user.id;
      res.set('Cache-Control', 'no-store'); return next();
    } catch (error) { return next(error); }
  });
  routes.get('/active', async (_req, res, next) => {
    try {
      const shift = await (res.locals.cashDb as Db).cashShift.findFirst({ where: { closedAt: null }, select: { id: true } });
      return res.json(shift);
    } catch (error) { return next(error); }
  });
  routes.get('/current', async (_req, res, next) => {
    try { return res.json(await readCash(res.locals.cashDb as Db)); } catch (error) { return next(error); }
  });
  routes.post('/operations', async (req, res, next) => {
    const input = parseCashOperation(req.body);
    if (!input) return res.status(400).json({ error: 'Revisá los datos del movimiento.' });
    if (input.action === 'close') return res.status(409).json({ error: 'El cierre estará disponible cuando los cobros del POS se registren en el servidor.' });
    try { const result = await cashOperation(res.locals.cashDb as Db, res.locals.actorId as string, input); return res.status(result.replayed ? 200 : 201).json(result); }
    catch (error) {
      if (error instanceof CashConflict || error && typeof error === 'object' && 'code' in error && ['P2002','P2003','P2034'].includes(String(error.code))) return res.status(409).json({ error: error instanceof CashConflict ? error.message : 'La caja o el movimiento cambió. Actualizá antes de continuar.' });
      return next(error);
    }
  });
  return routes;
}
export const cashRoutes = createCashRoutes({
  getSession: (cookie) => auth.api.getSession({ headers: new Headers({ cookie: cookie ?? '' }) }),
  getAccess: tenantAccess,
  allowedOrigin: (origin) => isTrustedAdminOrigin(origin, config.frontendOrigin, process.env.NODE_ENV === 'development'),
});
