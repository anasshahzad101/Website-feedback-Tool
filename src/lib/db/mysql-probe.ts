import mysql from "mysql2/promise";

/** mysql2 createPool accepts either a URI string or an options object. */
type PoolInput =
  | string
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };

function redactConnectionDetails(message: string): string {
  return message
    .replace(/mysql:\/\/([^:/?#]+):([^@/]+)@/gi, "mysql://$1:***@")
    .slice(0, 500);
}

export type MysqlProbeResult =
  | { ok: true }
  | {
      ok: false;
      code?: string;
      errno?: number;
      sqlState?: string;
      message: string;
      /** Whether the pool used connection URI vs split DB_* env (for support tickets). */
      poolSource?: "DATABASE_URL" | "DB_HOST";
    };

function buildPoolConfig(): PoolInput | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;

  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME?.trim();
  const port = Number(process.env.DB_PORT ?? "3306") || 3306;
  if (!host || !user || password === undefined || !database) return null;

  return {
    host,
    port,
    user,
    password,
    database,
  };
}

/**
 * Raw mysql2 check (Hostinger-style): pool from DATABASE_URL or split DB_* vars.
 * Logs: DB_CONNECT_ERROR: code errno sqlState message
 */
export async function probeMysqlWithPool(): Promise<MysqlProbeResult> {
  const config = buildPoolConfig();
  if (!config) {
    const line = "DB_CONNECT_ERROR: missing DATABASE_URL and incomplete DB_HOST/DB_USER/DB_PASSWORD/DB_NAME";
    console.error(line);
    return { ok: false, message: "No DATABASE_URL and not all DB_* vars set" };
  }

  const poolSource =
    typeof config === "string" ? ("DATABASE_URL" as const) : ("DB_HOST" as const);

  let pool: mysql.Pool | undefined;
  try {
    pool =
      typeof config === "string"
        ? mysql.createPool(config)
        : mysql.createPool(config);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return { ok: true };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { sqlState?: string; code?: string };
    console.error(
      "DB_CONNECT_ERROR:",
      err?.code,
      err?.errno,
      err?.sqlState,
      err?.message,
    );
    return {
      ok: false,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      message: redactConnectionDetails(String(err.message ?? e)),
      poolSource,
    };
  } finally {
    if (pool) {
      await pool.end().catch(() => undefined);
    }
  }
}
