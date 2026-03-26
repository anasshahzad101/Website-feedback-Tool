/**
 * Run `next build` with conservative threading for shared/VPS hosts that hit
 * process/thread limits (503, EAGAIN, "too many processes") during deploy.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = "2";
}
if (!process.env.NEXT_TELEMETRY_DISABLED) {
  process.env.NEXT_TELEMETRY_DISABLED = "1";
}

const result = spawnSync("npx", ["next", "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
