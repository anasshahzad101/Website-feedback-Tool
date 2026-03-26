/** Prisma often puts P1001 etc. on nested `cause` / `errorCode`, not the top Error. */
export function extractPrismaDbError(e: unknown): {
  prismaCode: string | undefined;
  message: string | undefined;
} {
  const messages: string[] = [];
  let prismaCode: string | undefined;
  let cur: unknown = e;
  const seen = new Set<unknown>();
  let depth = 0;
  while (cur != null && depth < 8 && !seen.has(cur)) {
    seen.add(cur);
    depth += 1;
    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      if (typeof o.errorCode === "string" && /^P\d{4}$/.test(o.errorCode)) {
        prismaCode = o.errorCode;
      }
      if (typeof o.code === "string" && /^P\d{4}$/.test(o.code)) {
        prismaCode = prismaCode ?? o.code;
      }
      if (typeof o.message === "string" && o.message.trim()) {
        messages.push(o.message.trim());
      }
    } else if (typeof cur === "string" && cur.trim()) {
      messages.push(cur.trim());
    }
    const next =
      cur instanceof Error && cur.cause !== undefined ? cur.cause : undefined;
    cur = next;
  }
  const pFromText = messages.join(" ").match(/\b(P\d{4})\b/)?.[1];
  return {
    prismaCode: prismaCode ?? pFromText,
    message: messages[0],
  };
}
