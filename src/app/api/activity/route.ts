import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";

// GET /api/activity - Get activity log
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let whereClause: Prisma.ActivityLogWhereInput = {};

    // Filter by entity if specified
    if (entityType && entityId) {
      whereClause = { entityType, entityId };
    }

    // For non-admin users, filter to their accessible projects
    if (!Permissions.canAccessAdminPanel(session.user.role as UserRole)) {
      const accessibleProjects = await db.project.findMany({
        where: { members: { some: { userId: session.user.id } } },
        select: { id: true },
      });
      const accessibleProjectIds = accessibleProjects.map((p) => p.id);

      const accessibleItems = await db.reviewItem.findMany({
        where: { projectId: { in: accessibleProjectIds } },
        select: { id: true },
      });

      whereClause = {
        ...whereClause,
        OR: [
          { actorUserId: session.user.id },
          { entityType: "Project", entityId: { in: accessibleProjectIds } },
          { entityType: "ReviewItem", entityId: { in: accessibleItems.map((r) => r.id) } },
        ],
      };
    }

    const activities = await db.activityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actorUser: {
          select: { firstName: true, lastName: true },
        },
        actorGuest: true,
      },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
