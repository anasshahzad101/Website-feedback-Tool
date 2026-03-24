import { z } from "zod";
import { ProjectStatus, ProjectRole } from "@prisma/client";

export const projectSchema = z.object({
  clientId: z.string().optional(),
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
});

export const updateProjectSchema = projectSchema.partial().extend({
  id: z.string(),
});

export const projectMemberSchema = z.object({
  projectId: z.string(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  roleInProject: z.nativeEnum(ProjectRole),
}).refine((data) => data.userId || data.clientId, {
  message: "Either user or client must be specified",
});

export const archiveProjectSchema = z.object({
  id: z.string(),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectMemberInput = z.infer<typeof projectMemberSchema>;
