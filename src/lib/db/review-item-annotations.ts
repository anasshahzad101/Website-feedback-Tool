import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

/** Columns always present on `annotations` (before pin-in-crop migration). */
const annotationSelectBase = {
  id: true,
  annotationType: true,
  x: true,
  y: true,
  xPercent: true,
  yPercent: true,
  width: true,
  height: true,
  widthPercent: true,
  heightPercent: true,
  pointsJson: true,
  targetTimestampMs: true,
  screenshotContextPath: true,
  color: true,
  commentThreadId: true,
} satisfies Prisma.AnnotationSelect;

const annotationSelectWithPins = {
  ...annotationSelectBase,
  pinInCropX: true,
  pinInCropY: true,
} satisfies Prisma.AnnotationSelect;

export type AnnotationForReviewItem = Prisma.AnnotationGetPayload<{
  select: typeof annotationSelectWithPins;
}>;

export function isMissingAnnotationPinColumnsError(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: string }).code;
    if (code === "P2022") return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /pin_in_crop_[xy]/i.test(msg) ||
    (/Unknown column/i.test(msg) && /pin_in_crop/i.test(msg))
  );
}

/**
 * Loads annotations for a review item. If the DB has not been migrated with
 * `pin_in_crop_x` / `pin_in_crop_y`, falls back to a query without those columns
 * so the page still renders (pin marker uses legacy positioning).
 */
export async function loadAnnotationsForReviewItem(
  reviewItemId: string
): Promise<AnnotationForReviewItem[]> {
  try {
    const rows = await db.annotation.findMany({
      where: { reviewItemId },
      select: annotationSelectWithPins,
      orderBy: { createdAt: "asc" },
    });
    return rows;
  } catch (e) {
    if (!isMissingAnnotationPinColumnsError(e)) throw e;
    const rows = await db.annotation.findMany({
      where: { reviewItemId },
      select: annotationSelectBase,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      ...r,
      pinInCropX: null,
      pinInCropY: null,
    }));
  }
}
