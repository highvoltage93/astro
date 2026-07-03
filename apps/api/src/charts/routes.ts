import { calculateNatalChart } from "@astroprocessor/astrology-core";
import type { HouseSystem } from "@astroprocessor/astrology-core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env";

const houseSystemValues = [
  "placidus",
  "whole-sign",
  "equal",
  "koch",
  "campanus",
  "regiomontanus",
  "porphyry"
] as const satisfies readonly [HouseSystem, ...HouseSystem[]];

const natalPreviewSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  houseSystem: z.enum(houseSystemValues).optional(),
  zodiac: z.enum(["tropical", "sidereal"]).optional()
});

export const registerChartRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/charts/natal/preview", async (request, reply) => {
    const parsed = natalPreviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_NATAL_PREVIEW_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      return calculateNatalChart({
        ...parsed.data,
        ephemerisPath: env.swissEphEphePath
      });
    } catch (error) {
      return reply.code(422).send({
        code: "NATAL_CALCULATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to calculate natal chart"
      });
    }
  });
};
