/**
 * Prisma validate/generate only needs a syntactically valid DATABASE_URL (no DB connection).
 * Vercel installs deps before env is guaranteed; missing URL breaks postinstall and yields no deployment → platform 404.
 *
 * Invokes the Prisma CLI with `node` (avoids `npx` → extra npm child processes on low-nproc hosts).
 *
 * Local dev without MySQL: set USE_SQLITE=true in .env to generate the client from prisma/schema.sqlite.prisma
 * (file DB at prisma/dev.db). Production / Vercel: omit USE_SQLITE and use DATABASE_URL with MySQL.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function readEnvFile() {
  try {
    return fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return "";
  }
}

const envFile = readEnvFile();
const useSqlite =
  process.env.USE_SQLITE === "true" ||
  /^\s*USE_SQLITE\s*=\s*"?true"?\s*$/im.test(envFile);

const env = { ...process.env };
if (!useSqlite && !env.DATABASE_URL?.trim()) {
  env.DATABASE_URL =
    "mysql://build:build@127.0.0.1:3306/build_placeholder";
}

if (!env.UV_THREADPOOL_SIZE) {
  env.UV_THREADPOOL_SIZE = "1";
}
if (!env.NEXT_TELEMETRY_DISABLED) {
  env.NEXT_TELEMETRY_DISABLED = "1";
}
if (!env.VIPS_CONCURRENCY) {
  env.VIPS_CONCURRENCY = "1";
}

const root = process.cwd();
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
if (!fs.existsSync(prismaCli)) {
  console.error("Missing Prisma CLI. Run npm ci first.");
  process.exit(1);
}

const args = [prismaCli, "generate"];
if (useSqlite) {
  args.push("--schema=prisma/schema.sqlite.prisma");
}

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
