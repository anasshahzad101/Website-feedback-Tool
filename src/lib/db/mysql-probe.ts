import mysql from "mysql2/promise";

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
    };

/**
 * Raw mysql2 check (same stack many Hostinger guides use). Logs one line for server logs.
 */
export async function probeMysqlWithPool(): Promise<MysqlProbeResult> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    const line = "DB_CONNECT_ERROR: missing DATABASE_URL";
    console.error(line);
    return { ok: false, message: "DATABASE_URL missing" };
  }

  let pool: mysql.Pool | undefined;
  try {
    pool = mysql.createPool(url);
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
    };
  } finally {
    if (pool) {
      await pool.end().catch(() => undefined);
    }
  }
}
