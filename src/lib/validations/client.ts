import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = clientSchema.partial().extend({
  id: z.string(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
