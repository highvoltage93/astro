import { CALENDAR_CATEGORIES, EVENT_PLANETS } from "@astroprocessor/astrology-core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { env } from "../config/env";
import { CalendarBusyError, runAstroCalendar } from "./service";

export const astroCalendarSchema = z.object({
  category: z.enum(CALENDAR_CATEGORIES), from: z.string().datetime({ offset: true }), until: z.string().datetime({ offset: true }),
  planet: z.enum(EVENT_PLANETS).optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  lunarDayMethod: z.enum(["moonrise", "tithi"]).default("moonrise")
}).strict().refine((input) => {
  const from = Date.parse(input.from), until = Date.parse(input.until);
  const days = ["lunar-days", "void-moon", "moon-phases"].includes(input.category) ? 32 : 367;
  return until > from && until - from <= days * 86400000 && new Date(from).getUTCFullYear() >= 1900 && new Date(until - 1).getUTCFullYear() <= 2100;
}, "Період поза доступними межами.");

export async function registerAstroEventRoutes(app: FastifyInstance, deps: {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>; calculate: typeof runAstroCalendar;
} = { authenticate: getOptionalAuthUser, calculate: runAstroCalendar }) {
  app.post("/astro-events", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    if (!await deps.authenticate(request)) return reply.code(401).send({ message: "Увійдіть до акаунта." });
    const parsed = astroCalendarSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевірте період, планету та місто. Місячні події: до 32 днів; інші: до року, 1900–2100." });
    const controller = new AbortController();
    const close = () => controller.abort();
    reply.raw.once("close", close);
    try { return await deps.calculate({ ...parsed.data, ephemerisPath: env.swissEphEphePath }, controller.signal); }
    catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof CalendarBusyError) reply.header("Retry-After", "5");
      return reply.code(error instanceof CalendarBusyError ? 503 : 422).send({ message: error instanceof Error ? error.message : "Не вдалося розрахувати астроподії." });
    } finally { reply.raw.removeListener("close", close); }
  });
}
