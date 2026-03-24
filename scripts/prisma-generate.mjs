/**
 * Prisma validate/generate only needs a syntactically valid DATABASE_URL (no DB connection).
 * Vercel installs deps before env is guaranteed; missing URL breaks postinstall and yields no deployment → platform 404.
 */
import { execSync } from "node:child_process";

const env = { ...process.env };
if (!env.DATABASE_URL?.trim()) {
  env.DATABASE_URL =
    "mysql://build:build@127.0.0.1:3306/build_placeholder";
}

execSync("npx prisma generate", { stdio: "inherit", env });
