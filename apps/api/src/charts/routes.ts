import {
  calculateForecastPreview,
  calculateNatalChart,
  calculateSynastryPreview,
  calculateTransitPreview
} from "@astroprocessor/astrology-core";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { forecastPreviewSchema, natalPreviewSchema, synastryPreviewSchema, transitPreviewSchema } from "./schemas";

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

  app.post("/charts/transits/preview", async (request, reply) => {
    const parsed = transitPreviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_TRANSIT_PREVIEW_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      return calculateTransitPreview({
        ...parsed.data,
        ephemerisPath: env.swissEphEphePath
      });
    } catch (error) {
      return reply.code(422).send({
        code: "TRANSIT_CALCULATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to calculate transit preview"
      });
    }
  });

  app.post("/charts/forecast/preview", async (request, reply) => {
    const parsed = forecastPreviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_FORECAST_PREVIEW_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      return calculateForecastPreview({
        ...parsed.data,
        ephemerisPath: env.swissEphEphePath
      });
    } catch (error) {
      return reply.code(422).send({
        code: "FORECAST_CALCULATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to calculate forecast preview"
      });
    }
  });

  app.post("/charts/synastry/preview", async (request, reply) => {
    const parsed = synastryPreviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_SYNASTRY_PREVIEW_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      return calculateSynastryPreview({
        ...parsed.data,
        ephemerisPath: env.swissEphEphePath
      });
    } catch (error) {
      return reply.code(422).send({
        code: "SYNASTRY_CALCULATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to calculate synastry preview"
      });
    }
  });
};
