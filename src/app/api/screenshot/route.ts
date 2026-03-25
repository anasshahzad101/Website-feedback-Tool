import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import path from "path";
import fs from "fs/promises";

async function saveScreenshotBuffer(
  imgBuffer: Buffer,
  filenamePrefix: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "screenshots");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${filenamePrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, imgBuffer);
  return `/screenshots/${filename}`;
}

// POST /api/screenshot — full URL capture (Microlink), or client-provided PNG for annotation context
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      url,
      reviewItemId,
      revisionId,
      imageBase64,
      contextOnly,
    } = body as {
      url?: string;
      reviewItemId?: string;
      revisionId?: string;
      imageBase64?: string;
      contextOnly?: boolean;
    };

    const skipAssetUpdate = contextOnly === true;

    // Client-captured viewport / crop (PNG data URL or raw base64)
    if (typeof imageBase64 === "string" && imageBase64.trim().length > 0) {
      let payload = imageBase64.trim();
      const dataUrlMatch = payload.match(/^data:image\/\w+;base64,(.+)$/i);
      if (dataUrlMatch) payload = dataUrlMatch[1]!;

      let buf: Buffer;
      try {
        buf = Buffer.from(payload, "base64");
      } catch {
        return NextResponse.json({ error: "Invalid base64 image" }, { status: 400 });
      }
      if (buf.length > 6 * 1024 * 1024) {
        return NextResponse.json({ error: "Image too large" }, { status: 400 });
      }

      const relPath = await saveScreenshotBuffer(buf, "context");

      // Never write client-provided PNGs onto the review item or revision.
      // Those belong on annotations (screenshotContextPath) only. Updating the
      // asset here could replace the main review screenshot. Microlink URL
      // captures below still update assets when reviewItemId/revisionId are sent.
      return NextResponse.json({ screenshotPath: relPath });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL or imageBase64 is required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false&waitFor=2000`;

    const microlinkRes = await fetch(microlinkUrl, {
      headers: { "User-Agent": "WebsiteFeedback-Tool/1.0" },
      signal: AbortSignal.timeout(35000),
    });

    if (!microlinkRes.ok) {
      throw new Error(`Microlink API error: ${microlinkRes.status}`);
    }

    const microlinkData = await microlinkRes.json();
    const screenshotUrl = microlinkData?.data?.screenshot?.url;

    if (!screenshotUrl) {
      console.error("Microlink response:", JSON.stringify(microlinkData).slice(0, 300));
      return NextResponse.json(
        { error: "Failed to capture screenshot. The website may be unavailable or blocked." },
        { status: 422 }
      );
    }

    const imgRes = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(20000),
    });

    if (!imgRes.ok) {
      throw new Error(`Failed to download screenshot image: ${imgRes.status}`);
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : "png";

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "screenshots");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, imgBuffer);

    const relPath = `/screenshots/${filename}`;

    if (!skipAssetUpdate && reviewItemId) {
      await db.reviewItem.update({
        where: { id: reviewItemId },
        data: { uploadedFilePath: relPath, thumbnailPath: relPath },
      });
    }

    if (!skipAssetUpdate && revisionId) {
      await db.reviewRevision.update({
        where: { id: revisionId },
        data: { snapshotPath: relPath },
      });
    }

    return NextResponse.json({ screenshotPath: relPath, screenshotUrl });
  } catch (error) {
    console.error("Screenshot capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture screenshot. Please try again." },
      { status: 500 }
    );
  }
}
