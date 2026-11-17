import { Router } from "express";
import { auth } from "../auth.js";
import { centralDb } from "@mistro/db/central";
import { menuSlugBase, menuSlugWithSuffix } from "./menuSlug.js";
import { config } from "../config.js";
import { isTrustedAdminOrigin } from "./origin.js";

export const adminAccounts = Router();

adminAccounts.use((request, response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (!isTrustedAdminOrigin(request.get("origin"), config.frontendOrigin, process.env.NODE_ENV === "development")) {
    return response.sendStatus(403);
  }
  return next();
});

async function isSuperadmin(cookie: string | undefined) {
  const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) });
  return session?.user.role?.split(",").includes("admin") ?? false;
}

adminAccounts.get("/brands", async (request, response, next) => {
  try {
    if (!await isSuperadmin(request.headers.cookie)) return response.sendStatus(403);
    const brands = await centralDb.workspace.findMany({
      select: { id: true, name: true, status: true, memberships: { where: { role: "owner" }, select: { userId: true } } },
    });
    return response.json(brands.map(({ memberships, ...brand }) => ({ ...brand, ownerUserId: memberships[0]?.userId ?? null })));
  } catch (error) { return next(error); }
});

adminAccounts.post("/accounts", async (request, response, next) => {
  try {
    if (!await isSuperadmin(request.headers.cookie)) return response.sendStatus(403);
    const { name, email, password, brandName } = request.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 120 ||
        typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || password.length > 128 ||
        typeof brandName !== "string" || brandName.trim().length < 2 || brandName.length > 120) {
      return response.status(400).json({ error: "Revisá los datos de la cuenta y de la marca." });
    }
    const baseSlug = menuSlugBase(brandName);
    let slug = baseSlug;

    const headers = new Headers({ cookie: request.headers.cookie ?? "" });
    const created = await auth.api.createUser({
      headers,
      body: { name: name.trim(), email: email.trim().toLowerCase(), password, role: "user" },
    });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await centralDb.$transaction(async (tx) => {
            await tx.workspace.create({ data: { id: slug, name: brandName.trim(), databaseKey: slug.replaceAll("-", "_"), status: "pending" } });
            await tx.workspaceMembership.create({ data: { workspaceId: slug, userId: created.user.id, role: "owner" } });
          });
          break;
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "P2002") || attempt >= 4) throw error;
          slug = menuSlugWithSuffix(baseSlug);
        }
      }
    } catch (error) {
      try { await auth.api.removeUser({ headers, body: { userId: created.user.id } }); }
      catch (cleanupError) { console.error("No se pudo revertir el alta de usuario", cleanupError); }
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        return response.status(409).json({ error: "No se pudo generar un identificador disponible. Intentá nuevamente." });
      }
      throw error;
    }
    return response.status(201).json({ userId: created.user.id, brandName: brandName.trim(), menuSlug: slug, status: "pending" });
  } catch (error) { return next(error); }
});

adminAccounts.put("/accounts/:userId", async (request, response, next) => {
  try {
    if (!await isSuperadmin(request.headers.cookie)) return response.sendStatus(403);
    const { name, email } = request.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 120 ||
        typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return response.status(400).json({ error: "Revisá el nombre y el correo electrónico." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const result = await centralDb.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: request.params.userId }, select: { id: true, role: true, email: true } });
      if (!user || user.role?.split(",").includes("admin")) return false;
      const emailChanged = user.email !== normalizedEmail;
      const updated = await tx.user.updateMany({ where: { id: user.id, role: user.role }, data: {
        name: name.trim(), email: normalizedEmail, ...(emailChanged ? { emailVerified: false } : {}),
      } });
      if (!updated.count) return false;
      if (emailChanged) await tx.session.deleteMany({ where: { userId: user.id } });
      return true;
    });
    if (!result) return response.sendStatus(404);
    return response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") return response.status(409).json({ error: "Ese correo ya está en uso." });
    return next(error);
  }
});

adminAccounts.delete("/accounts/:userId", async (request, response, next) => {
  try {
    if (!await isSuperadmin(request.headers.cookie)) return response.sendStatus(403);
    const userId = request.params.userId;
    const user = await centralDb.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role?.split(",").includes("admin")) return response.sendStatus(403);
    const pendingBrands = await centralDb.workspace.findMany({
      where: { status: "pending", memberships: { some: { userId, role: "owner" } } },
      select: { id: true },
    });
    await auth.api.removeUser({ headers: new Headers({ cookie: request.headers.cookie ?? "" }), body: { userId } });
    await centralDb.workspace.deleteMany({
      where: { id: { in: pendingBrands.map((brand) => brand.id) }, status: "pending", memberships: { none: {} } },
    });
    return response.sendStatus(204);
  } catch (error) { return next(error); }
});
