import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { matchingConditions } from "./matching";
import { matchNotesSchema, noteConditionsSchema, noteIdSchema } from "./schemas";
import { authorActivationSchema, libraryQuerySchema, publicationRevisionSchema, publicationSchema, sharedKnowledgeAccess } from "./sharing";

export type KnowledgeSharingDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  database: Pick<typeof prisma, "user" | "knowledgeNote" | "knowledgePublication" | "knowledgeActivation" | "$transaction">;
};
const publicSelect = {
  noteId: true, title: true, tags: true, conditionsJson: true, revision: true, createdAt: true, updatedAt: true,
  note: { select: { owner: { select: { username: true } } } }
} satisfies Prisma.KnowledgePublicationSelect;
type PublicRecord = Prisma.KnowledgePublicationGetPayload<{ select: typeof publicSelect }>;
export const publicationView = (record: PublicRecord) => ({
  id: record.noteId, title: record.title, tags: record.tags, conditions: record.conditionsJson,
  revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt,
  archived: false, origin: "shared" as const, authorUsername: record.note.owner.username
});
const availableTo = (userId: string): Prisma.KnowledgePublicationWhereInput => ({
  published: true, note: { archived: false, ownerUserId: { not: userId } }
});
const accessFor = async (db: Pick<Prisma.TransactionClient, "user">, id: string) => {
  const user = await db.user.findUnique({ where: { id }, select: { sharedKnowledgeUntil: true } });
  return sharedKnowledgeAccess(user?.sharedKnowledgeUntil);
};
const accessMessage = "Доступ до спостережень інших астрологів не активний або завершився.";

export async function registerKnowledgeSharingRoutes(app: FastifyInstance, {
  authenticate, database: db
}: KnowledgeSharingDependencies = { authenticate: getOptionalAuthUser, database: prisma }) {
  await app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "private, no-store"); });
    routes.setErrorHandler((error, _request, reply) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) {
        return reply.code(409).send({ message: "Публікація або доступ змінилися. Оновіть сторінку та повторіть дію." });
      }
      throw error;
    });

    routes.get("/knowledge-notes/:id/publication", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректний ідентифікатор." });
      const note = await db.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
      if (!note) return reply.code(404).send({ message: "Спостереження недоступне." });
      const publication = await db.knowledgePublication.findUnique({ where: { noteId: note.id },
        select: { noteId: true, title: true, body: true, tags: true, revision: true, sourceRevision: true, published: true, updatedAt: true } });
      return { publication };
    });

    routes.put("/knowledge-notes/:id/publication", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params), parsed = publicationSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return reply.code(400).send({ message: "Перевірте публічний текст і підтвердьте право на публікацію без даних клієнтів." });
      const result = await db.$transaction(async (tx) => {
        const note = await tx.knowledgeNote.findFirst({ where: { id: params.data.id, ownerUserId: user.id } });
        if (!note) return { status: 404, message: "Спостереження недоступне." };
        if (note.archived || note.revision !== parsed.data.noteRevision) return { status: 409, message: "Оновіть нотатку. Архівні спостереження не публікуються." };
        const conditions = noteConditionsSchema.safeParse(note.conditionsJson);
        if (!conditions.success) return { status: 400, message: "Умови спостереження не підтримуються." };
        const existing = await tx.knowledgePublication.findUnique({ where: { noteId: note.id } });
        if ((existing?.revision ?? null) !== parsed.data.publicationRevision) return { status: 409, message: "Публічна редакція змінилася. Перечитайте її перед публікацією." };
        const data = { title: parsed.data.title, body: parsed.data.body, tags: parsed.data.tags,
          conditionsJson: conditions.data, sourceRevision: note.revision, published: true };
        const publication = existing
          ? await tx.knowledgePublication.update({ where: { noteId: note.id, revision: existing.revision }, data: { ...data, revision: { increment: 1 } } })
          : await tx.knowledgePublication.create({ data: { noteId: note.id, ...data } });
        return { publication };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ("status" in result) return reply.code(result.status!).send({ message: result.message });
      return result;
    });

    routes.delete("/knowledge-notes/:id/publication", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params), parsed = publicationRevisionSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return reply.code(400).send({ message: "Некоректна редакція." });
      const result = await db.knowledgePublication.updateMany({ where: { noteId: params.data.id, revision: parsed.data.revision, note: { ownerUserId: user.id } },
        data: { published: false, revision: { increment: 1 } } });
      if (!result.count) return reply.code(409).send({ message: "Публікація змінилася або недоступна. Оновіть її." });
      return { unpublished: true };
    });

    routes.get("/knowledge-library/access", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      return accessFor(db, user.id);
    });

    routes.get("/knowledge-library", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const access = await accessFor(db, user.id);
      if (!access.enabled) return reply.code(403).send({ message: accessMessage });
      const parsed = libraryQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректні фільтри." });
      const { query, author, authorId, view, cursor, limit } = parsed.data;
      const records = await db.knowledgePublication.findMany({ where: { AND: [availableTo(user.id),
        ...(cursor ? [{ noteId: { gt: cursor } }] : []),
        ...(view === "active" ? [{ activations: { some: { userId: user.id } } }] : []),
        ...(author ? [{ note: { owner: { username: { contains: author.replace(/^@/, ""), mode: "insensitive" as const } } } }] : []),
        ...(authorId ? [{ note: { ownerUserId: authorId } }] : []),
        ...(query ? [{ OR: [{ title: { contains: query, mode: "insensitive" as const } }, { tags: { has: query } },
          { note: { owner: { username: { contains: query.replace(/^@/, ""), mode: "insensitive" as const } } } }] }] : [])
      ] }, select: { ...publicSelect, activations: { where: { userId: user.id }, select: { acceptedRevision: true } } }, orderBy: { noteId: "asc" }, take: limit + 1 });
      return { access, notes: records.slice(0, limit).map((record) => ({ ...publicationView(record),
        activated: !!record.activations.length, updateAvailable: !!record.activations.length && record.activations[0]!.acceptedRevision !== record.revision })),
        nextCursor: records.length > limit ? records[limit - 1]!.noteId : null };
    });

    routes.post("/knowledge-library/author-activation", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const parsed = authorActivationSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректний автор." });
      const result = await db.$transaction(async (tx) => {
        if (!(await accessFor(tx, user.id)).enabled) return { status: 403, message: accessMessage };
        // Only new activations: changed revisions still require individual acceptance.
        const publications = await tx.knowledgePublication.findMany({ where: { AND: [availableTo(user.id),
          { note: { ownerUserId: parsed.data.authorId } }, { activations: { none: { userId: user.id } } }
        ] }, select: { noteId: true, revision: true }, orderBy: { noteId: "asc" }, take: 500 });
        if (!publications.length) return { activated: 0 };
        const created = await tx.knowledgeActivation.createMany({ data: publications.map((publication) => ({
          userId: user.id, publicationId: publication.noteId, acceptedRevision: publication.revision
        })), skipDuplicates: true });
        return { activated: created.count };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ("status" in result) return reply.code(result.status!).send({ message: result.message });
      return result;
    });

    routes.get("/knowledge-library/:id", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const access = await accessFor(db, user.id);
      if (!access.enabled) return reply.code(403).send({ message: accessMessage });
      const params = noteIdSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректний ідентифікатор." });
      const record = await db.knowledgePublication.findFirst({ where: { noteId: params.data.id, ...availableTo(user.id) },
        select: { ...publicSelect, body: true, activations: { where: { userId: user.id }, select: { acceptedRevision: true } } } });
      if (!record) return reply.code(404).send({ message: "Публікацію знято або вона недоступна." });
      return { access, note: { ...publicationView(record), body: record.body,
        activated: !!record.activations.length, updateAvailable: !!record.activations.length && record.activations[0]!.acceptedRevision !== record.revision } };
    });

    routes.put("/knowledge-library/:id/activation", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params), parsed = publicationRevisionSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return reply.code(400).send({ message: "Некоректна редакція." });
      const result = await db.$transaction(async (tx) => {
        if (!(await accessFor(tx, user.id)).enabled) return { status: 403, message: accessMessage };
        const publication = await tx.knowledgePublication.findFirst({ where: { noteId: params.data.id, ...availableTo(user.id) }, select: { noteId: true, revision: true } });
        if (!publication) return { status: 404, message: "Публікація недоступна." };
        if (publication.revision !== parsed.data.revision) return { status: 409, message: "Автор оновив публікацію. Перегляньте нову редакцію." };
        await tx.knowledgeActivation.upsert({ where: { userId_publicationId: { userId: user.id, publicationId: publication.noteId } },
          create: { userId: user.id, publicationId: publication.noteId, acceptedRevision: publication.revision },
          update: { acceptedRevision: publication.revision } });
        return { activated: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ("status" in result) return reply.code(result.status!).send({ message: result.message });
      return result;
    });

    routes.delete("/knowledge-library/:id/activation", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const params = noteIdSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректний ідентифікатор." });
      await db.knowledgeActivation.deleteMany({ where: { userId: user.id, publicationId: params.data.id } });
      return { activated: false };
    });

    routes.post("/knowledge-library/matches", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      const access = await accessFor(db, user.id);
      // Expired access must not break matching against the user's own notes.
      if (!access.enabled) return { matches: [], nextCursor: null, access };
      const parsed = matchNotesSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректні дані карти." });
      const records = await db.knowledgeActivation.findMany({ where: { userId: user.id,
        ...(parsed.data.cursor ? { publicationId: { gt: parsed.data.cursor } } : {}), publication: availableTo(user.id) },
        select: { publicationId: true, acceptedRevision: true, publication: { select: publicSelect } },
        orderBy: { publicationId: "asc" }, take: 501 });
      const matches = [];
      let nextCursor: string | null = null;
      for (let index = 0; index < Math.min(records.length, 500); index++) {
        const record = records[index]!;
        const conditions = record.acceptedRevision === record.publication.revision
          ? matchingConditions(record.publication.conditionsJson, parsed.data.chart) : null;
        if (conditions) matches.push({ ...publicationView(record.publication), conditions });
        if (matches.length === 20 || index === 499) {
          nextCursor = index + 1 < records.length ? record.publicationId : null;
          break;
        }
      }
      return { matches, nextCursor, access };
    });
  });
}
