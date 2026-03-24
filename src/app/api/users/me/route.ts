import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validations/auth";
import { hash } from "bcryptjs";

// GET /api/users/me - Get current user profile (from DB for latest data)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/me - Update current user profile or password
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Profile update (firstName, lastName)
    if (body.firstName !== undefined || body.lastName !== undefined) {
      const validated = updateProfileSchema.safeParse({
        firstName: body.firstName ?? session.user.firstName,
        lastName: body.lastName ?? session.user.lastName,
      });

      if (!validated.success) {
        return NextResponse.json(
          { error: "Invalid input", details: validated.error.flatten() },
          { status: 400 }
        );
      }

      await db.user.update({
        where: { id: session.user.id },
        data: {
          firstName: validated.data.firstName,
          lastName: validated.data.lastName,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Password change
    if (body.currentPassword !== undefined) {
      const validated = changePasswordSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json(
          { error: "Invalid input", details: validated.error.flatten() },
          { status: 400 }
        );
      }

      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { compare } = await import("bcryptjs");
      const valid = await compare(validated.data.currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const passwordHash = await hash(validated.data.newPassword, 10);
      await db.user.update({
        where: { id: session.user.id },
        data: { passwordHash },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
