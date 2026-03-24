import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ActivityActionType } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";

// DELETE /api/shares/[id] - Revoke share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shareLink = await db.shareLink.findUnique({
      where: { id },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const userMembership = shareLink.project?.members?.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canRevokeShareLink(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        shareLink.createdById === session.user.id
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.shareLink.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        entityType: shareLink.reviewItemId ? "ReviewItem" : "Project",
        entityId: shareLink.reviewItemId || shareLink.projectId!,
        actionType: ActivityActionType.SHARE_LINK_REVOKED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ shareLinkId: id }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      { error: "Failed to revoke share link" },
      { status: 500 }
    );
  }
}
