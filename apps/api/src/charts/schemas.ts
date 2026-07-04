import type { HouseSystem } from "@astroprocessor/astrology-core";
import { z } from "zod";

const houseSystemValues = [
  "placidus",
  "whole-sign",
  "equal",
  "koch",
  "campanus",
  "regiomontanus",
  "porphyry"
] as const satisfies readonly [HouseSystem, ...HouseSystem[]];

const pointOrbsSchema = z.record(z.number().min(0).max(15)).optional();

export const natalPreviewSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  birthTimeKnown: z.boolean().default(true),
  timezone: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  houseSystem: z.enum(houseSystemValues).optional(),
  zodiac: z.enum(["tropical", "sidereal"]).optional(),
  pointOrbs: pointOrbsSchema
});

export const transitPreviewSchema = z.object({
  transitDateTime: z.string().datetime({ offset: true }),
  natal: natalPreviewSchema,
  zodiac: z.enum(["tropical", "sidereal"]).optional(),
  pointOrbs: pointOrbsSchema
});

export const synastryPreviewSchema = z.object({
  subjectA: natalPreviewSchema,
  subjectB: natalPreviewSchema,
  zodiac: z.enum(["tropical", "sidereal"]).optional(),
  pointOrbs: pointOrbsSchema
});
