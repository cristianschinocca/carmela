import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { centralDb } from "@carmela/db/central";
import { closeDatabases } from "@carmela/db/tenant";
import { config } from "./config.js";
import { authorizedWorkspace, checkWorkspaceDatabase, listWorkspaces } from "./db/workspaces.js";

const app = express();
app.disable("x-powered-by");
app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "100kb" }));

async function sessionFor(cookie: string | undefined) {
  return auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) });
}

app.get("/api/workspaces", async (request, response, next) => {
  try {
    const session = await sessionFor(request.headers.cookie);
    if (!session) return response.sendStatus(401);
    const isAdmin = session.user.role?.split(",").includes("admin") ?? false;
    return response.json(await listWorkspaces(session.user.id, isAdmin));
  } catch (error) { return next(error); }
});

app.get("/api/workspaces/:id/check", async (request, response, next) => {
  try {
    const session = await sessionFor(request.headers.cookie);
    if (!session) return response.sendStatus(401);
    const workspace = await authorizedWorkspace(session.user.id, request.params.id);
    if (!workspace) return response.sendStatus(404);
    await checkWorkspaceDatabase(workspace);
    return response.json({ id: workspace.id, available: true });
  } catch (error) { return next(error); }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Error en la API", error);
  response.status(500).json({ error: "Error interno" });
});

const server = app.listen(config.port, "0.0.0.0", () => console.log(`API en puerto ${config.port}`));
function shutdown() {
  server.close(() => { void Promise.all([centralDb.$disconnect(), closeDatabases()]).finally(() => process.exit(0)); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
