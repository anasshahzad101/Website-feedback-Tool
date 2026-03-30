import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ActivityActionType, CommentStatus } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { commentThreadSchema, commentReplySchema, updateThreadStatusSchema } from "@/lib/validations/comment";
import { saveContextPngFromBase64 } from "@/lib/server/save-context-screenshot";

// GET /api/comments - List comment threads
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewItemId = searchParams.get("reviewItemId");

    if (!reviewItemId) {
      return NextResponse.json(
        { error: "reviewItemId is required" },
        { status: 400 }
      );
    }

    // Check access
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
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canAccessAdminPanel(session.user.role as UserRole) &&
      !userMembership
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const threads = await db.commentThread.findMany({
      where: { reviewItemId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            createdByUser: {
              select: { firstName: true, lastName: true },
            },
            createdByGuest: true,
          },
        },
        rootAnnotation: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/comments - Create a new comment thread
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = commentThreadSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const {
      reviewItemId,
      reviewRevisionId,
      rootAnnotationId,
      initialMessage,
      attachments,
      pinContextImageBase64,
    } = validated.data;

    // Check access
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
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canCreateComment(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create thread and first message in transaction
    const result = await db.$transaction(async (tx) => {
      const thread = await tx.commentThread.create({
        data: {
          reviewItemId,
          reviewRevisionId,
          rootAnnotationId,
          status: "OPEN",
          createdByUserId: session.user.id,
        },
      });

      const message = await tx.commentMessage.create({
        data: {
          threadId: thread.id,
          body: initialMessage.trim(),
          attachments:
            attachments && attachments.length > 0 ? attachments : undefined,
          createdByUserId: session.user.id,
        },
      });

      let savedScreenshotContextPath: string | null = null;

      // Update annotation to link to thread if applicable
      if (rootAnnotationId) {
        if (
          typeof pinContextImageBase64 === "string" &&
          pinContextImageBase64.trim().length > 0
        ) {
          const saved = await saveContextPngFromBase64(pinContextImageBase64);
          if (saved.ok) {
            savedScreenshotContextPath = saved.relativePath;
          } else {
            console.warn(
              "[comments] pin context screenshot not saved:",
              saved.error
            );
          }
        }
        await tx.annotation.update({
          where: { id: rootAnnotationId },
          data: {
            commentThreadId: thread.id,
            ...(savedScreenshotContextPath
              ? { screenshotContextPath: savedScreenshotContextPath }
              : {}),
          },
        });
      }

      return { thread, message, savedScreenshotContextPath };
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItemId,
        actionType: ActivityActionType.COMMENT_THREAD_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({
          threadId: result.thread.id,
          hasAnnotation: !!rootAnnotationId,
        }),
      },
    });

    // Fetch with messages so client can render immediately
    const fullThread = await db.commentThread.findUnique({
      where: { id: result.thread.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            createdByUser: { select: { firstName: true, lastName: true } },
            createdByGuest: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(
      {
        thread: fullThread,
        screenshotContextPath: result.savedScreenshotContextPath,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating comment thread:", error);
    return NextResponse.json(
      { error: "Failed to create comment thread" },
      { status: 500 }
    );
  }
}

// PATCH /api/comments - Either add a reply or update thread status
// Body: { threadId, body } for reply
// Body: { threadId, status } for status change
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { threadId } = body;

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    // Check access
    const thread = await db.commentThread.findUnique({
      where: { id: threadId },
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

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const userMembership = thread.reviewItem.project.members.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canCreateComment(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        thread.reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Status change path
    if (
      body.status !== undefined &&
      body.body === undefined &&
      body.attachments === undefined
    ) {
      const statusValidated = updateThreadStatusSchema.safeParse({ threadId, status: body.status });
      if (!statusValidated.success) {
        return NextResponse.json(
          { error: "Invalid status", details: statusValidated.error.flatten() },
          { status: 400 }
        );
      }

      const oldStatus = thread.status;
      const newStatus = statusValidated.data.status as CommentStatus;

      await db.commentThread.update({
        where: { id: threadId },
        data: { status: newStatus },
      });

      const statusLabels: Record<string, string> = {
        OPEN: "Open",
        IN_PROGRESS: "In Progress",
        RESOLVED: "Resolved",
        CLOSED: "Closed",
        IGNORED: "Ignored",
      };

      await db.commentMessage.create({
        data: {
          threadId,
          body: `Status changed from ${statusLabels[oldStatus] ?? oldStatus} to ${statusLabels[newStatus] ?? newStatus}`,
          createdByUserId: session.user.id,
          isSystemMessage: true,
        },
      });

      await db.activityLog.create({
        data: {
          entityType: "ReviewItem",
          entityId: thread.reviewItemId,
          actionType: ActivityActionType.STATUS_CHANGED,
          actorUserId: session.user.id,
          metaJson: JSON.stringify({ threadId, oldStatus, newStatus }),
        },
      });

      const updatedThread = await db.commentThread.findUnique({
        where: { id: threadId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              createdByUser: { select: { firstName: true, lastName: true } },
              createdByGuest: { select: { name: true } },
            },
          },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return NextResponse.json({ thread: updatedThread });
    }

    // Reply path
    const validated = commentReplySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    await db.commentMessage.create({
      data: {
        threadId,
        body: validated.data.body.trim(),
        attachments:
          validated.data.attachments && validated.data.attachments.length > 0
            ? validated.data.attachments
            : undefined,
        createdByUserId: session.user.id,
      },
    });

    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: thread.reviewItemId,
        actionType: ActivityActionType.COMMENT_REPLY_ADDED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ threadId }),
      },
    });

    const updatedThread = await db.commentThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            createdByUser: { select: { firstName: true, lastName: true } },
            createdByGuest: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return NextResponse.json({ thread: updatedThread });
  } catch (error) {
    console.error("Error in comment PATCH:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// DELETE /api/comments?threadId=xxx - Delete a comment thread
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const thread = await db.commentThread.findUnique({
      where: { id: threadId },
      include: { reviewItem: { include: { project: { include: { members: true } } } } },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const role = session.user.role as UserRole;
    const isOwnerOrAdmin = role === UserRole.OWNER || role === UserRole.ADMIN;
    const isCreator = thread.createdByUserId === session.user.id;
    if (!isOwnerOrAdmin && !isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Unlink annotation if linked
    if (thread.rootAnnotationId) {
      await db.annotation.update({
        where: { id: thread.rootAnnotationId },
        data: { commentThreadId: null },
      }).catch(() => {});
    }

    await db.commentThread.delete({ where: { id: threadId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment thread:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
