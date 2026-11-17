import { defineConfig } from "prisma/config";

const key = process.env.TENANT_KEY;
if (key && !/^[a-z][a-z0-9_]*$/.test(key)) throw new Error("TENANT_KEY inválida");

export default defineConfig({
  schema: "prisma/tenant/schema.prisma",
  migrations: { path: "prisma/tenant/migrations" },
  datasource: { url: key ? process.env[`TENANT_DB_${key.toUpperCase()}_URL`] ?? "" : "" },
});
