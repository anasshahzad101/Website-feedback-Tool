import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ActivityActionType } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { annotationSchema } from "@/lib/validations/annotation";

// GET /api/annotations - List annotations for a review item
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewItemId = searchParams.get("reviewItemId");
    const revisionId = searchParams.get("revisionId");

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

    const annotations = await db.annotation.findMany({
      where: {
        reviewItemId,
        ...(revisionId ? { reviewRevisionId: revisionId } : {}),
      },
      include: {
        commentThread: {
          select: { id: true, status: true },
        },
        createdByUser: {
          select: { firstName: true, lastName: true },
        },
        createdByGuest: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}

// POST /api/annotations - Create a new annotation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = annotationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    // Check access
    const reviewItem = await db.reviewItem.findUnique({
      where: { id: validated.data.reviewItemId },
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
      !Permissions.canCreateAnnotation(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create annotation
    const annotation = await db.annotation.create({
      data: {
        ...validated.data,
        createdByUserId: session.user.id,
      },
      include: {
        createdByUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        actionType: ActivityActionType.ANNOTATION_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({
          annotationId: annotation.id,
          type: annotation.annotationType,
        }),
      },
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error("Error creating annotation:", error);
    return NextResponse.json(
      { error: "Failed to create annotation" },
      { status: 500 }
    );
  }
}
