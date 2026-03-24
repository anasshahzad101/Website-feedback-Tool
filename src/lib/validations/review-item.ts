import { z } from "zod";
import { ReviewItemType, ReviewMode } from "@prisma/client";

export const reviewItemSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(ReviewItemType),
  sourceUrl: z.string().url().optional(),
  reviewMode: z.nativeEnum(ReviewMode),
  guestCommentingEnabled: z.boolean().default(true),
});

export const websiteReviewItemSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  sourceUrl: z.string().url("Please enter a valid URL"),
  reviewMode: z.enum([ReviewMode.LIVE_URL, ReviewMode.IFRAME_EMBED, ReviewMode.SCREENSHOT_CAPTURE]),
  guestCommentingEnabled: z.boolean().default(true),
});

export const updateReviewItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  guestCommentingEnabled: z.boolean().optional(),
  isPublicShareEnabled: z.boolean().optional(),
});

export const createRevisionSchema = z.object({
  reviewItemId: z.string(),
  revisionLabel: z.string().optional(),
  notes: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

export const shareLinkSchema = z.object({
  projectId: z.string().optional(),
  reviewItemId: z.string().optional(),
  allowGuestComments: z.boolean().default(true),
  allowGuestView: z.boolean().default(true),
  expiresAt: z.date().optional(),
  passwordProtected: z.boolean().default(false),
  password: z.string().optional(),
}).refine((data) => data.projectId || data.reviewItemId, {
  message: "Either project or review item must be specified",
});

export type ReviewItemInput = z.infer<typeof reviewItemSchema>;
export type WebsiteReviewItemInput = z.infer<typeof websiteReviewItemSchema>;
export type UpdateReviewItemInput = z.infer<typeof updateReviewItemSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type ShareLinkInput = z.infer<typeof shareLinkSchema>;
