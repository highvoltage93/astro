import { Prisma, type KnowledgeNote, type KnowledgeNoteRevision } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { createNoteSchema, matchNotesSchema, noteIdSchema, noteListSchema, updateNoteSchema } from "./schemas";
import { matchingConditions } from "./matching";

export type KnowledgeDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  database: Pick<typeof prisma, "knowledgeNote" | "knowledgeNoteRevision" | "birthProfile" | "$transaction">;
};
const summary = { id: true, title: true, tags: true, archived: true, revision: true, createdAt: true, updatedAt: true } as const;
const view = (record: KnowledgeNote) => ({ id: record.id, title: record.title, tags: record.tags, archived: record.archived,
  revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt,
  body: record.body, conditions: record.conditionsJson, sourceProfileId: record.sourceProfileId, sourceLabel: record.sourceLabel });
const revisionView = (record: KnowledgeNoteRevision) => ({ revision: record.revision, title: record.title, body: record.body,
  tags: record.tags, conditions: record.conditionsJson, archived: record.archived, savedAt: record.savedAt });
const historyData = (record: KnowledgeNote) => ({ noteId: record.id, revision: record.revision, title: record.title, body: record.body,
  tags: record.tags, conditionsJson: record.conditionsJson as Prisma.InputJsonValue, archived: record.archived, savedAt: record.updatedAt });

export async function registerKnowledgeNoteRoutes(app: FastifyInstance, {
  authenticate, database: db
}: KnowledgeDependencies = { authenticate: getOptionalAuthUser, database: prisma }): Promise<void> {
  await app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "private, no-store"); });
    routes.post("/matches", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const parsed = matchNotesSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Не вдалося зіставити дані натальної карти." });
      const { chart, cursor } = parsed.data;
      const anchor = cursor ? await db.knowledgeNote.findFirst({ where: { id: cursor, ownerUserId: user.id }, select: { id: true, createdAt: true } }) : null;
      if (cursor && !anchor) return reply.code(400).send({ message: "Список змінився. Оновіть збіги." });
      const records = await db.knowledgeNote.findMany({
        where: { ownerUserId: user.id, archived: false, ...(anchor ? { OR: [
          { createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }
        ] } : {}) },
        select: { ...summary, conditionsJson: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 501
      });
      const matches = [];
      let nextCursor: string | null = null;
      // Bound each request, including libraries with many nonmatching observations.
      for (let index = 0; index < Math.min(records.length, 500); index++) {
        const { conditionsJson, ...note } = records[index]!;
        const conditions = matchingConditions(conditionsJson, chart);
        if (conditions) matches.push({ ...note, conditions });
        if (matches.length === 20 || index === 499) {
          nextCursor = index + 1 < records.length ? note.id : null;
          break;
        }
      }
      return { matches, nextCursor };
    });
    routes.get("/", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const parsed = noteListSchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректні фільтри." });
      const { query, status, cursor, limit } = parsed.data;
      const anchor = cursor ? await db.knowledgeNote.findFirst({ where: { id: cursor, ownerUserId: user.id }, select: { id: true, createdAt: true } }) : null;
      if (cursor && !anchor) return reply.code(400).send({ message: "Оновіть список спостережень." });
      const records = await db.knowledgeNote.findMany({
        where: { ownerUserId: user.id, ...(status === "all" ? {} : { archived: status === "archived" }), AND: [
          ...(query ? [{ OR: [{ title: { contains: query, mode: "insensitive" as const } }, { body: { contains: query, mode: "insensitive" as const } }, { tags: { has: query } }] }] : []),
          ...(anchor ? [{ OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] }] : [])
        ] }, select: summary, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1
      });
      return { notes: records.slice(0, limit), nextCursor: records.length > limit ? records[limit - 1]!.id : null };
    });
    routes.get("/:id", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректний ідентифікатор." });
      const record = await db.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id } });
      if (!record) return reply.code(404).send({ message: "Спостереження недоступне." });
      return { note: view(record) };
    });
    routes.post("/", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const parsed = createNoteSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? "Перевірте нотатку." });
      const { id, draft, sourceProfileId } = parsed.data;
      try {
        const result = await db.$transaction(async (tx) => {
          const existing = await tx.knowledgeNote.findUnique({ where: { id } });
          if (existing) {
            if (existing.ownerUserId !== user.id || existing.title !== draft.title || existing.body !== draft.body ||
              existing.archived !== draft.archived || existing.sourceProfileId !== (sourceProfileId ?? null) ||
              JSON.stringify(existing.tags) !== JSON.stringify(draft.tags) ||
              !isDeepStrictEqual(existing.conditionsJson, draft.conditions)) {
              return { status: 409, message: "Запис із цим ID уже існує. Відкрийте його перед редагуванням." };
            }
            return { note: view(existing) };
          }
          const source = sourceProfileId ? await tx.birthProfile.findFirst({ where: { id: sourceProfileId, ownerUserId: user.id }, select: { id: true, displayName: true } }) : null;
          if (sourceProfileId && !source) return { status: 404, message: "Карта-джерело недоступна. Можна зберегти спостереження без неї." };
          const { conditions, ...fields } = draft;
          const record = await tx.knowledgeNote.create({ data: { id, ownerUserId: user.id, ...fields,
            conditionsJson: conditions, sourceProfileId: source?.id, sourceLabel: source?.displayName } });
          await tx.knowledgeNoteRevision.create({ data: historyData(record) });
          return { note: view(record) };
        });
        if (result.status !== undefined) return reply.code(result.status).send({ message: result.message });
        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003"].includes(error.code)) return reply.code(409).send({ message: "Дані змінилися. Повторіть збереження або відкрийте список." });
        throw error;
      }
    });
    routes.put("/:id", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      const parsed = updateNoteSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return reply.code(400).send({ message: "Перевірте назву, текст і умови." });
      const { revision, draft: { conditions, ...fields } } = parsed.data;
      try {
        const record = await db.$transaction(async (tx) => {
          const updated = await tx.knowledgeNote.update({ where: { id: params.data.id, ownerUserId: user.id, revision },
            data: { ...fields, conditionsJson: conditions, revision: { increment: 1 } } });
          await tx.knowledgeNoteRevision.create({ data: historyData(updated) });
          if (updated.archived) await tx.knowledgePublication.updateMany({
            where: { noteId: updated.id, published: true }, data: { published: false, revision: { increment: 1 } }
          });
          return updated;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return { note: view(record) };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          return reply.code(409).send({ message: "Нотатка або публікація змінилася одночасно. Перечитайте запис і повторіть збереження." });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          const current = await db.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
          return reply.code(current ? 409 : 404).send({ message: current ? "Запис уже змінено. Ваш текст залишився у формі; відкрийте актуальну версію або збережіть як новий." : "Спостереження недоступне." });
        }
        throw error;
      }
    });
    routes.delete("/:id", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      const query = z.object({ revision: z.coerce.number().int().positive() }).safeParse(request.query);
      if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректна редакція." });
      const result = await db.knowledgeNote.deleteMany({ where: { id: params.data.id, ownerUserId: user.id, revision: query.data.revision } });
      if (!result.count) {
        const current = await db.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
        if (current) return reply.code(409).send({ message: "Нотатка змінилась. Оновіть її перед видаленням." });
      }
      return { deletedId: params.data.id };
    });
    routes.get("/:id/history", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      const query = z.object({ before: z.coerce.number().int().positive().optional() }).safeParse(request.query);
      if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректна редакція." });
      const note = await db.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
      if (!note) return reply.code(404).send({ message: "Спостереження недоступне." });
      const records = await db.knowledgeNoteRevision.findMany({ where: { noteId: note.id, note: { ownerUserId: user.id }, ...(query.data.before ? { revision: { lt: query.data.before } } : {}) },
        select: { revision: true, title: true, savedAt: true }, orderBy: { revision: "desc" }, take: 21 });
      return { history: records.slice(0, 20), nextBefore: records.length > 20 ? records[19]!.revision : null };
    });
    routes.get("/:id/history/:revision", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.extend({ revision: z.coerce.number().int().positive() }).safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректна редакція." });
      const record = await db.knowledgeNoteRevision.findFirst({ where: { noteId: params.data.id, revision: params.data.revision, note: { ownerUserId: user.id } } });
      if (!record) return reply.code(404).send({ message: "Редакція недоступна." });
      return { entry: revisionView(record) };
    });
  }, { prefix: "/knowledge-notes" });
}
