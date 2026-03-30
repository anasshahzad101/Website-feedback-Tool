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
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `context-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const abs = path.join(uploadsDir, filename);
  await fs.writeFile(abs, buf);
  // Help the follow-up /api/comments request see the file immediately (NFS / host FS lag).
  try {
    const h = await fs.open(abs, "r");
    await h.sync();
    await h.close();
  } catch {
    /* best-effort */
  }
  return { ok: true, relativePath: `/screenshots/${filename}` };
}
