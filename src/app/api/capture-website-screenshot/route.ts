import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import {
  db,
  ProjectRole,
  ScreenshotCaptureStatus,
  type ShareLink,
} from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { coerceSessionRole } from "@/lib/auth/session-role";

/** Full-page ScreenshotOne + sharp + disk can exceed default limits. */
export const maxDuration = 120;

const SCREENSHOTONE_TAKE = "https://api.screenshotone.com/take";

type Body = {
  reviewRevisionId?: unknown;
  reviewItemId?: unknown;
  guestToken?: unknown;
  shareToken?: unknown;
};

function truncateMsg(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

type CaptureAuthInput = {
  reviewRevisionId: string;
  reviewItemIdLog?: string;
  guestToken: string | null;
  shareToken: string | null;
};

function loadRevisionWithItem(reviewRevisionId: string) {
  return db.reviewRevision.findUnique({
    where: { id: reviewRevisionId },
    include: {
      reviewItem: {
        include: {
          project: {
            include: { members: true },
          },
        },
      },
    },
  });
}

async function loadAuthorizedRevisionForCapture(
  input: CaptureAuthInput
): Promise<
  | {
      ok: true;
      revision: NonNullable<Awaited<ReturnType<typeof loadRevisionWithItem>>>;
    }
  | { ok: false; response: NextResponse }
> {
  const { reviewRevisionId, reviewItemIdLog, guestToken, shareToken } = input;

  const session = await auth();
  let guestMode = false;
  let actorId: string | null = null;
  let shareLinkForGuest: ShareLink | null = null;

  if (session?.user?.id) {
    const actor = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });
    if (!actor?.isActive) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Your session is out of date (user not found). Sign out and sign in again.",
          },
          { status: 401 }
        ),
      };
    }
    actorId = actor.id;
  } else {
    if (!guestToken || !shareToken) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    guestMode = true;

    const shareLink = await db.shareLink.findUnique({
      where: { token: shareToken },
    });
    if (!shareLink) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid share link" }, { status: 404 }),
      };
    }
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Share link has expired" }, { status: 410 }),
      };
    }
    if (!shareLink.allowGuestComments) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Guest commenting is not enabled for this link" },
          { status: 403 }
        ),
      };
    }

    const guest = await db.guestIdentity.findUnique({
      where: { accessToken: guestToken },
    });
    if (!guest) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid guest token" }, { status: 401 }),
      };
    }
    shareLinkForGuest = shareLink;
  }

  const revision = await loadRevisionWithItem(reviewRevisionId);

  if (!revision) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Review revision not found" }, { status: 404 }),
    };
  }

  if (reviewItemIdLog && reviewItemIdLog !== revision.reviewItemId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "reviewItemId does not match this revision" },
        { status: 400 }
      ),
    };
  }

  if (guestMode) {
    const shareLink = shareLinkForGuest!;
    if (shareLink.reviewItemId && shareLink.reviewItemId !== revision.reviewItemId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Review item not accessible via this link" },
          { status: 403 }
        ),
      };
    }
    if (shareLink.projectId) {
      if (revision.reviewItem.projectId !== shareLink.projectId) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Review item not accessible via this link" },
            { status: 403 }
          ),
        };
      }
    }
    if (
      !Permissions.canCreateComment(
        null,
        null,
        revision.reviewItem.guestCommentingEnabled,
        true
      )
    ) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  } else {
    const userMembership = revision.reviewItem.project.members.find(
      (m) => m.userId === actorId
    );
    const userRole = coerceSessionRole(session!.user!.role);
    if (
      !Permissions.canCreateComment(
        userRole,
        userMembership?.roleInProject as ProjectRole | null,
        revision.reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true, revision };
}

/** Read-only status for polling (same auth as POST, no mutations). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewRevisionId = searchParams.get("reviewRevisionId")?.trim() ?? "";
    if (!reviewRevisionId) {
      return NextResponse.json(
        { error: "reviewRevisionId is required" },
        { status: 400 }
      );
    }
    const reviewItemIdLog = searchParams.get("reviewItemId")?.trim() || undefined;
    const guestToken = searchParams.get("guestToken")?.trim() || null;
    const shareToken = searchParams.get("shareToken")?.trim() || null;

    const authz = await loadAuthorizedRevisionForCapture({
      reviewRevisionId,
      reviewItemIdLog,
      guestToken,
      shareToken,
    });
    if (!authz.ok) return authz.response;

    const { revision } = authz;
    return NextResponse.json({
      status: revision.screenshotStatus,
      snapshotPath: revision.snapshotPath,
      error: revision.screenshotError,
    });
  } catch (e) {
    console.error("[capture-website-screenshot] GET exception:", e);
    return NextResponse.json({ error: "Failed to load capture status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let lockedRevisionId: string | null = null;

  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const reviewRevisionId =
      typeof body.reviewRevisionId === "string" ? body.reviewRevisionId.trim() : "";
    if (!reviewRevisionId) {
      return NextResponse.json(
        { error: "reviewRevisionId is required" },
        { status: 400 }
      );
    }

    const reviewItemIdLog =
      typeof body.reviewItemId === "string" ? body.reviewItemId.trim() : undefined;

    const guestToken =
      typeof body.guestToken === "string" ? body.guestToken.trim() || null : null;
    const shareToken =
      typeof body.shareToken === "string" ? body.shareToken.trim() || null : null;

    const authz = await loadAuthorizedRevisionForCapture({
      reviewRevisionId,
      reviewItemIdLog,
      guestToken,
      shareToken,
    });
    if (!authz.ok) return authz.response;
    const { revision } = authz;

    const urlRaw =
      revision.sourceUrl?.trim() || revision.reviewItem.sourceUrl?.trim() || "";
    if (!urlRaw) {
      return NextResponse.json(
        { error: "No source URL to capture for this revision" },
        { status: 400 }
      );
    }

    let target: URL;
    try {
      target = new URL(urlRaw);
    } catch {
      return NextResponse.json({ error: "sourceUrl is not a valid URL" }, { status: 400 });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json(
        { error: "sourceUrl must use http:// or https://" },
        { status: 400 }
      );
    }

    if (revision.screenshotStatus === ScreenshotCaptureStatus.READY) {
      return NextResponse.json({
        status: "READY" as const,
        snapshotPath: revision.snapshotPath ?? "",
      });
    }

    if (revision.screenshotStatus === ScreenshotCaptureStatus.CAPTURING) {
      return NextResponse.json({ status: "CAPTURING" as const }, { status: 202 });
    }

    const lock = await db.reviewRevision.updateMany({
      where: {
        id: reviewRevisionId,
        screenshotStatus: {
          in: [ScreenshotCaptureStatus.PENDING, ScreenshotCaptureStatus.FAILED],
        },
      },
      data: {
        screenshotStatus: ScreenshotCaptureStatus.CAPTURING,
        screenshotError: null,
      },
    });

    if (lock.count === 0) {
      const again = await db.reviewRevision.findUnique({
        where: { id: reviewRevisionId },
        select: { screenshotStatus: true, snapshotPath: true },
      });
      if (again?.screenshotStatus === ScreenshotCaptureStatus.READY) {
        return NextResponse.json({
          status: "READY" as const,
          snapshotPath: again.snapshotPath ?? "",
        });
      }
      if (again?.screenshotStatus === ScreenshotCaptureStatus.CAPTURING) {
        return NextResponse.json({ status: "CAPTURING" as const }, { status: 202 });
      }
      return NextResponse.json(
        { error: "Could not start capture; try again shortly." },
        { status: 409 }
      );
    }

    lockedRevisionId = reviewRevisionId;

    const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY?.trim();
    if (!accessKey) {
      console.error("[capture-website-screenshot] SCREENSHOTONE_ACCESS_KEY is not set");
      await db.reviewRevision.update({
        where: { id: reviewRevisionId },
        data: {
          screenshotStatus: ScreenshotCaptureStatus.FAILED,
          screenshotError: truncateMsg(
            "Server misconfiguration: SCREENSHOTONE_ACCESS_KEY is missing",
            500
          ),
        },
      });
      return NextResponse.json(
        { status: "FAILED" as const, error: "Screenshot service not configured" },
        { status: 500 }
      );
    }

    const logUrl = urlRaw.length > 100 ? `${urlRaw.slice(0, 100)}…` : urlRaw;
    console.log("[capture-website-screenshot] start", {
      reviewRevisionId,
      reviewItemId: reviewItemIdLog ?? revision.reviewItemId,
      url: logUrl,
    });

    const params = new URLSearchParams({
      access_key: accessKey,
      url: target.toString(),
      viewport_width: "1280",
      viewport_height: "900",
      format: "png",
      full_page: "true",
      delay: "2",
      block_ads: "true",
      block_cookie_banners: "true",
      block_trackers: "true",
      cache: "true",
      cache_ttl: "14400",
    });

    const takeUrl = `${SCREENSHOTONE_TAKE}?${params.toString()}`;

    const res = await fetch(takeUrl, {
      method: "GET",
      signal: AbortSignal.timeout(90_000),
    });

    const contentType = res.headers.get("content-type") || "";
    const contentLength = res.headers.get("content-length");
    console.log(
      "[capture-website-screenshot] screenshotone status",
      res.status,
      contentType,
      contentLength ?? "?"
    );

    if (!res.ok || !contentType.startsWith("image/")) {
      const detail = truncateMsg(await res.text(), 500);
      const errMsg = `${res.status}: ${detail || "(empty body)"}`;
      console.error("[capture-website-screenshot] ScreenshotOne failure:", errMsg.slice(0, 200));
      await db.reviewRevision.update({
        where: { id: reviewRevisionId },
        data: {
          screenshotStatus: ScreenshotCaptureStatus.FAILED,
          screenshotError: truncateMsg(errMsg, 500),
        },
      });
      lockedRevisionId = null;
      return NextResponse.json(
        { status: "FAILED" as const, error: "Screenshot service failed" },
        { status: 502 }
      );
    }

    const fullPageBuffer = Buffer.from(await res.arrayBuffer());

    let outBuffer: Buffer = fullPageBuffer;
    try {
      outBuffer = await sharp(fullPageBuffer).png().toBuffer();
    } catch (normErr) {
      console.error("[capture-website-screenshot] sharp normalize skipped:", normErr);
    }

    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "screenshots"
    );
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `fullpage-${reviewRevisionId}-${Date.now()}.png`;
    const absPath = path.join(uploadsDir, filename);
    await fs.writeFile(absPath, outBuffer);

    const relativePath = `/screenshots/${filename}`;

    console.log("[capture-website-screenshot] saved", {
      path: relativePath,
      bytes: outBuffer.byteLength,
    });

    await db.reviewRevision.update({
      where: { id: reviewRevisionId },
      data: {
        snapshotPath: relativePath,
        screenshotStatus: ScreenshotCaptureStatus.READY,
        screenshotCapturedAt: new Date(),
        screenshotError: null,
      },
    });

    lockedRevisionId = null;

    return NextResponse.json({
      status: "READY" as const,
      snapshotPath: relativePath,
    });
  } catch (e) {
    console.error("[capture-website-screenshot] exception:", e);
    const stack = e instanceof Error ? e.stack : undefined;
    if (stack) console.error(stack);

    const message = truncateMsg(
      e instanceof Error ? e.message : String(e),
      500
    );

    if (lockedRevisionId) {
      try {
        await db.reviewRevision.update({
          where: { id: lockedRevisionId },
          data: {
            screenshotStatus: ScreenshotCaptureStatus.FAILED,
            screenshotError: message,
          },
        });
      } catch (dbErr) {
        console.error(
          "[capture-website-screenshot] failed to persist FAILED status:",
          dbErr
        );
      }
    }

    return NextResponse.json(
      { status: "FAILED" as const, error: message || "Capture failed" },
      { status: 500 }
    );
  }
}
