import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ProjectRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { coerceSessionRole } from "@/lib/auth/session-role";
import { saveContextPngFromBase64 } from "@/lib/server/save-context-screenshot";

/** ScreenshotOne + disk write can exceed default limits on some hosts. */
export const maxDuration = 60;

const SCREENSHOTONE_TAKE = "https://api.screenshotone.com/take";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

type Body = {
  url?: unknown;
  viewportWidth?: unknown;
  viewportHeight?: unknown;
  scrollY?: unknown;
  pinXPercent?: unknown;
  pinYPercent?: unknown;
  reviewItemId?: unknown;
  reviewRevisionId?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });
    if (!actor?.isActive) {
      return NextResponse.json(
        {
          error:
            "Your session is out of date (user not found). Sign out and sign in again.",
        },
        { status: 401 }
      );
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const urlRaw = typeof body.url === "string" ? body.url.trim() : "";
    if (!urlRaw) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(urlRaw);
    } catch {
      return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json(
        { error: "url must use http:// or https://" },
        { status: 400 }
      );
    }

    const reviewItemId =
      typeof body.reviewItemId === "string" ? body.reviewItemId.trim() : "";
    if (!reviewItemId) {
      return NextResponse.json({ error: "reviewItemId is required" }, { status: 400 });
    }

    const vwIn = Number(body.viewportWidth);
    const vhIn = Number(body.viewportHeight);
    const scrollYIn = Number(body.scrollY);
    const pinXIn = Number(body.pinXPercent);
    const pinYIn = Number(body.pinYPercent);

    if (!Number.isFinite(vwIn) || !Number.isFinite(vhIn)) {
      return NextResponse.json(
        { error: "viewportWidth and viewportHeight must be numbers" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(scrollYIn)) {
      return NextResponse.json({ error: "scrollY must be a number" }, { status: 400 });
    }
    if (!Number.isFinite(pinXIn) || !Number.isFinite(pinYIn)) {
      return NextResponse.json(
        { error: "pinXPercent and pinYPercent must be numbers" },
        { status: 400 }
      );
    }

    const viewportWidth = Math.max(1, Math.min(1920, Math.round(vwIn)));
    const viewportHeight = Math.max(1, Math.min(1080, Math.round(vhIn)));
    const scrollY = Math.max(0, Math.round(scrollYIn));
    const pinInCropX = clamp(pinXIn, 0, 1);
    const pinInCropY = clamp(pinYIn, 0, 1);

    let reviewRevisionId: string | undefined;
    if (body.reviewRevisionId !== undefined && body.reviewRevisionId !== null) {
      if (typeof body.reviewRevisionId !== "string" || !body.reviewRevisionId.trim()) {
        return NextResponse.json(
          { error: "reviewRevisionId must be a non-empty string when provided" },
          { status: 400 }
        );
      }
      reviewRevisionId = body.reviewRevisionId.trim();
    }

    const reviewItem = await db.reviewItem.findUnique({
      where: { id: reviewItemId },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!reviewItem) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    const userMembership = reviewItem.project.members.find(
      (m) => m.userId === actor.id
    );

    const userRole = coerceSessionRole(session.user.role);
    if (
      !Permissions.canCreateComment(
        userRole,
        userMembership?.roleInProject as ProjectRole | null,
        reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (reviewRevisionId) {
      const rev = await db.reviewRevision.findFirst({
        where: { id: reviewRevisionId, reviewItemId },
        select: { id: true },
      });
      if (!rev) {
        return NextResponse.json(
          {
            error:
              "This revision is no longer valid for this review item. Refresh the page and try again.",
          },
          { status: 400 }
        );
      }
    }

    const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY?.trim();
    if (!accessKey) {
      console.error("[pin-screenshot] SCREENSHOTONE_ACCESS_KEY is not set");
      return NextResponse.json(
        { error: "Server misconfiguration: SCREENSHOTONE_ACCESS_KEY is missing" },
        { status: 500 }
      );
    }

    const logUrl = urlRaw.length > 100 ? `${urlRaw.slice(0, 100)}…` : urlRaw;
    console.log("[pin-screenshot] start", { reviewItemId, url: logUrl });

    const params = new URLSearchParams({
      access_key: accessKey,
      url: target.toString(),
      viewport_width: String(viewportWidth),
      viewport_height: String(viewportHeight),
      format: "png",
      full_page: "false",
      delay: "2",
      block_ads: "true",
      block_cookie_banners: "true",
      block_trackers: "true",
      cache: "true",
      cache_ttl: "14400",
      clip_x: "0",
      clip_y: String(scrollY),
      clip_width: String(viewportWidth),
      clip_height: String(viewportHeight),
    });

    const takeUrl = `${SCREENSHOTONE_TAKE}?${params.toString()}`;

    const res = await fetch(takeUrl, {
      method: "GET",
      signal: AbortSignal.timeout(45_000),
    });

    const contentType = res.headers.get("content-type") || "";
    const len = res.headers.get("content-length");
    console.log(
      "[pin-screenshot] ScreenshotOne status:",
      res.status,
      "content-type:",
      contentType,
      "content-length:",
      len ?? "?"
    );

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 2000);
      console.error("[pin-screenshot] ScreenshotOne error body snippet:", detail.slice(0, 500));
      return NextResponse.json(
        {
          error: "Screenshot service failed",
          status: res.status,
          detail,
        },
        { status: 502 }
      );
    }

    if (!contentType.startsWith("image/")) {
      const detail = (await res.text()).slice(0, 2000);
      console.error("[pin-screenshot] non-image response:", detail.slice(0, 500));
      return NextResponse.json(
        {
          error: "Screenshot service failed",
          status: res.status,
          detail,
        },
        { status: 502 }
      );
    }

    const buf = await res.arrayBuffer();
    console.log("[pin-screenshot] image bytes:", buf.byteLength);

    const b64 = Buffer.from(buf).toString("base64");
    const dataUrl = `data:image/png;base64,${b64}`;

    const saved = await saveContextPngFromBase64(dataUrl);
    if (!saved.ok) {
      console.error("[pin-screenshot] saveContextPngFromBase64:", saved.error);
      return NextResponse.json(
        { error: saved.error || "Failed to save screenshot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      screenshotContextPath: saved.relativePath,
      pinInCropX,
      pinInCropY,
    });
  } catch (e) {
    console.error("[pin-screenshot] exception:", e);
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    if (stack) console.error(stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
