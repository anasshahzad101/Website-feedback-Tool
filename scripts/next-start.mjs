/**
 * Production `next start` for shared hosts (Hostinger, VPS):
 * - Forces NODE_ENV=production (same intent as `NODE_ENV=production node ...` on Linux).
 * - Binds 0.0.0.0 so the reverse proxy can reach the app (not loopback-only).
 * - Uses process.env.PORT (no shell ${PORT:-...}) so hPanel-assigned ports always win.
 *
 * Heap cap applies to the Next.js server process (see spawn args below).
 * Override with NODE_HEAP_MB (e.g. 768) if 512MB causes OOM at runtime.
 * Optional: HOSTNAME=127.0.0.1 for local smoke tests only.
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

process.env.NODE_ENV = "production";

const hostname = (process.env.HOSTNAME ?? "0.0.0.0").trim() || "0.0.0.0";
const port = (process.env.PORT ?? "3002").trim() || "3002";
const heapMb = (process.env.NODE_HEAP_MB ?? "512").trim() || "512";

const result = spawnSync(
  process.execPath,
  [
    `--max-old-space-size=${heapMb}`,
    nextCli,
    "start",
    "-H",
    hostname,
    "-p",
    port,
  ],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
