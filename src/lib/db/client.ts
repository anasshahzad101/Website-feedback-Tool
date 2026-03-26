import { PrismaClient } from "@prisma/client";

/** Panels sometimes save quoted values; BOM/whitespace breaks Prisma URL parsing. */
function normalizeDatabaseUrlEnv() {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== "string") return;
  let u = raw.replace(/^\uFEFF/, "").trim();
  if (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1).trim();
  }
  if (u !== raw) process.env.DATABASE_URL = u;
}

normalizeDatabaseUrlEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export * from "@prisma/client";
