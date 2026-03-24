export * from "./auth";
export * from "./client";
export * from "./project";
export * from "./review-item";
export * from "./annotation";
export * from "./comment";

import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string(),
});

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
