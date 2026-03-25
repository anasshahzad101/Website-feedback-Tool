import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { initialSetupSchema } from "@/lib/validations/branding";
import { DEFAULT_BRAND_NAME } from "@/lib/brand";

export async function POST(request: NextRequest) {
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = initialSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      email,
      password,
      brandName: bn,
      appName: an,
      tagline: tg,
    } = parsed.data;

    const passwordHash = await hash(password, 10);
    const brandName = bn?.trim() || DEFAULT_BRAND_NAME;
    const appName = an?.trim() || brandName;

    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: UserRole.OWNER,
        },
      });

      await tx.appSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          brandName,
          appName,
          tagline: tg?.trim() || null,
        },
        update: {
          brandName,
          appName,
          tagline: tg?.trim() || null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("setup POST:", e);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
