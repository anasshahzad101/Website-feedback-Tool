import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { Permissions } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { brandingUpdateSchema } from "@/lib/validations/branding";
import { getOrCreateAppSettings, getPublicBranding } from "@/lib/app-settings";

async function requireBrandingAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = session.user.role as UserRole;
  if (!Permissions.canAccessAdminPanel(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const r = await requireBrandingAdmin();
  if ("error" in r) return r.error;

  try {
    const row = await getOrCreateAppSettings();
    const publicB = await getPublicBranding();
    return NextResponse.json({
      brandName: row.brandName,
      appName: row.appName,
      tagline: row.tagline,
      logoPath: row.logoPath,
      logoUrl: publicB.logoUrl,
    });
  } catch (e) {
    console.error("app-settings GET:", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const r = await requireBrandingAdmin();
  if ("error" in r) return r.error;

  try {
    const body = await request.json();
    const parsed = brandingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { brandName, appName, tagline, clearLogo } = parsed.data;

    let taglineNext: string | null | undefined;
    if (tagline !== undefined && tagline !== null) {
      taglineNext = tagline.trim() || null;
    } else if (tagline === null) {
      taglineNext = null;
    }

    await db.appSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        brandName: brandName.trim(),
        appName: appName.trim(),
        tagline: taglineNext === undefined ? null : taglineNext,
        logoPath: null,
      },
      update: {
        brandName: brandName.trim(),
        appName: appName.trim(),
        ...(taglineNext !== undefined ? { tagline: taglineNext } : {}),
        ...(clearLogo ? { logoPath: null } : {}),
      },
    });

    const publicB = await getPublicBranding();
    return NextResponse.json(publicB);
  } catch (e) {
    console.error("app-settings PATCH:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
