import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { requiredEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __storeDbPool: Pool | undefined;
}

/** A single pooled connection per process; survives Next.js hot reloads in dev. */
export function pool(): Pool {
  if (!globalThis.__storeDbPool) {
    const connectionString = requiredEnv("DATABASE_URL");
    const isProd = process.env.NODE_ENV === "production";
    globalThis.__storeDbPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX || (isProd ? 10 : 5)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
      application_name: "trustedsystems-store",
    });
    globalThis.__storeDbPool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error);
    });
  }
  return globalThis.__storeDbPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * All multi-step writes use this helper: one connection, one transaction,
 * automatic ROLLBACK on any error (including stock conflicts and validation).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: { isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE" } = {},
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${options.isolationLevel ?? "READ COMMITTED"}`);
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function dbHealth(): Promise<boolean> {
  try {
    const row = await queryOne<{ ok: boolean }>("SELECT true AS ok");
    return row?.ok === true;
  } catch {
    return false;
  }
}
