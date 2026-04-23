import { NextRequest, NextResponse } from "next/server";

const SCREENSHOTONE_TAKE = "https://api.screenshotone.com/take";

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing required query parameter: url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json(
      { error: "URL must use http:// or https://" },
      { status: 400 }
    );
  }

  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY?.trim();
  if (!accessKey) {
    console.error("[screenshot-test] SCREENSHOTONE_ACCESS_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: SCREENSHOTONE_ACCESS_KEY is missing" },
      { status: 500 }
    );
  }

  const secretKey = process.env.SCREENSHOTONE_SECRET_KEY?.trim();
  if (secretKey) {
    console.log("[screenshot-test] SCREENSHOTONE_SECRET_KEY is set (not used for this unsigned test route)");
  }

  const takeParams = new URLSearchParams({
    access_key: accessKey,
    url: target.toString(),
    viewport_width: "1280",
    viewport_height: "900",
    format: "png",
    full_page: "false",
    block_ads: "true",
    block_cookie_banners: "true",
    cache: "false",
  });

  const takeUrl = `${SCREENSHOTONE_TAKE}?${takeParams.toString()}`;
  console.log("[screenshot-test] Calling ScreenshotOne take for url:", target.toString());

  try {
    const res = await fetch(takeUrl, {
      method: "GET",
      signal: AbortSignal.timeout(30_000),
    });

    const contentType = res.headers.get("content-type") || "";
    console.log(
      "[screenshot-test] ScreenshotOne response status:",
      res.status,
      "content-type:",
      contentType
    );

    if (contentType.startsWith("image/")) {
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "content-type": contentType.split(";")[0]?.trim() || "image/png",
          "cache-control": "no-store",
        },
      });
    }

    const bodyText = await res.text();
    const snippet = bodyText.slice(0, 500);
    console.error(
      "[screenshot-test] ScreenshotOne returned non-image body (first 500 chars):",
      snippet
    );
    return NextResponse.json(
      {
        error: "ScreenshotOne did not return an image",
        screenshotOneStatus: res.status,
        bodySnippet: snippet,
      },
      { status: 502 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[screenshot-test] Exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
