import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/central/client.js";

function databaseUrl(): string {
  const url = process.env.CONTROL_DATABASE_URL;
  if (!url) throw new Error("Falta CONTROL_DATABASE_URL");
  return url;
}

export const centralDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl(), max: 5 }),
});
