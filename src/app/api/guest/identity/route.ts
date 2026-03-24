import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { generateToken } from "@/lib/utils";
import { z } from "zod";

const guestIdentitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional(),
  shareToken: z.string(),
});

// POST /api/guest/identity - Create a guest identity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = guestIdentitySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, shareToken } = validated.data;

    // Validate share token
    const shareLink = await db.shareLink.findUnique({
      where: { token: shareToken },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 404 });
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    if (!shareLink.allowGuestComments) {
      return NextResponse.json(
        { error: "Guest commenting is not enabled for this link" },
        { status: 403 }
      );
    }

    // Create guest identity
    const guest = await db.guestIdentity.create({
      data: {
        name,
        email,
        accessToken: generateToken(32),
      },
    });

    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    console.error("Error creating guest identity:", error);
    return NextResponse.json(
      { error: "Failed to create guest identity" },
      { status: 500 }
    );
  }
}
