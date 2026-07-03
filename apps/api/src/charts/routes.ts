import { calculateNatalChart } from "@astroprocessor/astrology-core";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { natalPreviewSchema } from "./schemas";

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
