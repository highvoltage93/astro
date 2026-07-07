import { createHash } from "node:crypto";
import { calculateNatalChart, generateNatalInterpretationPreview } from "@astroprocessor/astrology-core";
import type { ChartResult, HouseSystem } from "@astroprocessor/astrology-core";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
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
  birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable().optional(),
  birthTimeKnown: z.boolean().default(true),
  birthplaceName: z.string().min(1).max(180),
  countryCode: z.string().length(2).optional(),
  timezone: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  houseSystem: z.enum(houseSystemValues).default("koch"),
  zodiac: z.enum(["tropical", "sidereal"]).default("tropical"),
  pointOrbs: z.record(z.number().min(0).max(15)).optional()
});

const listBirthProfilesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

const birthProfileParamsSchema = z.object({
  id: z.string().min(1)
});

const toDateOnly = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const hashInput = (input: unknown): string =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");

const toJson = (input: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;

export const registerBirthProfileRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/birth-profiles", async (request, reply) => {
    const authUser = await getOptionalAuthUser(request);
    const parsed = listBirthProfilesSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_BIRTH_PROFILE_LIST_INPUT",
        issues: parsed.error.flatten()
      });
    }

    const profiles = await prisma.birthProfile.findMany({
      where: {
        ownerUserId: authUser?.id ?? null
      },
      orderBy: {
        createdAt: "desc"
      },
      take: parsed.data.limit,
      include: {
        calculations: {
          orderBy: {
            calculatedAt: "desc"
          },
          take: 1
        }
      }
    });

    return {
      profiles: profiles.map((profile) => {
        const latestCalculation = profile.calculations[0];

        return {
          id: profile.id,
          displayName: profile.displayName,
          birthDate: formatDateOnly(profile.birthDate),
          birthTime: profile.birthTime,
          birthTimeKnown: profile.birthTimeKnown,
          birthplaceName: profile.birthplaceName,
          countryCode: profile.countryCode,
          latitude: profile.latitude,
          longitude: profile.longitude,
          timezone: profile.timezone,
          createdAt: profile.createdAt,
          latestCalculation: latestCalculation
            ? {
                id: latestCalculation.id,
                chartType: latestCalculation.chartType,
                zodiacType: latestCalculation.zodiacType,
                houseSystem: latestCalculation.houseSystem,
                engineVersion: latestCalculation.calculationEngineVersion,
                calculatedAt: latestCalculation.calculatedAt
              }
            : null
        };
      })
    };
  });

  app.get("/birth-profiles/:id", async (request, reply) => {
    const authUser = await getOptionalAuthUser(request);
    const parsed = birthProfileParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_BIRTH_PROFILE_ID",
        issues: parsed.error.flatten()
      });
    }

    const profile = await prisma.birthProfile.findUnique({
      where: {
        id: parsed.data.id
      },
      include: {
        calculations: {
          orderBy: {
            calculatedAt: "desc"
          },
          take: 1
        }
      }
    });

    if (!profile || profile.ownerUserId !== (authUser?.id ?? null)) {
      return reply.code(404).send({
        code: "BIRTH_PROFILE_NOT_FOUND",
        message: "Birth profile was not found"
      });
    }

    const latestCalculation = profile.calculations[0] ?? null;
    const chart = latestCalculation?.resultJson as ChartResult | undefined;

    return {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        birthDate: formatDateOnly(profile.birthDate),
        birthTime: profile.birthTime,
        birthTimeKnown: profile.birthTimeKnown,
        birthplaceName: profile.birthplaceName,
        countryCode: profile.countryCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
        timezone: profile.timezone,
        createdAt: profile.createdAt,
        latestCalculation: latestCalculation
          ? {
              id: latestCalculation.id,
              chartType: latestCalculation.chartType,
              zodiacType: latestCalculation.zodiacType,
              houseSystem: latestCalculation.houseSystem,
              engineVersion: latestCalculation.calculationEngineVersion,
              calculatedAt: latestCalculation.calculatedAt
            }
          : null
      },
      latestCalculation:
        latestCalculation && chart
          ? {
              id: latestCalculation.id,
              chartType: latestCalculation.chartType,
              zodiacType: latestCalculation.zodiacType,
              houseSystem: latestCalculation.houseSystem,
              engineVersion: latestCalculation.calculationEngineVersion,
              calculatedAt: latestCalculation.calculatedAt,
              result: chart
            }
          : null,
      interpretation: chart ? generateNatalInterpretationPreview(chart) : null
    };
  });

  app.delete("/birth-profiles/:id", async (request, reply) => {
    const authUser = await getOptionalAuthUser(request);
    const parsed = birthProfileParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_BIRTH_PROFILE_ID",
        issues: parsed.error.flatten()
      });
    }

    const profile = await prisma.birthProfile.findUnique({
      where: {
        id: parsed.data.id
      },
      select: {
        id: true,
        ownerUserId: true
      }
    });

    if (!profile || profile.ownerUserId !== (authUser?.id ?? null)) {
      return reply.code(404).send({
        code: "BIRTH_PROFILE_NOT_FOUND",
        message: "Birth profile was not found"
      });
    }

    await prisma.$transaction([
      prisma.aiSession.deleteMany({
        where: {
          birthProfileId: profile.id
        }
      }),
      prisma.chartCalculation.deleteMany({
        where: {
          birthProfileId: profile.id
        }
      }),
      prisma.birthProfile.delete({
        where: {
          id: profile.id
        }
      })
    ]);

    return {
      deletedProfileId: profile.id
    };
  });

  app.post("/birth-profiles", async (request, reply) => {
    const authUser = await getOptionalAuthUser(request);
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
        birthTime: input.birthTime ?? "12:00:00",
        birthTimeKnown: input.birthTimeKnown,
        timezone: input.timezone,
        latitude: input.latitude,
        longitude: input.longitude,
        houseSystem: input.houseSystem,
        zodiac: input.zodiac,
        pointOrbs: input.pointOrbs,
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
        ownerUserId: authUser?.id,
        displayName: input.displayName,
        birthDate: toDateOnly(input.birthDate),
        birthTime: input.birthTimeKnown ? input.birthTime : null,
        birthTimeKnown: input.birthTimeKnown,
        birthplaceName: input.birthplaceName,
        countryCode: input.countryCode,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone,
        utcDateTime: input.birthTimeKnown && input.birthTime ? new Date(preview.subject.utcDateTime) : null,
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
