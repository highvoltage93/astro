import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { getOptionalAuthUser } from "../auth/service";
import { clientQuery } from "./schema";

export const eventCategory = z.enum(["relocation", "work", "relationships", "family", "health", "education", "other"]);
export const eventInput = z.object({
  title: z.string().trim().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return value.slice(0, 4) !== "0000" && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  approximate: z.boolean(), category: eventCategory, notes: z.string().max(20000)
}).strict();
const createInput = eventInput.extend({ id: z.string().uuid() });
const updateInput = eventInput.extend({ revision: z.number().int().positive() });
const deleteInput = z.object({ revision: z.number().int().positive() }).strict();
const queryInput = clientQuery.extend({ category: eventCategory.optional() });

export async function registerClientEventRoutes(app: FastifyInstance, deps = { database: prisma, authenticate: getOptionalAuthUser }) {
  app.get<{ Params: { id: string } }>("/:id/events", async (request, reply) => {
    const user = await deps.authenticate(request);
    if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
    const parsed = queryInput.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний пошук подій." });
    if (!await deps.database.client.findFirst({ where: { id: request.params.id, ownerUserId: user.id } })) return reply.code(404).send({ message: "Клієнта не знайдено." });
    const { search, category, page } = parsed.data;
    const events = await deps.database.clientEvent.findMany({
      where: { clientId: request.params.id, client: { ownerUserId: user.id }, ...(category ? { category } : {}),
        OR: [{ title: { contains: search, mode: "insensitive" } }, { notes: { contains: search, mode: "insensitive" } }] },
      orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 26
    });
    return { events: events.slice(0, 25), hasMore: events.length > 25 };
  });
  app.post<{ Params: { id: string } }>("/:id/events", { bodyLimit: 131072 }, async (request, reply) => {
    const user = await deps.authenticate(request);
    if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
    const parsed = createInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевірте назву, дату та категорію події." });
    if (!await deps.database.client.findFirst({ where: { id: request.params.id, ownerUserId: user.id } })) return reply.code(404).send({ message: "Клієнта не знайдено." });
    const { date, ...data } = parsed.data;
    try {
      const event = await deps.database.clientEvent.upsert({ where: { id: data.id }, update: {},
        create: { ...data, clientId: request.params.id, date: new Date(`${date}T00:00:00.000Z`) } });
      if (event.clientId !== request.params.id || event.title !== data.title || event.date.toISOString().slice(0, 10) !== date || event.category !== data.category || event.notes !== data.notes || event.approximate !== data.approximate) return reply.code(409).send({ message: "Запит уже використано. Оновіть історію подій." });
      return { event };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return reply.code(409).send({ message: "Клієнт уже недоступний. Оновіть сторінку." });
      throw error;
    }
  });
  app.put<{ Params: { id: string; eventId: string } }>("/:id/events/:eventId", { bodyLimit: 131072 }, async (request, reply) => {
    const user = await deps.authenticate(request);
    if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
    const parsed = updateInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевірте поля події." });
    const { revision, date, ...data } = parsed.data;
    const changed = await deps.database.clientEvent.updateMany({ where: { id: request.params.eventId, clientId: request.params.id, client: { ownerUserId: user.id }, revision },
      data: { ...data, date: new Date(`${date}T00:00:00.000Z`), revision: { increment: 1 } } });
    if (!changed.count) return reply.code(409).send({ message: "Подія змінилася або недоступна. Оновіть історію." });
    return { saved: true };
  });
  app.delete<{ Params: { id: string; eventId: string } }>("/:id/events/:eventId", async (request, reply) => {
    const user = await deps.authenticate(request);
    if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
    const parsed = deleteInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Оновіть подію перед видаленням." });
    const deleted = await deps.database.clientEvent.deleteMany({ where: { id: request.params.eventId, clientId: request.params.id,
      client: { ownerUserId: user.id }, revision: parsed.data.revision } });
    if (!deleted.count) return reply.code(409).send({ message: "Подія змінилася або недоступна. Оновіть історію." });
    return { deleted: true };
  });
}
