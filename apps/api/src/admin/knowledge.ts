import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { noteIdSchema } from "../knowledge-notes/schemas";

const querySchema = z.object({
  query: z.string().trim().max(160).default(""),
  authorId: z.string().cuid().optional(),
  status: z.enum(["all", "private", "published", "archived"]).default("all"),
  cursor: z.string().uuid().optional()
}).strict();
const summarySelect = {
  id: true, title: true, tags: true, revision: true, archived: true, createdAt: true, updatedAt: true,
  owner: { select: { id: true, username: true } }, publication: { select: { published: true } }
} satisfies Prisma.KnowledgeNoteSelect;

export async function registerAdminKnowledgeRoutes(app: FastifyInstance, deps: {
  authenticate: (request: FastifyRequest) => Promise<{ id: string; role: string } | null>;
  database: Pick<typeof prisma, "knowledgeNote" | "auditEvent">;
} = { authenticate: getOptionalAuthUser, database: prisma }) {
  await app.register(async (routes) => {
    routes.addHook("preHandler", async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      const actor = await deps.authenticate(request);
      if (!actor) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      if (actor.role !== "ADMIN") return reply.code(403).send({ message: "Доступ лише для адміністратора." });
    });
    routes.get("/", async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректні фільтри." });
      const { query, authorId, status, cursor } = parsed.data;
      const where: Prisma.KnowledgeNoteWhereInput = {
        ...(authorId ? { ownerUserId: authorId } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(status === "archived" ? { archived: true } : {}),
        ...(status === "published" ? { archived: false, publication: { is: { published: true } } } : {}),
        AND: [
          ...(status === "private" ? [{ OR: [{ publication: { is: null } }, { publication: { is: { published: false } } }] }] : []),
          ...(query ? [{ OR: [{ title: { contains: query, mode: "insensitive" as const } },
            { owner: { username: { contains: query.replace(/^@/, ""), mode: "insensitive" as const } } }, { tags: { has: query } }] }] : [])
        ]
      };
      const notes = await deps.database.knowledgeNote.findMany({ where, select: summarySelect, orderBy: { id: "asc" }, take: 26 });
      return { notes: notes.slice(0, 25), nextCursor: notes.length > 25 ? notes[24]!.id : null };
    });
    routes.get("/:id", async (request, reply) => {
      const params = noteIdSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ message: "Некоректний ідентифікатор." });
      const actor = await deps.authenticate(request);
      if (!actor || actor.role !== "ADMIN") return reply.code(403).send({ message: "Доступ лише для адміністратора." });
      const note = await deps.database.knowledgeNote.findUnique({ where: { id: params.data.id }, select: {
        ...summarySelect, body: true, conditionsJson: true, sourceLabel: true,
        publication: { select: { published: true, title: true, body: true, tags: true, conditionsJson: true, revision: true, updatedAt: true } }
      } });
      if (!note) return reply.code(404).send({ message: "Спостереження не знайдено." });
      await deps.database.auditEvent.create({ data: {
        userId: actor.id, action: "admin.knowledge.read", entity: "KnowledgeNote", entityId: note.id
      } });
      return { note };
    });
  }, { prefix: "/admin/knowledge-notes" });
}
