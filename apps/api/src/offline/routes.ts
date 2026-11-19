import { Router } from "express";
import { auth } from "../auth.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "../admin/origin.js";
import { tenantAccess } from "../db/tenantAccess.js";
import { parseTerminal, readTerminal, registerTerminal } from "./terminal.js";

type Db = NonNullable<Awaited<ReturnType<typeof tenantAccess>>>["db"];
type Dependencies = { getSession: (cookie: string | undefined) => Promise<{ user: { id: string; banned?: boolean | null } } | null>; getAccess: typeof tenantAccess; allowedOrigin: (origin: string | undefined) => boolean };
export function createTerminalRoutes(deps: Dependencies) {
  const routes = Router({ mergeParams: true });
  routes.use(async (req, res, next) => {
    try {
      if (req.method !== "GET" && !deps.allowedOrigin(req.get("origin"))) return res.sendStatus(403);
      const session = await deps.getSession(req.headers.cookie);
      if (!session || session.user.banned) return res.sendStatus(401);
      if (typeof req.params.workspaceId !== "string") return res.sendStatus(404);
      const access = await deps.getAccess(session.user.id, req.params.workspaceId);
      if (!access) return res.sendStatus(404);
      if (access.role !== "owner") return res.sendStatus(403);
      res.locals.db = access.db; res.locals.actorId = session.user.id; res.set("Cache-Control", "no-store"); return next();
    } catch (error) { return next(error); }
  });
  routes.get("/", async (req, res, next) => {
    try { return res.json(await readTerminal(res.locals.db as Db, parseTerminal({ deviceId: req.get("x-terminal-id"), token: req.get("x-terminal-token") }))); }
    catch (error) { return next(error); }
  });
  routes.post("/", async (req, res, next) => {
    const identity = parseTerminal(req.body);
    if (!identity) return res.status(400).json({ error: "Datos de terminal inválidos." });
    try { return res.json(await registerTerminal(res.locals.db as Db, res.locals.actorId as string, identity)); }
    catch (error) { if (error instanceof Error && error.message === "Ya hay otra PC registrada para esta cafetería.") return res.status(409).json({ error: error.message }); return next(error); }
  });
  return routes;
}
export const terminalRoutes = createTerminalRoutes({
  getSession: (cookie) => auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) }),
  getAccess: tenantAccess,
  allowedOrigin: (origin) => isTrustedAdminOrigin(origin, config.frontendOrigin, process.env.NODE_ENV === "development"),
});
