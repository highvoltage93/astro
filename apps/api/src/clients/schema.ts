import { z } from "zod";

export const clientInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email().max(160), z.literal("")]),
  phone: z.string().trim().max(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).transform((tags) => [...new Set(tags)]),
  notes: z.string().max(20000)
}).strict();
export const clientUpdate = clientInput.extend({ revision: z.number().int().positive() });
export const clientQuery = z.object({
  search: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1)
}).strict();
