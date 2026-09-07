import { createHash } from "node:crypto";
import { calculateForecastPreview, calculateSynastryPreview, calculateTransitPreview, generateNatalInterpretationPreview } from "@astroprocessor/astrology-core";
import type { Prisma, SavedForecast } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { env } from "../config/env";
import { prisma } from "../prisma/client";
import { listForecastsSchema, saveForecastSchema, savedForecastInputSchema } from "./schemas";

const calculateSnapshot = (input: z.infer<typeof savedForecastInputSchema>) => {
  const result = input.kind === "forecast"
    ? calculateForecastPreview({ ...input.parameters, ephemerisPath: env.swissEphEphePath })
    : input.kind === "transit"
      ? calculateTransitPreview({ ...input.parameters, ephemerisPath: env.swissEphEphePath })
      : calculateSynastryPreview({ ...input.parameters, ephemerisPath: env.swissEphEphePath });
  const interpretation = generateNatalInterpretationPreview(result.chartType === "synastry" ? result.subjectA : result.natal);
  return { result, interpretation };
};

export type SavedForecastDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  store: Pick<typeof prisma.savedForecast, "findFirst" | "findMany" | "findUnique" | "deleteMany" | "upsert">;
  calculate: typeof calculateSnapshot;
};

const summarySelect = {
  id: true, kind: true, title: true, notes: true, schemaVersion: true, createdAt: true
} as const;

const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const detail = (record: SavedForecast) => ({
  id: record.id,
  kind: record.kind,
  title: record.title,
  notes: record.notes,
  schemaVersion: record.schemaVersion,
  createdAt: record.createdAt,
  input: record.inputJson,
  result: record.resultJson,
  interpretation: record.interpretationJson
});

export const registerSavedForecastRoutes = async (
  app: FastifyInstance,
  { authenticate, store, calculate }: SavedForecastDependencies = {
    authenticate: getOptionalAuthUser, store: prisma.savedForecast, calculate: calculateSnapshot
  }
): Promise<void> => {
  app.get("/saved-forecasts", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = listForecastsSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректні параметри пошуку." });
    const { limit, cursor, query, kind } = parsed.data;
    const anchor = cursor ? await store.findFirst({
      where: { id: cursor, ownerUserId: user.id }, select: { id: true, createdAt: true }
    }) : null;
    if (cursor && !anchor) return reply.code(400).send({ message: "Онови список прогнозів." });

    const records = await store.findMany({
      where: {
        ownerUserId: user.id,
        ...(kind ? { kind } : {}),
        AND: [
          ...(query ? [{ OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { notes: { contains: query, mode: "insensitive" as const } }
          ] }] : []),
          ...(anchor ? [{ OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } }
          ] }] : [])
        ]
      },
      select: summarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    const forecasts = records.slice(0, limit);
    return { forecasts, nextCursor: records.length > limit ? forecasts.at(-1)?.id ?? null : null };
  });

  app.get("/saved-forecasts/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний ідентифікатор прогнозу." });
    const record = await store.findFirst({ where: { id: parsed.data.id, ownerUserId: user.id } });
    if (!record) return reply.code(404).send({ message: "Прогноз видалений або недоступний цьому користувачу." });
    return { forecast: detail(record) };
  });

  app.delete("/saved-forecasts/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний ідентифікатор прогнозу." });
    const deleted = await store.deleteMany({ where: { id: parsed.data.id, ownerUserId: user.id } });
    if (!deleted.count) return reply.code(404).send({ message: "Прогноз не знайдено." });
    return { deletedForecastId: parsed.data.id };
  });

  app.post("/saved-forecasts", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = saveForecastSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевір назву, нотатки та параметри прогнозу.", issues: parsed.error.flatten() });
    const { input, requestId, title, notes } = parsed.data;
    const inputHash = createHash("sha256").update(JSON.stringify({ input, title, notes })).digest("hex");
    const where = { ownerUserId_requestId: { ownerUserId: user.id, requestId } };
    const existing = await store.findUnique({ where });
    if (existing) {
      if (existing.inputHash !== inputHash) return reply.code(409).send({ message: "Цей запит уже збережено з іншими даними." });
      return { forecast: detail(existing) };
    }

    // Only the server's calculation enters the archive, never a client-supplied result.
    let snapshot: ReturnType<typeof calculateSnapshot>;
    try {
      snapshot = calculate(input);
    } catch {
      return reply.code(422).send({ message: "Не вдалося розрахувати прогноз для збереження. Попередні результати залишилися без змін." });
    }

    const record = await store.upsert({
      where,
      update: {},
      create: {
        ownerUserId: user.id, requestId, inputHash, kind: input.kind, title, notes,
        inputJson: toJson(input), resultJson: toJson(snapshot.result), interpretationJson: toJson(snapshot.interpretation)
      }
    });
    if (record.inputHash !== inputHash) return reply.code(409).send({ message: "Цей запит уже збережено з іншими даними." });
    return reply.code(201).send({ forecast: detail(record) });
  });
};
