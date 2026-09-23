import { EVENT_KINDS, EVENT_PLANETS, searchAstronomicalEvents } from "@astroprocessor/astrology-core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { env } from "../config/env";
import { natalPreviewSchema } from "./schemas";

export const eventSearchSchema = z.object({
  natal: natalPreviewSchema, from: z.string().datetime({ offset: true }), until: z.string().datetime({ offset: true }),
  kinds: z.array(z.enum(EVENT_KINDS)).min(1).max(6), planets: z.array(z.enum(EVENT_PLANETS)).min(1).max(10),
  aspectOrb: z.number().min(0).max(5).default(1)
}).strict().refine((value) => {
  const start = Date.parse(value.from), end = Date.parse(value.until);
  return end > start && end - start <= 93 * 86400000 && new Date(start).getUTCFullYear() >= 1900 && new Date(end - 1).getUTCFullYear() <= 2100;
}, "Період пошуку: до 93 днів у межах 1900–2100 років.");

export async function registerEventSearchRoutes(app: FastifyInstance, deps: {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  calculate: typeof searchAstronomicalEvents;
} = { authenticate: getOptionalAuthUser, calculate: searchAstronomicalEvents }) {
  app.post("/charts/events/search", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    if (!await deps.authenticate(request)) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = eventSearchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевір період (до 93 днів), планети, типи подій та орбіс 0–5°." });
    try { return deps.calculate({ ...parsed.data, natal: { ...parsed.data.natal, ephemerisPath: env.swissEphEphePath } }); }
    catch (failure) { return reply.code(422).send({ message: failure instanceof Error ? failure.message : "Не вдалося знайти події." }); }
  });
}
