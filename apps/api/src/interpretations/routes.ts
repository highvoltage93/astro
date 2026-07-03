import { calculateNatalChart, generateNatalInterpretationPreview } from "@astroprocessor/astrology-core";
import type { FastifyInstance } from "fastify";
import { natalPreviewSchema } from "../charts/schemas";
import { env } from "../config/env";

export const registerInterpretationRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/interpretations/natal/preview", async (request, reply) => {
    const parsed = natalPreviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_NATAL_INTERPRETATION_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      const chart = calculateNatalChart({
        ...parsed.data,
        ephemerisPath: env.swissEphEphePath
      });

      return generateNatalInterpretationPreview(chart);
    } catch (error) {
      return reply.code(422).send({
        code: "NATAL_INTERPRETATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to generate natal interpretation"
      });
    }
  });
};

