import { Prisma, type Consultation } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { createConsultationSchema, listConsultationsSchema, updateConsultationSchema } from "./schemas";
import { clientDocument } from "./client-document";
import { registerConsultationHistoryRoutes, saveConsultationRevision } from "./history";

export type ConsultationDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  database: Pick<typeof prisma, "consultation" | "birthProfile" | "consultationRevision" | "$transaction">;
};
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const idSchema = z.object({ id: z.string().uuid() });
const summary = {
  id: true, title: true, status: true, revision: true, sourceProfileId: true,
  sourceCalculationId: true, createdAt: true, updatedAt: true
} as const;
const view = (record: Consultation) => ({
  id: record.id, title: record.title, status: record.status, revision: record.revision,
  sourceProfileId: record.sourceProfileId, sourceCalculationId: record.sourceCalculationId,
  source: record.sourceSnapshotJson, content: record.contentJson, privateNotes: record.privateNotes,
  createdAt: record.createdAt, updatedAt: record.updatedAt
});

export async function registerConsultationRoutes(app: FastifyInstance, {
  authenticate, database: db
}: ConsultationDependencies = { authenticate: getOptionalAuthUser, database: prisma }): Promise<void> {
  await registerConsultationHistoryRoutes(app, { authenticate, database: db });
  app.get("/consultations", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = listConsultationsSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректні параметри списку." });
    const { sourceProfileId, cursor, limit } = parsed.data;
    const anchor = cursor ? await db.consultation.findFirst({ where: { id: cursor, ownerUserId: user.id }, select: { createdAt: true, id: true } }) : null;
    if (cursor && !anchor) return reply.code(400).send({ message: "Онови список консультацій." });
    const records = await db.consultation.findMany({
      where: { ownerUserId: user.id, ...(sourceProfileId ? { sourceProfileId } : {}),
        ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) },
      select: summary, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1
    });
    return { consultations: records.slice(0, limit), nextCursor: records.length > limit ? records[limit - 1]?.id : null };
  });

  app.get("/consultations/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний документ." });
    const record = await db.consultation.findFirst({ where: { id: parsed.data.id, ownerUserId: user.id } });
    if (!record) return reply.code(404).send({ message: "Консультація недоступна." });
    return { consultation: view(record) };
  });

  app.get("/consultations/:id/client-document", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = idSchema.safeParse(request.params);
    const query = z.object({ revision: z.coerce.number().int().positive().optional() }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректна редакція документа." });
    const record = await db.consultation.findFirst({
      where: { id: params.data.id, ownerUserId: user.id },
      select: { id: true, title: true, status: true, revision: true, updatedAt: true, contentJson: true, sourceSnapshotJson: true }
    });
    if (!record) return reply.code(404).send({ message: "Консультація недоступна." });
    if (query.data.revision !== undefined && query.data.revision !== record.revision) {
      return reply.code(409).send({ message: "Документ уже має іншу редакцію. Відкрий актуальну версію перед друком." });
    }
    try { return { document: clientDocument(record) }; }
    catch (error) {
      if (error instanceof z.ZodError) return reply.code(422).send({ message: "Цей формат документа поки не підтримується для друку." });
      throw error;
    }
  });

  app.post("/consultations", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = createConsultationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевір назву та розмір документа." });
    const { id, sourceProfileId, content, ...fields } = parsed.data;
    // The client-generated ID makes a lost creation response safe to retry.
    const existing = await db.consultation.findUnique({ where: { id } });
    if (existing) {
      if (existing.ownerUserId !== user.id || existing.sourceProfileId !== sourceProfileId) return reply.code(409).send({ message: "Ідентифікатор уже використано." });
      return { consultation: view(existing) };
    }
    const profile = await db.birthProfile.findFirst({
      where: { id: sourceProfileId, ownerUserId: user.id },
      include: { calculations: { where: { chartType: "NATAL" }, orderBy: { calculatedAt: "desc" }, take: 1 } }
    });
    const calculation = profile?.calculations[0];
    if (!profile || !calculation) return reply.code(404).send({ message: "Спершу збережи власну натальну карту." });
    const record = await db.$transaction(async (tx) => {
      const created = await tx.consultation.upsert({
        where: { id }, update: {}, create: {
          id, ownerUserId: user.id, sourceProfileId, sourceCalculationId: calculation.id, ...fields,
          contentJson: json(content), sourceSnapshotJson: json({
            displayName: profile.displayName, birthplaceName: profile.birthplaceName,
            birthDate: profile.birthDate.toISOString().slice(0, 10), birthTime: profile.birthTime,
            birthTimeKnown: profile.birthTimeKnown, timezone: profile.timezone,
            calculatedAt: calculation.calculatedAt, chart: calculation.resultJson
          })
        }
      });
      if (created.ownerUserId === user.id && created.sourceProfileId === sourceProfileId) await saveConsultationRevision(tx, created);
      return created;
    });
    if (record.ownerUserId !== user.id || record.sourceProfileId !== sourceProfileId) return reply.code(409).send({ message: "Ідентифікатор уже використано." });
    return reply.code(201).send({ consultation: view(record) });
  });

  app.put("/consultations/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = idSchema.safeParse(request.params);
    const parsed = updateConsultationSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: "Перевір назву та розмір документа." });
    const { revision, mutationId, content, ...fields } = parsed.data;
    try {
      const record = await db.$transaction(async (tx) => {
        const previous = await tx.consultation.findFirst({ where: { id: params.data.id, ownerUserId: user.id } });
        const updated = await tx.consultation.update({
          where: { id: params.data.id, ownerUserId: user.id, revision },
          data: { ...fields, contentJson: json(content), lastMutationId: mutationId, revision: { increment: 1 } }
        });
        // The conditional update locks this revision before either snapshot is committed.
        if (previous) await saveConsultationRevision(tx, previous);
        await saveConsultationRevision(tx, updated);
        return updated;
      });
      return { consultation: view(record) };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2025") throw error;
      const current = await db.consultation.findFirst({ where: { id: params.data.id, ownerUserId: user.id } });
      if (!current) return reply.code(404).send({ message: "Консультація недоступна." });
      if (current.lastMutationId === mutationId) return { consultation: view(current) };
      return reply.code(409).send({ message: "Документ змінено в іншій вкладці. Твій текст залишився у чернетці." });
    }
  });
}
