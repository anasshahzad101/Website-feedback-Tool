import type { ProjectStatus, ReviewItemType } from "@prisma/client";

/** Plain JSON shape for `ProjectsList` (avoids RSC → client serialization edge cases). */
export type SerializedProjectForList = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; companyName: string | null };
  _count: { reviewItems: number; members: number };
  reviewItems: Array<{
    type: ReviewItemType;
    thumbnailPath: string | null;
    uploadedFilePath: string | null;
    sourceUrl: string | null;
    currentRevision: {
      snapshotPath: string | null;
      uploadedFilePath: string | null;
    } | null;
  }>;
};

type PrismaProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string; companyName: string | null };
  _count: { reviewItems: number; members: number };
  reviewItems: Array<{
    type: ReviewItemType;
    thumbnailPath: string | null;
    uploadedFilePath: string | null;
    sourceUrl: string | null;
    currentRevision: {
      snapshotPath: string | null;
      uploadedFilePath: string | null;
    } | null;
  }>;
};

export function serializeProjectsForList(
  projects: PrismaProjectRow[]
): SerializedProjectForList[] {
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    client: p.client,
    _count: p._count,
    reviewItems: p.reviewItems.map((ri) => ({
      type: ri.type,
      thumbnailPath: ri.thumbnailPath,
      uploadedFilePath: ri.uploadedFilePath,
      sourceUrl: ri.sourceUrl,
      currentRevision: ri.currentRevision
        ? {
            snapshotPath: ri.currentRevision.snapshotPath,
            uploadedFilePath: ri.currentRevision.uploadedFilePath,
          }
        : null,
    })),
  }));
}
