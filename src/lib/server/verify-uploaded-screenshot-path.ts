import fs from "fs/promises";
import path from "path";

/** DB paths like `/screenshots/context-abc.png` → file under `public/uploads/screenshots/`. */
export async function assertUploadsScreenshotFileExists(
  dbPath: string
): Promise<string | null> {
  const t = dbPath.trim();
  if (!/^\/screenshots\/[a-zA-Z0-9._-]+\.png$/i.test(t)) return null;
  const base = path.basename(t);
  const dir = path.join(process.cwd(), "public", "uploads", "screenshots");
  const abs = path.join(dir, base);
  const safeDir = path.resolve(dir);
  const safeAbs = path.resolve(abs);
  const prefix = safeDir.endsWith(path.sep) ? safeDir : `${safeDir}${path.sep}`;
  if (!safeAbs.startsWith(prefix)) return null;
  try {
    await fs.access(safeAbs);
    return `/screenshots/${base}`;
  } catch {
    return null;
  }
}
