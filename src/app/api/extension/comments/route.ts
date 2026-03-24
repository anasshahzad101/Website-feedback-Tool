import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import path from "path";
import fs from "fs/promises";

// Helper to save a data: URL to /public/uploads/{subdir}/...
async function saveDataUrlToUploads(dataUrl: string, subdir: string): Promise<string> {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const contentType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");

  const ext =
    contentType.includes("png") ? "png" :
    contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" :
    contentType.includes("webm") ? "webm" :
    contentType.includes("pdf") ? "pdf" :
    "bin";

  const uploadsDir = path.join(process.cwd(), "public", "uploads", subdir);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${subdir}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);

  // Return path relative to /public/uploads
  return `/${subdir}/${filename}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      apiToken,
      projectId,
      pageUrl,
      pageTitle,
      sectionPath,
      viewport,
      click,
      screenshot,
      commentText,
      attachments = [],
    } = body;

    if (!apiToken || !projectId || !pageUrl) {
      return NextResponse.json(
        { error: "apiToken, projectId and pageUrl are required" },
        { status: 400 }
      );
    }

    // Look up user by api_token (raw SQL so we don't depend on generated client having apiToken)
    const userRows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE api_token = ${apiToken}`;
    const user = userRows[0] ?? null;

    if (!user) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find or create review item for this page
    let reviewItem = await db.reviewItem.findFirst({
      where: {
        projectId,
        type: "WEBSITE",
        sourceUrl: pageUrl,
      },
    });

    if (!reviewItem) {
      reviewItem = await db.reviewItem.create({
        data: {
          projectId,
          type: "WEBSITE",
          title: pageTitle || pageUrl,
          sourceUrl: pageUrl,
          reviewMode: "SCREENSHOT_CAPTURE",
          createdById: user.id,
        },
      });
    }

    // Save screenshot (viewport) if provided
    let screenshotPath: string | null = null;
    if (screenshot) {
      screenshotPath = await saveDataUrlToUploads(screenshot, "screenshots");
    }

    const viewportMetaJson =
      viewport && typeof viewport === "object" ? JSON.stringify(viewport) : null;

    const width = viewport?.width ?? 0;
    const height = viewport?.height ?? 0;
    const x = click?.x ?? 0;
    const y = click?.y ?? 0;
    const xPercent = width ? x / width : 0;
    const yPercent = height ? y / height : 0;

    // Create annotation for this pin
    const annotation = await db.annotation.create({
      data: {
        reviewItemId: reviewItem.id,
        annotationType: "PIN",
        x,
        y,
        xPercent,
        yPercent,
        screenshotContextPath: screenshotPath,
        viewportMetaJson: viewportMetaJson ?? undefined,
        color: "#3b82f6",
        createdByUserId: user.id,
      },
    });

    // Build first message body (CommentThread has no pageUrl/pageTitle/sectionPath; no commentAttachment model)
    let messageBody = (commentText || "").trim();
    const contextParts: string[] = [];
    if (pageTitle) contextParts.push(`Page: ${pageTitle}`);
    if (sectionPath) contextParts.push(`Section: ${sectionPath}`);
    if (pageUrl) contextParts.push(`URL: ${pageUrl}`);
    if (contextParts.length) {
      messageBody = `${contextParts.join("\n")}\n\n${messageBody}`.trim();
    }

    for (const att of attachments) {
      if (!att?.dataUrl) continue;
      const filePath = await saveDataUrlToUploads(att.dataUrl, "attachments");
      const name = att.fileName || "attachment";
      messageBody += `\n\n[${name}](${filePath})`;
    }

    const thread = await db.commentThread.create({
      data: {
        reviewItemId: reviewItem.id,
        rootAnnotationId: annotation.id,
        createdByUserId: user.id,
        status: "OPEN",
        messages: {
          create: {
            body: messageBody,
            createdByUserId: user.id,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      reviewItemId: reviewItem.id,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("Extension comment error:", error);
    return NextResponse.json(
      { error: "Failed to handle extension comment" },
      { status: 500 }
    );
  }
}

