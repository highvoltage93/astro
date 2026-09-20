import type { Consultation, Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConsultationDependencies } from "./routes";
import { consultationDraftSchema } from "./schemas";

export async function saveConsultationRevision(db: Pick<Prisma.TransactionClient, "consultationRevision">, record: Consultation): Promise<void> {
  // Called inside the document transaction; an existing revision is never overwritten.
  await db.consultationRevision.upsert({
    where: { consultationId_revision: { consultationId: record.id, revision: record.revision } },
    update: {}, create: {
      consultationId: record.id, revision: record.revision, title: record.title, status: record.status,
      contentJson: record.contentJson as Prisma.InputJsonValue, privateNotes: record.privateNotes, savedAt: record.updatedAt
    }
  });
}

export async function registerConsultationHistoryRoutes(app: FastifyInstance, { authenticate, database: db }: ConsultationDependencies): Promise<void> {
  app.get("/consultations/:id/history", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(50).default(10) }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректні параметри історії." });
    const current = await db.consultation.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { revision: true } });
    if (!current) return reply.code(404).send({ message: "Консультація недоступна." });
    const { limit, before } = query.data;
    const versions = await db.consultationRevision.findMany({
      where: { consultationId: params.data.id, consultation: { ownerUserId: user.id }, ...(before ? { revision: { lt: before } } : {}) },
      select: { revision: true, title: true, status: true, savedAt: true },
      orderBy: { revision: "desc" }, take: limit + 1
    });
    return { versions: versions.slice(0, limit), nextBefore: versions.length > limit ? versions[limit - 1]?.revision : null, currentRevision: current.revision };
  });

  app.get("/consultations/:id/history/:revision", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = z.object({ id: z.string().uuid(), revision: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректна редакція документа." });
    const version = await db.consultationRevision.findFirst({
      where: { consultationId: parsed.data.id, revision: parsed.data.revision, consultation: { ownerUserId: user.id } },
      select: { revision: true, title: true, status: true, contentJson: true, privateNotes: true, savedAt: true }
    });
    if (!version) return reply.code(404).send({ message: "Версія недоступна." });
    const draft = consultationDraftSchema.safeParse({ title: version.title, status: version.status, content: version.contentJson, privateNotes: version.privateNotes });
    if (!draft.success) return reply.code(422).send({ message: "Формат цієї версії поки не підтримується." });
    return { version: { revision: version.revision, savedAt: version.savedAt, ...draft.data } };
  });
}
