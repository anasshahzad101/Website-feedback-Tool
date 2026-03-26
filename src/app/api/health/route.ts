import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { probeMysqlWithPool } from "@/lib/db/mysql-probe";
import { extractPrismaDbError } from "@/lib/db/prisma-error";
import { bootstrapServerEnv } from "@/lib/env/server-env-bootstrap";

function redactConnectionDetails(message: string): string {
  return message
    .replace(/mysql:\/\/([^:/?#]+):([^@/]+)@/gi, "mysql://$1:***@")
    .slice(0, 500);
}

/**
 * Deploy check: verify auth env and DB without exposing secrets.
 * Open https://yourdomain.com/api/health on the server to debug login issues.
 *
 * On Prisma failure we run a mysql2 ping and log DB_CONNECT_ERROR (see Hostinger logs).
 * Set HEALTH_FULL_ERRORS=true to add a longer redacted prisma message.
 */
export async function GET() {
  bootstrapServerEnv();
  const databaseUrlSet = !!process.env.DATABASE_URL?.trim();

  let dbStatus: "ok" | "error" | "skipped" = "skipped";
  let dbErrorCode: string | undefined;
  let dbErrorMessage: string | undefined;
  let mysqlProbe:
    | { ok: true }
    | {
        ok: false;
        code?: string;
        errno?: number;
        sqlState?: string;
        message: string;
      }
    | undefined;

  if (databaseUrlSet) {
    dbStatus = "error";
    try {
      await db.$queryRaw`SELECT 1`;
      dbStatus = "ok";
    } catch (e: unknown) {
      console.error("[health] Prisma DB check failed:", e);
      const extracted = extractPrismaDbError(e);
      dbErrorCode = extracted.prismaCode;
      dbErrorMessage = extracted.message
        ? redactConnectionDetails(extracted.message)
        : e instanceof Error
          ? redactConnectionDetails(e.message)
          : undefined;
      if (process.env.HEALTH_FULL_ERRORS !== "true") {
        dbErrorMessage =
          dbErrorMessage && dbErrorMessage.length > 220
            ? `${dbErrorMessage.slice(0, 220)}…`
            : dbErrorMessage;
      }
      mysqlProbe = await probeMysqlWithPool();
    }
  }

  const warnings: string[] = [];
  if (process.env.USE_SQLITE === "true") {
    warnings.push(
      "USE_SQLITE=true will generate the SQLite Prisma client at build time. For MySQL hosting, remove it or set USE_SQLITE=false, then redeploy.",
    );
  }

  const authSecret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  return NextResponse.json({
    databaseUrlSet,
    dbErrorCode: dbErrorCode ?? null,
    dbErrorMessage: dbErrorMessage ?? null,
    mysqlProbe: mysqlProbe ?? null,
    warnings: warnings.length ? warnings : undefined,
    authSecretSet: !!authSecret,
    authSecretSource: authSecret
      ? process.env.AUTH_SECRET?.trim()
        ? "AUTH_SECRET"
        : "NEXTAUTH_SECRET"
      : "none — set AUTH_SECRET (32+ chars) in host env and redeploy",
    authTrustHost: process.env.AUTH_TRUST_HOST ?? "not set (OK on Vercel if VERCEL=1)",
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "not set",
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "not set",
    db: dbStatus,
  });
}
