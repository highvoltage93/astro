import { createHash } from "node:crypto";
import { calculateNatalChart } from "@astroprocessor/astrology-core";
import type { HouseSystem } from "@astroprocessor/astrology-core";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../prisma/client";

const houseSystemValues = [
  "placidus",
  "whole-sign",
  "equal",
  "koch",
  "campanus",
  "regiomontanus",
  "porphyry"
] as const satisfies readonly [HouseSystem, ...HouseSystem[]];

const createBirthProfileSchema = z.object({
  displayName: z.string().min(1).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  birthTimeKnown: z.boolean().default(true),
  birthplaceName: z.string().min(1).max(180),
  countryCode: z.string().length(2).optional(),
  timezone: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  houseSystem: z.enum(houseSystemValues).default("placidus"),
  zodiac: z.enum(["tropical", "sidereal"]).default("tropical")
});

const toDateOnly = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

const toUtcDateTime = (date: string, time?: string | null): Date | null => {
  if (!time) {
    return null;
  }

  return new Date(`${date}T${time}:00.000Z`);
};

const hashInput = (input: unknown): string =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");

const toJson = (input: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;

export const registerBirthProfileRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/birth-profiles", async (request, reply) => {
    const parsed = createBirthProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_BIRTH_PROFILE_INPUT",
        issues: parsed.error.flatten()
      });
    }

    const input = parsed.data;
    let preview;

    try {
      preview = calculateNatalChart({
        birthDate: input.birthDate,
        birthTime: input.birthTime ?? "12:00",
        timezone: input.timezone,
        latitude: input.latitude,
        longitude: input.longitude,
        houseSystem: input.houseSystem,
        zodiac: input.zodiac,
        ephemerisPath: env.swissEphEphePath
      });
    } catch (error) {
      return reply.code(422).send({
        code: "NATAL_CALCULATION_FAILED",
        message: error instanceof Error ? error.message : "Unable to calculate natal chart"
      });
    }

    const inputHash = hashInput(input);

    const birthProfile = await prisma.birthProfile.create({
      data: {
        displayName: input.displayName,
        birthDate: toDateOnly(input.birthDate),
        birthTime: input.birthTime,
        birthTimeKnown: input.birthTimeKnown,
        birthplaceName: input.birthplaceName,
        countryCode: input.countryCode,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone,
        utcDateTime: toUtcDateTime(input.birthDate, input.birthTime),
        source: "manual",
        calculations: {
          create: {
            chartType: "NATAL",
            zodiacType: preview.settings.zodiac,
            ayanamsa: preview.settings.ayanamsa,
            houseSystem: preview.settings.houseSystem,
            calculationEngineVersion: `${preview.engine.name}@${preview.engine.version}`,
            inputHash,
            settingsJson: toJson(preview.settings),
            resultJson: toJson(preview),
            warningsJson: toJson(preview.warnings)
          }
        }
      },
      include: {
        calculations: true
      }
    });

    const calculation = birthProfile.calculations[0];

    return reply.code(201).send({
      birthProfile: {
        id: birthProfile.id,
        displayName: birthProfile.displayName,
        birthplaceName: birthProfile.birthplaceName,
        timezone: birthProfile.timezone,
        createdAt: birthProfile.createdAt
      },
      chartCalculation: calculation
        ? {
            id: calculation.id,
            chartType: calculation.chartType,
            engineVersion: calculation.calculationEngineVersion,
            calculatedAt: calculation.calculatedAt
          }
        : null
    });
  });
};
