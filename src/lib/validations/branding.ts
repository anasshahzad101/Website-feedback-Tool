import { z } from "zod";

export const initialSetupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  brandName: z.string().min(1).max(120).optional(),
  appName: z.string().min(1).max(120).optional(),
  tagline: z.string().max(80).optional(),
});

export const brandingUpdateSchema = z.object({
  brandName: z.string().min(1).max(120),
  appName: z.string().min(1).max(120),
  tagline: z.union([z.string().max(80), z.null()]).optional(),
  clearLogo: z.boolean().optional(),
});
