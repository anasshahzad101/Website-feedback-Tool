import { ensureMysqlDatabaseUrlEnv } from "@/lib/db/database-url";

/**
 * Whether DB is configured for routing (/setup, /login) and health checks.
 * - Local SQLite: USE_SQLITE=true (datasource URL lives in prisma/schema.sqlite.prisma)
 * - MySQL: non-empty DATABASE_URL after optional synthesis from DB_* vars
 */
export function isDatabaseEnvConfigured(): boolean {
  if (process.env.USE_SQLITE === "true") return true;
  ensureMysqlDatabaseUrlEnv();
  const raw = process.env.DATABASE_URL;
  return typeof raw === "string" && raw.replace(/^\uFEFF/, "").trim() !== "";
}
