import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

/**
 * Deploy check: verify auth env and DB without exposing secrets.
 * Open https://yourdomain.com/api/health on the server to debug login issues.
 */
export async function GET() {
  let dbStatus: "ok" | "error" = "error";
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    // DB unreachable or not migrated
  }

  const authSecret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  return NextResponse.json({
    authSecretSet: !!authSecret,
    authSecretSource: authSecret
      ? process.env.AUTH_SECRET?.trim()
        ? "AUTH_SECRET"
        : "NEXTAUTH_SECRET"
      : "none — set AUTH_SECRET in Vercel (32+ chars) and redeploy",
    authTrustHost: process.env.AUTH_TRUST_HOST ?? "not set (OK on Vercel if VERCEL=1)",
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "not set",
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "not set",
    db: dbStatus,
  });
}
