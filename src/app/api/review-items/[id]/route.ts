import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { updateReviewItemSchema } from "@/lib/validations/review-item";
import { ActivityActionType } from "@prisma/client";

// GET /api/review-items/[id] - Get review item details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewItem = await db.reviewItem.findUnique({
      where: { id: id },
      include: {
        project: {
          include: {
            client: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        currentRevision: true,
        revisions: {
          orderBy: { revisionDate: "desc" },
        },
      },
    });

    if (!reviewItem) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    // Check access
    const userMembership = reviewItem.project.members.find(
      (m: { userId: string | null; roleInProject: string }) => m.userId === session.user.id
    );

    if (
      !Permissions.canAccessAdminPanel(session.user.role as UserRole) &&
      !userMembership
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      reviewItem,
      userRole: userMembership?.roleInProject,
    });
  } catch (error) {
    console.error("Error fetching review item:", error);
    return NextResponse.json(
      { error: "Failed to fetch review item" },
      { status: 500 }
    );
  }
}

// PATCH /api/review-items/[id] - Update review item
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

    const reviewItem = await db.reviewItem.findUnique({
      where: { id: id },
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
      !Permissions.canEditReviewItem(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        reviewItem.createdById === session.user.id
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateReviewItemSchema.safeParse({ ...body, id: id });

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const updatedReviewItem = await db.reviewItem.update({
      where: { id: id },
      data: {
        title: validated.data.title,
        guestCommentingEnabled: validated.data.guestCommentingEnabled,
        isPublicShareEnabled: validated.data.isPublicShareEnabled,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        currentRevision: true,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        actionType: ActivityActionType.REVIEW_ITEM_UPDATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ title: updatedReviewItem.title }),
      },
    });

    return NextResponse.json({ reviewItem: updatedReviewItem });
  } catch (error) {
    console.error("Error updating review item:", error);
    return NextResponse.json(
      { error: "Failed to update review item" },
      { status: 500 }
    );
  }
}

// DELETE /api/review-items/[id] - Delete review item
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

    const reviewItem = await db.reviewItem.findUnique({
      where: { id: id },
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
      !Permissions.canDeleteReviewItem(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Log activity before deletion
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        actionType: ActivityActionType.REVIEW_ITEM_ARCHIVED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({
          title: reviewItem.title,
          deleted: true,
        }),
      },
    });

    await db.reviewItem.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting review item:", error);
    return NextResponse.json(
      { error: "Failed to delete review item" },
      { status: 500 }
    );
  }
}
