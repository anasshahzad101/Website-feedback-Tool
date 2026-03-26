import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

/**
 * Deploy check: verify auth env and DB without exposing secrets.
 * Open https://yourdomain.com/api/health on the server to debug login issues.
 */
export async function GET() {
  const databaseUrlSet = !!process.env.DATABASE_URL?.trim();

  let dbStatus: "ok" | "error" | "skipped" = "skipped";
  let dbErrorCode: string | undefined;
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
    }
  }

  const authSecret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  return NextResponse.json({
    databaseUrlSet,
    dbErrorCode: dbErrorCode ?? null,
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
