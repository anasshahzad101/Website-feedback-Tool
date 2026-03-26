import { NextResponse } from "next/server";
import { ensureMysqlDatabaseUrlEnv } from "@/lib/db/database-url";
import { db } from "@/lib/db/client";

function redactConnectionDetails(message: string): string {
  return message
    .replace(/mysql:\/\/([^:/?#]+):([^@/]+)@/gi, "mysql://$1:***@")
    .slice(0, 500);
}

/**
 * Deploy check: verify auth env and DB without exposing secrets.
 * Open https://yourdomain.com/api/health on the server to debug login issues.
 *
 * Set HEALTH_FULL_ERRORS=true temporarily to include dbErrorMessage (still redacted).
 */
export async function GET() {
  ensureMysqlDatabaseUrlEnv();
  const databaseUrlSet = !!process.env.DATABASE_URL?.trim();

  let dbStatus: "ok" | "error" | "skipped" = "skipped";
  let dbErrorCode: string | undefined;
  let dbErrorMessage: string | undefined;
  if (databaseUrlSet) {
    dbStatus = "error";
    try {
      await db.$queryRaw`SELECT 1`;
      dbStatus = "ok";
    } catch (e: unknown) {
      const err = e as { errorCode?: string; code?: string };
      dbErrorCode =
        err.errorCode ??
        err.code ??
        (e instanceof Error ? e.message.match(/\b(P\d{4})\b/)?.[1] : undefined);
      if (process.env.HEALTH_FULL_ERRORS === "true" && e instanceof Error) {
        dbErrorMessage = redactConnectionDetails(e.message);
      }
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
