import { z } from "zod";
import { consultationContentSchema } from "@astroprocessor/consultation-format";
export { consultationContentSchema } from "@astroprocessor/consultation-format";

export const consultationDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  status: z.enum(["DRAFT", "READY"]),
  content: consultationContentSchema,
  privateNotes: z.string().max(10000)
}).strict();
export const createConsultationSchema = consultationDraftSchema.extend({
  id: z.string().uuid(), sourceProfileId: z.string().min(1).max(120)
});
export const updateConsultationSchema = consultationDraftSchema.extend({
  revision: z.number().int().positive(), mutationId: z.string().uuid()
});
export const listConsultationsSchema = z.object({
  sourceProfileId: z.string().min(1).max(120).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});
