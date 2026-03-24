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

  return NextResponse.json({
    authSecretSet: !!process.env.AUTH_SECRET,
    authTrustHost: process.env.AUTH_TRUST_HOST ?? "not set",
    authUrl: process.env.AUTH_URL ?? "not set",
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "not set",
    db: dbStatus,
  });
}
