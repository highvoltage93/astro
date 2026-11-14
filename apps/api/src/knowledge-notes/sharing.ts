import { z } from "zod";

export const sharedKnowledgeAccess = (until: Date | null | undefined, now = new Date()) => ({
  enabled: !!until && until.getTime() > now.getTime(), expiresAt: until?.toISOString() ?? null
});

export const publicationSchema = z.object({
  noteRevision: z.number().int().positive(),
  publicationRevision: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).transform((tags) => [...new Set(tags)]),
  consent: z.literal(true)
}).strict();

export const libraryQuerySchema = z.object({
  query: z.string().trim().max(160).default(""),
  author: z.string().trim().max(50).default(""),
  authorId: z.string().cuid().optional(),
  view: z.enum(["catalog", "active"]).default("catalog"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

export const publicationRevisionSchema = z.object({ revision: z.number().int().positive() }).strict();
