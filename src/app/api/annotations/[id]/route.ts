import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ActivityActionType } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";

// PATCH /api/annotations/[id] - Update lightweight annotation fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      screenshotContextPath?: string | null;
    };
    if (!("screenshotContextPath" in body)) {
      return NextResponse.json(
        { error: "screenshotContextPath is required" },
        { status: 400 }
      );
    }

    const annotation = await db.annotation.findUnique({
      where: { id },
      include: {
        reviewItem: {
          include: {
            project: { include: { members: true } },
          },
        },
      },
    });
    if (!annotation) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    const userMembership = annotation.reviewItem.project.members.find(
      (m) => m.userId === session.user.id
    );
    const isOwner = annotation.createdByUserId === session.user.id;
    const canEdit =
      isOwner ||
      Permissions.canAccessAdminPanel(session.user.role as UserRole) ||
      (userMembership &&
        Permissions.canEditProject(
          session.user.role as UserRole,
          userMembership.roleInProject as ProjectRole,
          false
        )) ||
      // Pin snapshot PATCH from client: any member who can comment may attach context
      (userMembership &&
        Permissions.canCreateComment(
          session.user.role as UserRole,
          userMembership.roleInProject as ProjectRole,
          annotation.reviewItem.guestCommentingEnabled,
          false
        ));
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const screenshotContextPath =
      typeof body.screenshotContextPath === "string"
        ? body.screenshotContextPath.trim() || null
        : null;

    const updated = await db.annotation.update({
      where: { id },
      data: { screenshotContextPath },
    });
    return NextResponse.json({ annotation: updated });
  } catch (error) {
    console.error("Error updating annotation:", error);
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 }
    );
  }
}

// DELETE /api/annotations/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const annotation = await db.annotation.findUnique({
      where: { id },
      include: {
        reviewItem: {
          include: {
            project: { include: { members: true } },
          },
        },
      },
    });

    if (!annotation) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    const userMembership = annotation.reviewItem.project.members.find(
      (m) => m.userId === session.user.id
    );

    const isOwner = annotation.createdByUserId === session.user.id;
    const canDelete =
      isOwner ||
      Permissions.canAccessAdminPanel(session.user.role as UserRole) ||
      (userMembership &&
        Permissions.canEditProject(
          session.user.role as UserRole,
          userMembership.roleInProject as ProjectRole,
          false
        ));

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If annotation has a linked comment thread, unlink it first
    if (annotation.commentThreadId) {
      await db.commentThread.update({
        where: { id: annotation.commentThreadId },
        data: { rootAnnotationId: null },
      });
    }

    await db.annotation.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: annotation.reviewItemId,
        actionType: ActivityActionType.ANNOTATION_DELETED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ annotationId: id }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
