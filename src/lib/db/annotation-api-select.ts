import type { Prisma } from "@prisma/client";

/**
 * Scalars returned by annotation APIs — omits `pinInCropX` / `pinInCropY` so
 * Prisma's post-INSERT SELECT does not reference columns that may not exist on
 * older databases (migration not applied yet). SSR uses
 * `loadAnnotationsForReviewItem` for full data when columns exist.
 */
export const annotationScalarSelect = {
  id: true,
  reviewItemId: true,
  reviewRevisionId: true,
  commentThreadId: true,
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
  targetFrame: true,
  targetTimestampMs: true,
  viewportMetaJson: true,
  screenshotContextPath: true,
  color: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  createdByGuestId: true,
} satisfies Prisma.AnnotationSelect;

export const annotationListSelect = {
  ...annotationScalarSelect,
  commentThread: {
    select: { id: true, status: true },
  },
  createdByUser: {
    select: { firstName: true, lastName: true },
  },
  createdByGuest: true,
} satisfies Prisma.AnnotationSelect;

export const annotationCreateSelect = {
  ...annotationScalarSelect,
  createdByUser: {
    select: { firstName: true, lastName: true },
  },
} satisfies Prisma.AnnotationSelect;

export type AnnotationFromApi = Prisma.AnnotationGetPayload<{
  select: typeof annotationListSelect;
}>;
