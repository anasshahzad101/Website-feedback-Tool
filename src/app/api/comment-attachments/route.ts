import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import type { CommentAttachmentStored } from "@/lib/comment-attachments";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-wav",
]);
const FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/** When the browser sends an empty type or application/octet-stream (common on Windows). */
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

function mimeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

function resolveMime(blob: Blob, filename: string): string {
  const raw = (blob.type || "").split(";")[0]!.trim();
  if (raw && raw !== "application/octet-stream") {
    return raw;
  }
  const inferred = mimeFromFilename(filename);
  if (inferred) return inferred;
  return raw || "application/octet-stream";
}

function classifyMime(mime: string): {
  kind: CommentAttachmentStored["kind"];
  maxBytes: number;
  fallbackExt: string;
} | null {
  if (IMAGE_TYPES.has(mime))
    return { kind: "image", maxBytes: 10 * 1024 * 1024, fallbackExt: ".png" };
  if (AUDIO_TYPES.has(mime))
    return { kind: "audio", maxBytes: 20 * 1024 * 1024, fallbackExt: ".webm" };
  if (FILE_TYPES.has(mime)) {
    const isVideo = mime.startsWith("video/");
    return {
      kind: "file",
      maxBytes: isVideo ? 50 * 1024 * 1024 : 15 * 1024 * 1024,
      fallbackExt: isVideo ? ".mp4" : ".bin",
    };
  }
  return null;
}

// POST multipart: repeated field "file" (max 8)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const raw = formData.getAll("file");
    const blobs: { blob: Blob; name: string }[] = [];

    for (const entry of raw) {
      if (entry instanceof Blob && entry.size > 0) {
        const name =
          entry instanceof File && entry.name?.trim()
            ? entry.name
            : "attachment";
        blobs.push({ blob: entry, name });
      }
    }

    if (!blobs.length) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }
    if (blobs.length > 8) {
      return NextResponse.json(
        { error: "Too many files (max 8)" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "comment-attachments"
    );
    await fs.mkdir(uploadsDir, { recursive: true });

    const attachments: CommentAttachmentStored[] = [];

    for (const { blob, name: originalName } of blobs) {
      const mime = resolveMime(blob, originalName);
      const spec = classifyMime(mime);
      if (!spec) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${mime}. Try a common image, PDF, zip, or audio format.`,
          },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length > spec.maxBytes) {
        return NextResponse.json({ error: "File too large" }, { status: 400 });
      }

      const safeBase = path
        .basename(originalName || "attachment")
        .replace(/[^\w.\-()+ ]/g, "_")
        .slice(0, 120);
      let ext = path.extname(safeBase).toLowerCase();
      if (!ext || ext.length > 12) ext = spec.fallbackExt;
      const filename = `${randomUUID()}${ext}`;
      await fs.writeFile(path.join(uploadsDir, filename), buf);

      attachments.push({
        kind: spec.kind,
        path: `/comment-attachments/${filename}`,
        name: safeBase || filename,
        mime,
      });
    }

    return NextResponse.json({ attachments });
  } catch (e) {
    console.error("comment-attachments POST:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
