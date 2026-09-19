import { z } from "zod";
import { forecastPreviewSchema, synastryPreviewSchema, transitPreviewSchema } from "../charts/schemas";

const subjectSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  birthplaceName: z.string().max(180),
  countryCode: z.string().max(2).default("")
});

const contextSchema = z.object({
  subject: subjectSchema,
  visiblePointKeys: z.record(z.boolean())
});

export const savedForecastInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("forecast"),
    parameters: forecastPreviewSchema.extend({ targetYear: z.number().int().min(1900).max(2100) }),
    context: contextSchema
  }),
  z.object({ kind: z.literal("transit"), parameters: transitPreviewSchema, context: contextSchema }),
  z.object({
    kind: z.literal("synastry"),
    parameters: synastryPreviewSchema,
    context: contextSchema.extend({ partner: subjectSchema })
  })
]);

export const saveForecastSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(10000).default(""),
  input: savedForecastInputSchema
});

export const listForecastsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().min(1).optional(),
  query: z.string().trim().max(120).default(""),
  kind: z.enum(["forecast", "transit", "synastry"]).optional(),
  createdFrom: z.string().datetime({ offset: true }).optional(),
  createdBefore: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest")
}).refine((value) => !value.createdFrom || !value.createdBefore ||
  Date.parse(value.createdFrom) < Date.parse(value.createdBefore), {
  message: "Початок періоду має передувати його завершенню.", path: ["createdBefore"]
});
