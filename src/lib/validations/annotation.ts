import { z } from "zod";
import { AnnotationType } from "@prisma/client";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const annotationSchema = z.object({
  reviewItemId: z.string(),
  reviewRevisionId: z.string().optional(),
  annotationType: z.nativeEnum(AnnotationType),
  x: z.number(),
  y: z.number(),
  xPercent: z.number().min(0).max(1),
  yPercent: z.number().min(0).max(1),
  width: z.number().optional(),
  height: z.number().optional(),
  widthPercent: z.number().min(0).max(1).optional(),
  heightPercent: z.number().min(0).max(1).optional(),
  pointsJson: z.string().optional(),
  targetFrame: z.number().optional(),
  targetTimestampMs: z.number().optional(),
  viewportMetaJson: z.string().optional(),
  screenshotContextPath: z.string().optional(),
  color: z.string().default("#3b82f6"),
});

export const updateAnnotationSchema = z.object({
  id: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  xPercent: z.number().min(0).max(1).optional(),
  yPercent: z.number().min(0).max(1).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  widthPercent: z.number().min(0).max(1).optional(),
  heightPercent: z.number().min(0).max(1).optional(),
  pointsJson: z.string().optional(),
  color: z.string().optional(),
});

export type AnnotationInput = z.infer<typeof annotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type Point = z.infer<typeof pointSchema>;
