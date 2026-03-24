import { z } from "zod";
import { CommentStatus } from "@prisma/client";

export const commentThreadSchema = z.object({
  reviewItemId: z.string(),
  reviewRevisionId: z.string().optional(),
  rootAnnotationId: z.string().optional(),
  initialMessage: z.string().min(1, "Comment cannot be empty"),
});

export const commentReplySchema = z.object({
  threadId: z.string(),
  body: z.string().min(1, "Reply cannot be empty"),
});

export const updateThreadStatusSchema = z.object({
  threadId: z.string(),
  status: z.nativeEnum(CommentStatus),
});

export const assignThreadSchema = z.object({
  threadId: z.string(),
  assignedToUserId: z.string().optional(),
});

export const guestCommentSchema = z.object({
  shareToken: z.string(),
  guestName: z.string().min(1, "Name is required"),
  guestEmail: z.string().email().optional(),
  reviewItemId: z.string(),
  reviewRevisionId: z.string().optional(),
  annotation: z.object({
    annotationType: z.enum(["PIN", "RECTANGLE", "ARROW", "FREEHAND", "TEXT"]),
    x: z.number(),
    y: z.number(),
    xPercent: z.number(),
    yPercent: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    widthPercent: z.number().optional(),
    heightPercent: z.number().optional(),
    pointsJson: z.string().optional(),
    targetTimestampMs: z.number().optional(),
    color: z.string(),
  }).optional(),
  message: z.string().min(1, "Comment is required"),
});

export type CommentThreadInput = z.infer<typeof commentThreadSchema>;
export type CommentReplyInput = z.infer<typeof commentReplySchema>;
export type UpdateThreadStatusInput = z.infer<typeof updateThreadStatusSchema>;
export type AssignThreadInput = z.infer<typeof assignThreadSchema>;
export type GuestCommentInput = z.infer<typeof guestCommentSchema>;
