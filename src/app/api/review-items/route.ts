import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ReviewItemType, ReviewMode, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { reviewItemSchema, websiteReviewItemSchema } from "@/lib/validations/review-item";
import { storage, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZES } from "@/lib/storage/service";
import { ActivityActionType } from "@prisma/client";
import { generateToken } from "@/lib/utils";

// GET /api/review-items - List review items
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type") as ReviewItemType | null;

    const whereClause: Prisma.ReviewItemWhereInput = {
      ...(projectId ? { projectId } : {}),
      ...(type ? { type } : {}),
      ...(!Permissions.canAccessAdminPanel(session.user.role as UserRole)
        ? { project: { members: { some: { userId: session.user.id } } } }
        : {}),
    };

    const reviewItems = await db.reviewItem.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            client: {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            },
          },
        },
        currentRevision: true,
        _count: {
          select: { commentThreads: true, revisions: { where: { reviewItemId: { not: "" } } }, annotations: true },
        },
      },
    });

    return NextResponse.json({ reviewItems });
  } catch (error) {
    console.error("Error fetching review items:", error);
    return NextResponse.json(
      { error: "Failed to fetch review items" },
      { status: 500 }
    );
  }
}

// POST /api/review-items - Create a new review item
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const type = formData.get("type") as ReviewItemType;

    // Get project and check permissions
    const projectId = formData.get("projectId") as string;
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userMembership = project.members.find(
      (m) => m.userId === session.user.id
    );

    if (
      !Permissions.canCreateReviewItem(
        session.user.role as UserRole,
        userMembership?.roleInProject as ProjectRole | null
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const title = formData.get("title") as string;
    const guestCommentingEnabled = formData.get("guestCommentingEnabled") === "true";

    let uploadedFilePath: string | undefined;
    let thumbnailPath: string | undefined;
    let originalFileName: string | undefined;
    let mimeType: string | undefined;
    let sourceUrl: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let durationSeconds: number | undefined;
    let reviewMode: ReviewMode;

    // Handle different content types
    if (type === "WEBSITE") {
      const url = formData.get("sourceUrl") as string;
      const mode = formData.get("reviewMode") as ReviewMode;
      
      if (!url || !isValidUrl(url)) {
        return NextResponse.json(
          { error: "Valid URL is required for website review" },
          { status: 400 }
        );
      }

      sourceUrl = url;
      reviewMode = mode || "LIVE_URL";
    } else {
      // Handle file uploads
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json(
          { error: "File is required" },
          { status: 400 }
        );
      }

      // Validate file type and size
      const validation = validateFile(file, type);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Upload file
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileType = type === "IMAGE" ? "image" : type === "PDF" ? "pdf" : "video";
      const result = await storage.uploadFile(
        {
          buffer,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        },
        fileType
      );

      uploadedFilePath = result.path;
      originalFileName = file.name;
      mimeType = file.type;
      reviewMode = "UPLOADED_ASSET";

      // Extract metadata based on file type
      if (type === "IMAGE") {
        // Would use sharp for metadata extraction in production
        width = 1920;
        height = 1080;
        thumbnailPath = result.path; // Use same for now
      } else if (type === "VIDEO") {
        // Would use ffprobe for metadata in production
        durationSeconds = 0;
      }
    }

    // Create review item
    const reviewItem = await db.reviewItem.create({
      data: {
        projectId,
        title,
        type,
        sourceUrl,
        uploadedFilePath,
        thumbnailPath,
        originalFileName,
        mimeType,
        width,
        height,
        durationSeconds,
        reviewMode,
        createdById: session.user.id,
        guestCommentingEnabled,
        isPublicShareEnabled: false,
        publicShareToken: generateToken(),
      },
    });

    // Create initial revision
    const revision = await db.reviewRevision.create({
      data: {
        reviewItemId: reviewItem.id,
        revisionDate: new Date(),
        revisionLabel: "Initial Version",
        uploadedFilePath,
        sourceUrl,
        createdById: session.user.id,
      },
    });

    // Update review item with current revision
    await db.reviewItem.update({
      where: { id: reviewItem.id },
      data: { currentRevisionId: revision.id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        actionType: ActivityActionType.REVIEW_ITEM_CREATED,
        actorUserId: session.user.id,
        metaJson: JSON.stringify({
          title: reviewItem.title,
          type: reviewItem.type,
          projectId: reviewItem.projectId,
        }),
      },
    });

    return NextResponse.json({ reviewItem, revision }, { status: 201 });
  } catch (error) {
    console.error("Error creating review item:", error);
    return NextResponse.json(
      { error: "Failed to create review item" },
      { status: 500 }
    );
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateFile(
  file: File,
  type: ReviewItemType
): { valid: boolean; error?: string } {
  let allowedTypes: string[];
  let maxSize: number;

  switch (type) {
    case "IMAGE":
      allowedTypes = ALLOWED_IMAGE_TYPES;
      maxSize = MAX_FILE_SIZES.image;
      break;
    case "PDF":
      allowedTypes = ["application/pdf"];
      maxSize = MAX_FILE_SIZES.document;
      break;
    case "VIDEO":
      allowedTypes = ALLOWED_VIDEO_TYPES;
      maxSize = MAX_FILE_SIZES.video;
      break;
    default:
      return { valid: false, error: "Invalid review item type" };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}
