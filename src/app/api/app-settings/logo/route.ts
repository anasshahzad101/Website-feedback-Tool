import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { Permissions } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { getOrCreateAppSettings, getPublicBranding } from "@/lib/app-settings";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!Permissions.canAccessAdminPanel(session.user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const mime = (file.type || "").split(";")[0]!.trim() || "application/octet-stream";
    if (!IMAGE_TYPES.has(mime)) {
      return NextResponse.json(
        { error: "Use PNG, JPG, GIF, WebP, or SVG" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be 2MB or smaller" }, { status: 400 });
    }

    const original =
      file instanceof File && file.name?.trim() ? file.name : "logo.png";
    const ext =
      path.extname(original).toLowerCase().slice(0, 8) ||
      (mime === "image/svg+xml" ? ".svg" : ".png");

    const dir = path.join(process.cwd(), "public", "uploads", "branding");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buf);

    const logoPath = `/uploads/branding/${filename}`;

    await getOrCreateAppSettings();
    await db.appSettings.update({
      where: { id: "default" },
      data: { logoPath },
    });

    const publicB = await getPublicBranding();
    return NextResponse.json({ logoPath, logoUrl: publicB.logoUrl });
  } catch (e) {
    console.error("app-settings/logo POST:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
