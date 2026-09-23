import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConsultationDependencies } from "./routes";

const finite = z.number().finite();
const longitude = finite.min(0).lt(360);
const point = z.object({ key: z.string(), label: z.string(), kind: z.string(), longitude,
  sign: z.string(), signDegree: finite.min(0).lt(30), house: z.number().int().min(1).max(12).optional(), speed: finite.optional() });
export const printChartSchema = z.object({
  settings: z.object({ houseSystem: z.string(), zodiac: z.string() }),
  bodies: z.array(point).min(1).max(100), angles: z.array(point).max(12),
  houses: z.array(z.object({ house: z.number().int().min(1).max(12), longitude, sign: z.string(), signDegree: finite.min(0).lt(30) })).max(12),
  aspects: z.array(z.object({ bodyA: z.string(), bodyB: z.string(), type: z.string(), exactAngle: finite, orb: finite.nonnegative() })).max(10000),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).max(100).optional()
});
const instant = z.string().datetime({ offset: true });
const event = z.object({ id: z.string(), source: z.enum(["transit", "secondary-progression", "solar-arc", "solar-return", "lunar-return"]),
  exactAt: instant, bodyA: z.string().optional(), bodyB: z.string().optional(), aspectType: z.string().optional(),
  exactAngle: finite.optional(), orb: finite.nonnegative().optional() });
const forecastSchema = z.object({
  generatedAt: instant, natal: printChartSchema,
  solarReturn: z.object({ exactAt: instant, validUntil: instant.optional(), chart: printChartSchema }).nullable(),
  timelineEvents: z.array(event).max(10000).default([]),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).max(100).optional()
});
const identitySchema = z.object({ subject: z.object({ utcDateTime: instant, birthTimeKnown: z.boolean(), latitude: finite, longitude: finite }) });

export function projectPrintAssets(source: unknown, forecast?: { id: string; title: string; inputJson: unknown; resultJson: unknown }) {
  const raw = z.object({ chart: z.unknown() }).parse(source).chart;
  const natal = printChartSchema.safeParse(raw);
  if (!forecast) return { natal: natal.success ? natal.data : null, forecast: null };
  const result = forecastSchema.parse(forecast.resultJson);
  const left = identitySchema.safeParse(raw);
  const right = z.object({ natal: identitySchema }).safeParse(forecast.resultJson);
  const compatibility = !left.success || !right.success || !natal.success ? "unknown" :
    JSON.stringify(left.data) === JSON.stringify(right.data.natal) && JSON.stringify(natal.data) === JSON.stringify(result.natal) ? "match" : "different";
  const context = z.object({ context: z.object({ subject: z.object({ displayName: z.string() }) }) }).safeParse(forecast.inputJson);
  return { natal: natal.success ? natal.data : null, forecast: {
    id: forecast.id, title: forecast.title, subjectName: context.success ? context.data.context.subject.displayName : "",
    generatedAt: result.generatedAt, compatibility, solarReturn: result.solarReturn, events: result.timelineEvents, warnings: result.warnings
  } };
}

export async function registerConsultationPrintAssets(app: FastifyInstance, { authenticate, database: db }: ConsultationDependencies) {
  app.get("/consultations/:id/print-forecasts", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ query: z.string().trim().max(120).optional(), cursor: z.string().min(1).max(120).optional() }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректні параметри архіву." });
    const owner = await db.consultation.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
    if (!owner) return reply.code(404).send({ message: "Консультація недоступна." });
    const anchor = query.data.cursor ? await db.savedForecast.findFirst({ where: { id: query.data.cursor, ownerUserId: user.id, kind: "forecast" }, select: { id: true, createdAt: true } }) : null;
    if (query.data.cursor && !anchor) return reply.code(400).send({ message: "Онови список прогнозів." });
    const rows = await db.savedForecast.findMany({ where: { ownerUserId: user.id, kind: "forecast",
      ...(query.data.query ? { title: { contains: query.data.query, mode: "insensitive" as const } } : {}),
      ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) },
      select: { id: true, title: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 11 });
    return { forecasts: rows.slice(0, 10), nextCursor: rows.length > 10 ? rows[9]!.id : null };
  });

  app.get("/consultations/:id/print-assets", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ revision: z.coerce.number().int().positive(), forecastId: z.string().min(1).max(120).optional() }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректні параметри друку." });
    const record = await db.consultation.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { revision: true, sourceSnapshotJson: true } });
    if (!record) return reply.code(404).send({ message: "Консультація недоступна." });
    if (record.revision !== query.data.revision) return reply.code(409).send({ message: "Редакція консультації змінилася. Онови клієнтський документ." });
    const forecast = query.data.forecastId ? await db.savedForecast.findFirst({
      where: { id: query.data.forecastId, ownerUserId: user.id, kind: "forecast" },
      select: { id: true, title: true, inputJson: true, resultJson: true }
    }) : null;
    if (query.data.forecastId && !forecast) return reply.code(404).send({ message: "Прогноз видалений або недоступний." });
    try { return projectPrintAssets(record.sourceSnapshotJson, forecast ?? undefined); }
    catch (failure) {
      if (failure instanceof z.ZodError) return reply.code(422).send({ message: "Збережений формат карти або прогнозу не підтримується для друку." });
      throw failure;
    }
  });
}
