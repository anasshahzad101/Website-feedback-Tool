import { z } from "zod";
import { CommentStatus } from "@prisma/client";

const commentAttachmentSchema = z.object({
  kind: z.enum(["image", "audio", "file"]),
  path: z.string().regex(/^\/comment-attachments\//),
  name: z.string().min(1).max(240),
  mime: z.string().optional(),
});

export const commentThreadSchema = z
  .object({
    reviewItemId: z.string(),
    reviewRevisionId: z.string().optional(),
    rootAnnotationId: z.string().optional(),
    initialMessage: z.string().optional().default(""),
    attachments: z.array(commentAttachmentSchema).max(8).optional(),
  })
  .superRefine((data, ctx) => {
    const hasText = (data.initialMessage ?? "").trim().length > 0;
    const hasAtt = (data.attachments?.length ?? 0) > 0;
    if (!hasText && !hasAtt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add text or at least one attachment",
        path: ["initialMessage"],
      });
    }
  });

export const commentReplySchema = z
  .object({
    threadId: z.string(),
    body: z.string().optional().default(""),
    attachments: z.array(commentAttachmentSchema).max(8).optional(),
  })
  .superRefine((data, ctx) => {
    const hasText = (data.body ?? "").trim().length > 0;
    const hasAtt = (data.attachments?.length ?? 0) > 0;
    if (!hasText && !hasAtt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add text or at least one attachment",
        path: ["body"],
      });
    }
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
