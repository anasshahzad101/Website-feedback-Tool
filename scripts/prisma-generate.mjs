/**
 * Prisma validate/generate only needs a syntactically valid DATABASE_URL (no DB connection).
 * Vercel installs deps before env is guaranteed; missing URL breaks postinstall and yields no deployment → platform 404.
 *
 * Local dev without MySQL: set USE_SQLITE=true in .env to generate the client from prisma/schema.sqlite.prisma
 * (file DB at prisma/dev.db). Production / Vercel: omit USE_SQLITE and use DATABASE_URL with MySQL.
 */
import { execSync } from "node:child_process";
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

const cmd = useSqlite
  ? "npx prisma generate --schema=prisma/schema.sqlite.prisma"
  : "npx prisma generate";

execSync(cmd, { stdio: "inherit", env });
