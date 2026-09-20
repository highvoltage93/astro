import { Prisma, type ConsultationTemplate } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { createTemplateSchema, listTemplatesSchema, templateIdSchema, updateTemplateSchema } from "./schemas";

export type TemplateDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  database: Pick<typeof prisma, "consultationTemplate">;
};
const summary = { id: true, title: true, category: true, revision: true, createdAt: true, updatedAt: true } as const;
const view = (record: ConsultationTemplate) => ({ id: record.id, title: record.title, category: record.category,
  body: record.bodyJson, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt });
const json = (body: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;

export async function registerConsultationTemplateRoutes(app: FastifyInstance, {
  authenticate, database: db
}: TemplateDependencies = { authenticate: getOptionalAuthUser, database: prisma }): Promise<void> {
  app.get("/consultation-templates", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = listTemplatesSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректні параметри пошуку." });
    const { query, category, cursor, limit } = parsed.data;
    const anchor = cursor ? await db.consultationTemplate.findFirst({ where: { id: cursor, ownerUserId: user.id }, select: { createdAt: true, id: true } }) : null;
    if (cursor && !anchor) return reply.code(400).send({ message: "Онови список шаблонів." });
    const records = await db.consultationTemplate.findMany({
      where: { ownerUserId: user.id, ...(category ? { category } : {}),
        ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
        ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) },
      select: summary, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1
    });
    return { templates: records.slice(0, limit), nextCursor: records.length > limit ? records[limit - 1]?.id : null };
  });

  app.get("/consultation-templates/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = templateIdSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний шаблон." });
    const record = await db.consultationTemplate.findFirst({ where: { id: parsed.data.id, ownerUserId: user.id } });
    if (!record) return reply.code(404).send({ message: "Шаблон недоступний." });
    return { template: view(record) };
  });

  app.post("/consultation-templates", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const parsed = createTemplateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевір назву, категорію та розмір шаблону." });
    const { id, draft: { title, category, body } } = parsed.data;
    const record = await db.consultationTemplate.upsert({ where: { id }, update: {},
      create: { id, ownerUserId: user.id, title, category, bodyJson: json(body) } });
    if (record.ownerUserId !== user.id) return reply.code(409).send({ message: "Ідентифікатор уже використано." });
    return reply.code(201).send({ template: view(record) });
  });

  app.put("/consultation-templates/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = templateIdSchema.safeParse(request.params);
    const parsed = updateTemplateSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: "Перевір назву, категорію та розмір шаблону." });
    const { revision, mutationId, draft: { title, category, body } } = parsed.data;
    try {
      const record = await db.consultationTemplate.update({
        where: { id: params.data.id, ownerUserId: user.id, revision },
        data: { title, category, bodyJson: json(body), revision: { increment: 1 }, lastMutationId: mutationId }
      });
      return { template: view(record) };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2025") throw error;
      const current = await db.consultationTemplate.findFirst({ where: { id: params.data.id, ownerUserId: user.id } });
      if (!current) return reply.code(404).send({ message: "Шаблон недоступний." });
      if (current.lastMutationId === mutationId) return { template: view(current) };
      return reply.code(409).send({ message: "Шаблон змінено в іншій вкладці. Збережи свій текст як новий шаблон або відкрий актуальну версію." });
    }
  });

  app.delete("/consultation-templates/:id", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійди в обліковий запис." });
    const params = templateIdSchema.safeParse(request.params);
    const query = z.object({ revision: z.coerce.number().int().positive() }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Некоректна редакція шаблону." });
    const result = await db.consultationTemplate.deleteMany({ where: { id: params.data.id, ownerUserId: user.id, revision: query.data.revision } });
    if (!result.count) {
      const current = await db.consultationTemplate.findFirst({ where: { id: params.data.id, ownerUserId: user.id }, select: { id: true } });
      if (current) return reply.code(409).send({ message: "Шаблон змінено. Відкрий актуальну версію перед видаленням." });
    }
    return { deletedTemplateId: params.data.id };
  });
}
