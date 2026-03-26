import { ensureMysqlDatabaseUrlEnv } from "@/lib/db/database-url";

/** Leading/trailing spaces in hPanel break Auth.js (e.g. " https://..."). */
function trimEnvKey(key: string) {
  const raw = process.env[key];
  if (typeof raw !== "string") return;
  let v = raw.replace(/^\uFEFF/, "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  if (v !== raw) process.env[key] = v;
}

/**
 * Run as early as possible on the Node server (instrumentation, db client, health).
 */
export function bootstrapServerEnv() {
  ensureMysqlDatabaseUrlEnv();
  trimEnvKey("AUTH_URL");
  trimEnvKey("NEXTAUTH_URL");
  trimEnvKey("NEXT_PUBLIC_APP_URL");
}
