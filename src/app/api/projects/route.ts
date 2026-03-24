import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectStatus, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { projectSchema } from "@/lib/validations/project";
import { ActivityActionType } from "@prisma/client";
import slugify from "slugify";

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status") as ProjectStatus | null;

    const whereClause: Prisma.ProjectWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
      ...(!Permissions.canAccessAdminPanel(session.user.role as UserRole)
        ? { members: { some: { userId: session.user.id } } }
        : {}),
    };

    const projects = await db.project.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        _count: {
          select: { reviewItems: true, members: true },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Permissions.canCreateProject(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = projectSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    // If no client provided, use/create the system default client
    let clientId = validated.data.clientId;
    if (!clientId) {
      const defaultClient = await db.client.upsert({
        where: { id: "system-default-client" },
        update: {},
        create: {
          id: "system-default-client",
          name: "General",
          companyName: "Click Track Marketing",
          email: "general@clicktrackmarketing.com",
        },
      });
      clientId = defaultClient.id;
    }

    // Generate unique slug
    let slug = slugify(validated.data.name, { lower: true, strict: true });
    let suffix = 1;
    const baseSlug = slug;

    while (await db.project.findUnique({ where: { clientId_slug: { clientId, slug } } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const project = await db.project.create({
      data: {
        ...validated.data,
        clientId,
        slug,
        createdById: session.user.id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    // Add creator as manager
    await db.projectMember.create({
      data: {
        projectId: project.id,
        userId: session.user.id,
        roleInProject: "MANAGER",
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "Project",
        entityId: project.id,
        actionType: ActivityActionType.PROJECT_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ name: project.name, clientId: project.clientId }),
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
