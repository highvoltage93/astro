import { z } from "zod";
import { richDocumentSchema } from "@astroprocessor/consultation-format";

export const categorySchema = z.enum(["general", "natal", "transit", "solar", "lunar", "synastry"]);
export const templateDraftSchema = z.object({
  title: z.string().trim().min(1).max(120), category: categorySchema,
  body: z.union([z.string().max(20000), richDocumentSchema])
}).strict().refine((value) => JSON.stringify(value).length <= 100000, "Template is too large");
export const templateIdSchema = z.object({ id: z.string().uuid() });
export const createTemplateSchema = z.object({ id: z.string().uuid(), draft: templateDraftSchema }).strict();
export const updateTemplateSchema = z.object({
  revision: z.number().int().positive(), mutationId: z.string().uuid(), draft: templateDraftSchema
}).strict();
export const listTemplatesSchema = z.object({
  query: z.string().trim().max(120).optional(), category: categorySchema.optional(),
  cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(10)
});
