import { z } from "zod";

export const calculationRulesSchema = z.object({
  version: z.literal(1),
  rulershipModel: z.enum(["astroprocessor", "traditional", "modern"]),
  containedSignMinDegrees: z.number().min(0).max(30).nullable(),
  lilithRulesEighthHouse: z.boolean(),
  tenseHouses: z.array(z.number().int().min(1).max(12)).max(12)
    .transform((houses) => [...new Set(houses)].sort((a, b) => a - b))
}).strict();

export const calculationProfileReferenceSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120),
  revision: z.number().int().min(1)
}).strict();

export const calculationProfileConfigSchema = z.object({
  calculationRules: calculationRulesSchema,
  houseSystem: z.enum(["koch", "placidus", "whole-sign", "equal", "campanus", "regiomontanus", "porphyry"]),
  zodiac: z.enum(["tropical", "sidereal"]),
  pointOrbs: z.record(z.number().min(0).max(15)),
  visiblePointKeys: z.record(z.boolean())
}).strict();

export const saveCalculationProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  config: calculationProfileConfigSchema
}).strict();

export const updateCalculationProfileSchema = saveCalculationProfileSchema.extend({
  revision: z.number().int().min(1)
});
