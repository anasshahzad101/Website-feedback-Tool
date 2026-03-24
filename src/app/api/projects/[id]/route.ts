import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { updateProjectSchema, archiveProjectSchema } from "@/lib/validations/project";
import { ActivityActionType } from "@prisma/client";

// GET /api/projects/[id] - Get project details
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

    const project = await db.project.findUnique({
      where: { id: id },
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
                role: true,
              },
            },
            client: {
              select: {
                id: true,
                name: true,
                companyName: true,
                email: true,
              },
            },
          },
        },
        reviewItems: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            _count: {
              select: { commentThreads: true, revisions: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check access
    const userMembership = project.members.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canAccessAdminPanel(session.user.role as UserRole) &&
      !userMembership
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ project, userRole: userMembership?.roleInProject });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
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

    const project = await db.project.findUnique({
      where: { id: id },
      include: { members: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userMembership = project.members.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canEditProject(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null,
        project.createdById === session.user.id
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateProjectSchema.safeParse({ ...body, id: id });

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const updatedProject = await db.project.update({
      where: { id: id },
      data: {
        name: validated.data.name,
        description: validated.data.description,
      },
      include: {
        client: true,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "Project",
        entityId: project.id,
        actionType: ActivityActionType.PROJECT_UPDATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ name: updatedProject.name }),
      },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id] - Archive or unarchive a project
// Body: { action: "archive" | "unarchive" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findUnique({
      where: { id: id },
      include: { members: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userMembership = project.members.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canArchiveProject(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const isArchive = body.action !== "unarchive";

    const updatedProject = await db.project.update({
      where: { id: id },
      data: {
        status: isArchive ? "ARCHIVED" : "ACTIVE",
        archivedAt: isArchive ? new Date() : null,
      },
    });

    await db.activityLog.create({
      data: {
        entityType: "Project",
        entityId: project.id,
        actionType: ActivityActionType.PROJECT_ARCHIVED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ name: updatedProject.name, archived: isArchive }),
      },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("Error archiving project:", error);
    return NextResponse.json(
      { error: "Failed to archive project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project permanently
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

    const role = session.user.role as UserRole;
    const isOwnerOrAdmin = role === UserRole.OWNER || role === UserRole.ADMIN;
    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
