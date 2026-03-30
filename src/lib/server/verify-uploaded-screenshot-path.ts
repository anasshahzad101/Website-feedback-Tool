import fs from "fs/promises";
import path from "path";

/** DB paths like `/screenshots/context-abc.png` → file under `public/uploads/screenshots/`. */
function resolveSafeScreenshotAbs(dbPath: string): string | null {
  const t = dbPath.trim();
  if (!/^\/screenshots\/[a-zA-Z0-9._-]+\.png$/i.test(t)) return null;
  const base = path.basename(t);
  const dir = path.join(process.cwd(), "public", "uploads", "screenshots");
  const abs = path.join(dir, base);
  const safeDir = path.resolve(dir);
  const safeAbs = path.resolve(abs);
  const prefix = safeDir.endsWith(path.sep) ? safeDir : `${safeDir}${path.sep}`;
  if (!safeAbs.startsWith(prefix)) return null;
  return safeAbs;
}

/**
 * After POST /api/screenshot, POST /api/comments can run in the next tick; some hosts
 * need a moment before `access` sees the file. Retries avoid saving comments without a screenshot.
 */
export async function assertUploadsScreenshotFileExists(
  dbPath: string,
  opts?: { retries?: number; delayMs?: number }
): Promise<string | null> {
  const retries = opts?.retries ?? 12;
  const delayMs = opts?.delayMs ?? 35;
  const safeAbs = resolveSafeScreenshotAbs(dbPath);
  if (!safeAbs) return null;
  const base = path.basename(safeAbs);
  for (let i = 0; i < retries; i++) {
    try {
      await fs.access(safeAbs);
      return `/screenshots/${base}`;
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return null;
}
