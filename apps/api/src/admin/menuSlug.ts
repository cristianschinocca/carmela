import { randomBytes } from "node:crypto";

const reserved = new Set(["www", "api", "admin", "superadmin", "app", "login", "menu", "mistro"]);

export function menuSlugBase(name: string): string {
  let slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z]/.test(slug)) slug = `marca-${slug}`;
  slug = slug.slice(0, 48).replace(/-+$/g, "");
  if (slug.length < 3) slug = `marca-${slug || "nueva"}`;
  return reserved.has(slug) ? `marca-${slug}` : slug;
}

export function menuSlugWithSuffix(base: string): string {
  return `${base.slice(0, 39).replace(/-+$/g, "")}-${randomBytes(4).toString("hex")}`;
}
