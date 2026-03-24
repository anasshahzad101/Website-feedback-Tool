import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { clientSchema } from "@/lib/validations/client";
import { ActivityActionType } from "@prisma/client";

// GET /api/clients - List all clients
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only internal users can view clients
    if (!Permissions.canManageClients(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const clients = await db.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { companyName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Permissions.canManageClients(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = clientSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const client = await db.client.create({
      data: validated.data,
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "Client",
        entityId: client.id,
        actionType: ActivityActionType.CLIENT_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({ name: client.name }),
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
