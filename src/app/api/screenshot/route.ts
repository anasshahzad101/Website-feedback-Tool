import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import path from "path";
import fs from "fs/promises";

// POST /api/screenshot - Capture a screenshot of a URL and store it
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, reviewItemId, revisionId } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Use microlink.io free API — WITHOUT embed= so we get JSON back with the screenshot URL
    const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false&waitFor=2000`;

    const microlinkRes = await fetch(microlinkUrl, {
      headers: { "User-Agent": "ClickTrack-Feedback-Tool/1.0" },
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

    // Download the screenshot image
    const imgRes = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(20000),
    });

    if (!imgRes.ok) {
      throw new Error(`Failed to download screenshot image: ${imgRes.status}`);
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : "png";

    // Save to public/uploads/screenshots so Next.js serves files at /uploads/screenshots/...
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "screenshots");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, imgBuffer);

    const relPath = `/screenshots/${filename}`;

    // Update the review item and/or revision with the screenshot path
    if (reviewItemId) {
      await db.reviewItem.update({
        where: { id: reviewItemId },
        data: { uploadedFilePath: relPath, thumbnailPath: relPath },
      });
    }

    if (revisionId) {
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
