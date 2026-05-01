import path from "path";
import fs from "fs/promises";

const MAX_BYTES = 6 * 1024 * 1024;

/** Persist a PNG from a data URL or raw base64; returns `/screenshots/...` for DB. */
export async function saveContextPngFromBase64(
  imageBase64: string
): Promise<
  { ok: true; relativePath: string } | { ok: false; error: string }
> {
  let payload = imageBase64.trim();
  const dataUrlMatch = payload.match(/^data:image\/\w+;base64,(.+)$/i);
  if (dataUrlMatch) payload = dataUrlMatch[1]!;

  let buf: Buffer;
  try {
    buf = Buffer.from(payload, "base64");
  } catch {
    return { ok: false, error: "Invalid base64 image" };
  }
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: "Image too large" };
  }

  const uploadsDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "screenshots"
  );
  const filename = `context-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, filename), buf);
  } catch (e) {
    // Read-only filesystems (Vercel, some serverless hosts) reject writes.
    // Surface as a soft failure so callers can degrade gracefully instead of 500-ing.
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Filesystem write failed: ${message}` };
  }
  return { ok: true, relativePath: `/screenshots/${filename}` };
}
