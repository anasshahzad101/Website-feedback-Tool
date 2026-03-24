import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ActivityActionType, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { shareLinkSchema } from "@/lib/validations/review-item";
import { generateToken } from "@/lib/utils";

// GET /api/shares - List share links
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const reviewItemId = searchParams.get("reviewItemId");

    let whereClause: Prisma.ShareLinkWhereInput = {
      ...(projectId ? { projectId } : {}),
      ...(reviewItemId ? { reviewItemId } : {}),
    };

    // Only show shares created by user or for projects they manage
    if (!Permissions.canAccessAdminPanel(session.user.role as UserRole)) {
      const managedProjects = await db.project.findMany({
        where: { members: { some: { userId: session.user.id, roleInProject: "MANAGER" } } },
        select: { id: true },
      });
      whereClause = {
        ...whereClause,
        OR: [
          { createdById: session.user.id },
          { projectId: { in: managedProjects.map((p) => p.id) } },
        ],
      };
    }

    const shareLinks = await db.shareLink.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true },
        },
        reviewItem: {
          select: { id: true, title: true },
        },
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ shareLinks });
  } catch (error) {
    console.error("Error fetching share links:", error);
    return NextResponse.json(
      { error: "Failed to fetch share links" },
      { status: 500 }
    );
  }
}

// POST /api/shares - Create a share link
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = shareLinkSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, reviewItemId, allowGuestComments, allowGuestView, expiresAt } = validated.data;

    // Check access
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { members: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const userMembership = project.members.find((m) => m.userId === session.user.id);

      if (
        !Permissions.canCreateShareLink(
          session.user.role as UserRole,
          userMembership?.roleInProject as ProjectRole | null
        )
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (reviewItemId) {
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
        !Permissions.canCreateShareLink(
          session.user.role as UserRole,
          userMembership?.roleInProject as ProjectRole | null
        )
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const shareLink = await db.shareLink.create({
      data: {
        projectId,
        reviewItemId,
        token: generateToken(32),
        allowGuestComments,
        allowGuestView,
        expiresAt,
        passwordProtected: false,
        createdById: session.user.id,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        reviewItem: {
          select: { id: true, title: true },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: reviewItemId ? "ReviewItem" : "Project",
        entityId: reviewItemId || projectId!,
        actionType: ActivityActionType.SHARE_LINK_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({
          shareLinkId: shareLink.id,
          token: shareLink.token,
        }),
      },
    });

    return NextResponse.json({ shareLink }, { status: 201 });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}

