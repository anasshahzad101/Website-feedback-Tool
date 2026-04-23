import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { ScreenshotCaptureStatus } from "@/lib/db/client";
import { loadAuthorizedRevisionForCapture } from "@/lib/server/review-auth";

export const maxDuration = 60;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

type Body = {
  reviewRevisionId?: unknown;
  reviewItemId?: unknown;
  guestToken?: unknown;
  shareToken?: unknown;
  pinXPercent?: unknown;
  pinYPercent?: unknown;
  desiredCropWidth?: unknown;
  desiredCropHeight?: unknown;
};

export async function POST(request: NextRequest) {
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

    const pinXIn = Number(body.pinXPercent);
    const pinYIn = Number(body.pinYPercent);
    if (!Number.isFinite(pinXIn) || !Number.isFinite(pinYIn)) {
      return NextResponse.json(
        { error: "pinXPercent and pinYPercent must be numbers" },
        { status: 400 }
      );
    }
    if (pinXIn < 0 || pinXIn > 1 || pinYIn < 0 || pinYIn > 1) {
      return NextResponse.json(
        { error: "pinXPercent and pinYPercent must be between 0 and 1" },
        { status: 400 }
      );
    }

    let desiredCropWidth = 1280;
    let desiredCropHeight = 900;
    if (body.desiredCropWidth !== undefined) {
      const w = Number(body.desiredCropWidth);
      if (!Number.isFinite(w) || w <= 0) {
        return NextResponse.json(
          { error: "desiredCropWidth must be a positive number" },
          { status: 400 }
        );
      }
      desiredCropWidth = Math.round(w);
    }
    if (body.desiredCropHeight !== undefined) {
      const h = Number(body.desiredCropHeight);
      if (!Number.isFinite(h) || h <= 0) {
        return NextResponse.json(
          { error: "desiredCropHeight must be a positive number" },
          { status: 400 }
        );
      }
      desiredCropHeight = Math.round(h);
    }

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

    if (
      revision.screenshotStatus !== ScreenshotCaptureStatus.READY ||
      !revision.snapshotPath?.trim()
    ) {
      return NextResponse.json(
        { error: "Website screenshot is not ready yet" },
        { status: 409 }
      );
    }

    const snapshotPath = revision.snapshotPath.trim();
    if (!snapshotPath.startsWith("/screenshots/")) {
      console.error("[pin-crop] invalid snapshot path shape:", snapshotPath);
      return NextResponse.json({ error: "Invalid snapshot path" }, { status: 500 });
    }

    const basename = path.basename(snapshotPath);
    const fullPath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "screenshots",
      basename
    );

    console.log("[pin-crop] start", {
      reviewRevisionId,
      snapshotPath,
      pinXPercent: pinXIn,
      pinYPercent: pinYIn,
    });

    let meta: sharp.Metadata;
    try {
      meta = await sharp(fullPath).metadata();
    } catch (e) {
      console.error("[pin-crop] sharp metadata failed:", e);
      return NextResponse.json(
        { error: "Could not read website screenshot file" },
        { status: 500 }
      );
    }

    const fullW = meta.width ?? 0;
    const fullH = meta.height ?? 0;
    if (fullW < 1 || fullH < 1) {
      return NextResponse.json(
        { error: "Invalid image dimensions" },
        { status: 500 }
      );
    }

    const pinAbsX = pinXIn * fullW;
    const pinAbsY = pinYIn * fullH;

    let cropW = Math.min(desiredCropWidth, fullW);
    let cropH = Math.min(desiredCropHeight, fullH);
    cropW = Math.max(1, Math.round(cropW));
    cropH = Math.max(1, Math.round(cropH));

    let cropLeft = Math.round(pinAbsX - cropW / 2);
    let cropTop = Math.round(pinAbsY - cropH / 2);

    cropLeft = Math.max(0, Math.min(cropLeft, fullW - cropW));
    cropTop = Math.max(0, Math.min(cropTop, fullH - cropH));

    if (cropLeft + cropW > fullW) cropLeft = Math.max(0, fullW - cropW);
    if (cropTop + cropH > fullH) cropTop = Math.max(0, fullH - cropH);

    const pinInCropX = clamp01((pinAbsX - cropLeft) / cropW);
    const pinInCropY = clamp01((pinAbsY - cropTop) / cropH);

    let croppedBuffer: Buffer;
    try {
      croppedBuffer = await sharp(fullPath)
        .extract({
          left: cropLeft,
          top: cropTop,
          width: cropW,
          height: cropH,
        })
        .png()
        .toBuffer();
    } catch (e) {
      console.error("[pin-crop] sharp extract failed:", e);
      return NextResponse.json(
        { error: "Failed to crop screenshot" },
        { status: 500 }
      );
    }

    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "screenshots"
    );
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `context-${randomUUID()}.png`;
    const outPath = path.join(uploadsDir, filename);
    await fs.writeFile(outPath, croppedBuffer);

    const relativePath = `/screenshots/${filename}`;

    console.log("[pin-crop] saved", {
      path: relativePath,
      bytes: croppedBuffer.byteLength,
      pinInCropX,
      pinInCropY,
    });

    return NextResponse.json({
      screenshotContextPath: relativePath,
      pinInCropX,
      pinInCropY,
    });
  } catch (e) {
    console.error("[pin-crop] exception:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pin crop failed" },
      { status: 500 }
    );
  }
}
