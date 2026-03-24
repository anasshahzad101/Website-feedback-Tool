import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { z } from "zod";

const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

// PATCH /api/users/[id] - Update user role or active status
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

    if (!Permissions.canManageUsers(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent non-owners from changing the owner's role or deactivating them
    if (target.role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the Owner can modify another Owner" }, { status: 403 });
    }

    // Prevent users from modifying themselves via this endpoint (use profile/settings)
    if (target.id === session.user.id) {
      return NextResponse.json({ error: "Use profile settings to update your own account" }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateUserSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    if (validated.data.role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the Owner can assign the Owner role" }, { status: 403 });
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(validated.data.role !== undefined ? { role: validated.data.role } : {}),
        ...(validated.data.isActive !== undefined ? { isActive: validated.data.isActive } : {}),
        ...(validated.data.firstName ? { firstName: validated.data.firstName } : {}),
        ...(validated.data.lastName ? { lastName: validated.data.lastName } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { projectMemberships: true } },
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Deactivate (soft delete) a user
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

    if (!Permissions.canManageUsers(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the Owner can deactivate another Owner" }, { status: 403 });
    }

    // Soft delete: deactivate and prefix email to prevent login/conflicts
    const timestamp = Date.now();
    await db.user.update({
      where: { id },
      data: {
        isActive: false,
        email: `_deleted_${timestamp}_${target.email}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating user:", error);
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}
