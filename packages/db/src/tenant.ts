import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/tenant/client.js";

const databases = new Map<string, PrismaClient>();

export function tenantDatabase(key: string): PrismaClient {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error("Clave de base de datos inválida");
  const existing = databases.get(key);
  if (existing) return existing;

  const url = process.env[`TENANT_DB_${key.toUpperCase()}_URL`];
  if (!url) throw new Error(`No hay base configurada para ${key}`);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
  databases.set(key, client);
  return client;
}

export async function closeDatabases(): Promise<void> {
  await Promise.all([...databases.values()].map((client) => client.$disconnect()));
  databases.clear();
}

export { Prisma };
