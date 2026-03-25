export type CommentAttachmentStored = {
  kind: "image" | "audio" | "file";
  path: string;
  name: string;
  mime?: string;
};

/** Public URL for a stored path under public/uploads (handles legacy shapes). */
export function attachmentPublicUrl(path: string): string {
  const p = path.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  if (withSlash.startsWith("/uploads/")) return withSlash;
  return `/uploads${withSlash}`;
}

function coerceAttachmentArray(raw: unknown): unknown[] | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return coerceAttachmentArray(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (
      (o.kind === "image" || o.kind === "audio" || o.kind === "file") &&
      typeof o.path === "string"
    ) {
      return [raw];
    }
  }
  return null;
}

function normalizeStoredPath(path: string): string | null {
  const t = path.trim();
  if (!t) return null;
  if (t.startsWith("/comment-attachments/")) return t;
  if (t.startsWith("comment-attachments/")) return `/${t}`;
  if (t.includes("comment-attachments/")) {
    const i = t.indexOf("comment-attachments/");
    return `/${t.slice(i)}`;
  }
  return null;
}

export function parseCommentAttachments(
  raw: unknown
): CommentAttachmentStored[] | undefined {
  const arr = coerceAttachmentArray(raw);
  if (!arr?.length) return undefined;
  const out: CommentAttachmentStored[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.kind !== "image" && o.kind !== "audio" && o.kind !== "file") continue;
    if (typeof o.path !== "string") continue;
    const normPath = normalizeStoredPath(o.path);
    if (!normPath) continue;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    out.push({
      kind: o.kind,
      path: normPath,
      name: o.name,
      mime: typeof o.mime === "string" ? o.mime : undefined,
    });
  }
  return out.length ? out : undefined;
}

export function messageHasAttachments(raw: unknown): boolean {
  return (parseCommentAttachments(raw)?.length ?? 0) > 0;
}

export async function uploadCommentFiles(
  files: File[]
): Promise<CommentAttachmentStored[]> {
  if (!files.length) return [];
  const fd = new FormData();
  for (const f of files) fd.append("file", f);
  const res = await fetch("/api/comment-attachments", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    attachments?: CommentAttachmentStored[];
  };
  if (!res.ok) {
    throw new Error(
      data.error || `Upload failed (${res.status})`
    );
  }
  return data.attachments ?? [];
}
