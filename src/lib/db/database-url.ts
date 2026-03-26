/**
 * Hostinger and other panels sometimes use split DB_* vars (see hostinger.env.template).
 * Prisma only reads DATABASE_URL — we synthesize it when the parts are present and URL is empty.
 */
export function ensureMysqlDatabaseUrlEnv(): void {
  synthesizeDatabaseUrlFromParts();
  normalizeDatabaseUrlEnv();
}

function synthesizeDatabaseUrlFromParts() {
  const raw = process.env.DATABASE_URL;
  if (typeof raw === "string" && raw.replace(/^\uFEFF/, "").trim() !== "") {
    return;
  }
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  const name = process.env.DB_NAME?.trim();
  const port = (process.env.DB_PORT ?? "3306").trim();
  if (!host || !user || password === undefined || !name) return;
  process.env.DATABASE_URL = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}`;
}

/** Panels sometimes save quoted values; BOM/whitespace breaks Prisma URL parsing. */
export function normalizeDatabaseUrlEnv() {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== "string") return;
  let u = raw.replace(/^\uFEFF/, "").trim();
  if (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1).trim();
  }
  if (u !== raw) process.env.DATABASE_URL = u;
}
