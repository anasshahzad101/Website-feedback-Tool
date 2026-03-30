/**
 * Run `next build` with minimal subprocess/thread fan-out for shared hosts
 * (Hostinger ~200 process limits, EAGAIN, 503 during deploy).
 *
 * - Invokes the Next CLI with `node` (avoids `npx` → extra npm child processes).
 * - Caps libuv pool, libvips (sharp), and telemetry.
 * - Prisma client: run first in `npm run build` (see package.json), not in postinstall.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (!fs.existsSync(nextCli)) {
  console.error("Missing Next.js CLI. Run npm ci first.");
  process.exit(1);
}

const env = { ...process.env };

if (!env.UV_THREADPOOL_SIZE) {
  env.UV_THREADPOOL_SIZE = "1";
}
if (!env.NEXT_TELEMETRY_DISABLED) {
  env.NEXT_TELEMETRY_DISABLED = "1";
}
// Sharp / libvips: default concurrency can add threads during static analysis / images.
if (!env.VIPS_CONCURRENCY) {
  env.VIPS_CONCURRENCY = "1";
}

const result = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: root,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
