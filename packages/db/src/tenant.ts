import { Pool } from "pg";

const pools = new Map<string, Pool>();

export function tenantDatabase(key: string): Pool {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error("Clave de base de datos inválida");
  const existing = pools.get(key);
  if (existing) return existing;

  const url = process.env[`TENANT_DB_${key.toUpperCase()}_URL`];
  if (!url) throw new Error(`No hay base configurada para ${key}`);
  const pool = new Pool({ connectionString: url, max: 2 });
  pools.set(key, pool);
  return pool;
}

export async function closeDatabases(): Promise<void> {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}
