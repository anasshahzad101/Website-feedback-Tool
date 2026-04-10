import type { NextRequest } from "next/server";

/**
 * Origin the browser should use for absolute URLs (e.g. `/api/proxy?url=…` in rewritten HTML).
 * Behind OpenLiteSpeed/Nginx, `req.nextUrl` is often the internal Node listener
 * (`http://127.0.0.1:3000`), which breaks iframe navigations and assets if embedded in links.
 */
export function publicRequestOrigin(req: NextRequest): string {
  const fromEnv = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ];
  for (const raw of fromEnv) {
    const trimmed = raw?.trim().replace(/\/$/, "");
    if (!trimmed) continue;
    try {
      return new URL(trimmed).origin;
    } catch {
      continue;
    }
  }

  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    ?.trim();
  if (host) {
    const protoHeader = req.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    let scheme: string;
    if (protoHeader === "https" || protoHeader === "http") {
      scheme = protoHeader;
    } else if (process.env.NODE_ENV === "production") {
      scheme = "https";
    } else {
      scheme = req.nextUrl.protocol.replace(":", "") || "http";
    }
    return `${scheme}://${host}`;
  }

  return req.nextUrl.origin;
}
