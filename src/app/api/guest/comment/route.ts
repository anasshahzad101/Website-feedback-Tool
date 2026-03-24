import { NextRequest, NextResponse } from "next/server";
import { db, ActivityActionType } from "@/lib/db/client";
import { z } from "zod";

const guestCommentSchema = z.object({
  shareToken: z.string(),
  guestToken: z.string(),
  reviewItemId: z.string(),
  reviewRevisionId: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  annotation: z.object({
    annotationType: z.enum(["PIN", "RECTANGLE", "ARROW", "FREEHAND", "TEXT"]),
    x: z.number(),
    y: z.number(),
    xPercent: z.number(),
    yPercent: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    widthPercent: z.number().optional(),
    heightPercent: z.number().optional(),
    pointsJson: z.string().optional(),
    targetTimestampMs: z.number().optional(),
    color: z.string(),
  }).optional(),
});

// POST /api/guest/comment - Submit a guest comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = guestCommentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const {
      shareToken,
      guestToken,
      reviewItemId,
      reviewRevisionId,
      message,
      annotation,
    } = validated.data;

    // Validate share token
    const shareLink = await db.shareLink.findUnique({
      where: { token: shareToken },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 404 });
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    if (!shareLink.allowGuestComments) {
      return NextResponse.json(
        { error: "Guest commenting is not enabled for this link" },
        { status: 403 }
      );
    }

    // Verify guest identity
    const guest = await db.guestIdentity.findUnique({
      where: { accessToken: guestToken },
    });

    if (!guest) {
      return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
    }

    // Verify review item access
    if (shareLink.reviewItemId && shareLink.reviewItemId !== reviewItemId) {
      return NextResponse.json(
        { error: "Review item not accessible via this link" },
        { status: 403 }
      );
    }

    if (shareLink.projectId) {
      const reviewItem = await db.reviewItem.findUnique({
        where: { id: reviewItemId },
      });
      if (!reviewItem || reviewItem.projectId !== shareLink.projectId) {
        return NextResponse.json(
          { error: "Review item not accessible via this link" },
          { status: 403 }
        );
      }
    }

    // Create comment thread and message in transaction
    const result = await db.$transaction(async (tx) => {
      let annotationId: string | undefined;

      // Create annotation if provided
      if (annotation) {
        const createdAnnotation = await tx.annotation.create({
          data: {
            reviewItemId,
            reviewRevisionId,
            annotationType: annotation.annotationType,
            x: annotation.x,
            y: annotation.y,
            xPercent: annotation.xPercent,
            yPercent: annotation.yPercent,
            width: annotation.width,
            height: annotation.height,
            widthPercent: annotation.widthPercent,
            heightPercent: annotation.heightPercent,
            pointsJson: annotation.pointsJson,
            targetTimestampMs: annotation.targetTimestampMs,
            color: annotation.color,
            createdByGuestId: guest.id,
          },
        });
        annotationId = createdAnnotation.id;
      }

      // Create comment thread
      const thread = await tx.commentThread.create({
        data: {
          reviewItemId,
          reviewRevisionId,
          rootAnnotationId: annotationId,
          status: "OPEN",
          createdByGuestId: guest.id,
        },
      });

      // Update annotation with thread link
      if (annotationId) {
        await tx.annotation.update({
          where: { id: annotationId },
          data: { commentThreadId: thread.id },
        });
      }

      // Create message
      const commentMessage = await tx.commentMessage.create({
        data: {
          threadId: thread.id,
          body: message,
          createdByGuestId: guest.id,
        },
      });

      return { thread, commentMessage, annotationId };
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItemId,
        actionType: ActivityActionType.GUEST_COMMENT_SUBMITTED,
        actorGuestId: guest.id,
        metaJson: JSON.stringify({
          threadId: result.thread.id,
          guestName: guest.name,
          hasAnnotation: !!annotation,
        }),
      },
    });

    return NextResponse.json(
      {
        thread: result.thread,
        message: result.commentMessage,
        annotationId: result.annotationId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting guest comment:", error);
    return NextResponse.json(
      { error: "Failed to submit comment" },
      { status: 500 }
    );
  }
}
