import type { FastifyInstance } from "fastify";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { feedbackInput, feedbackQuery, feedbackUpdate } from "./schema";

export async function registerFeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post("/feedback", { bodyLimit: 32768 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const user = await getOptionalAuthUser(request);
    if (!user) return reply.code(401).send({ message: "Увійдіть, щоб надіслати звернення." });
    const parsed = feedbackInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Тема: 3–160 символів, опис: 10–5000 символів. Перевірте заповнені поля." });
    const data = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      // Serialize submissions per account, including across multiple API replicas.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;
      const existing = await tx.feedbackReport.findUnique({ where: { userId_requestId: { userId: user.id, requestId: data.requestId } } });
      if (existing) {
        if (existing.title !== data.title || existing.description !== data.description || existing.pagePath !== data.pagePath) {
          return { status: 409, message: "Цей запит уже використано для іншого звернення." };
        }
        return { status: 200, id: existing.id };
      }
      const author = await tx.user.findUnique({ where: { id: user.id }, select: { username: true, email: true } });
      if (!author) return { status: 401, message: "Акаунт не знайдено." };
      const count = await tx.feedbackReport.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
      if (count >= 5) return { status: 429, message: "Не більше 5 звернень за 10 хвилин. Спробуйте пізніше." };
      const report = await tx.feedbackReport.create({ data: {
        ...data, userId: user.id, authorUsername: author.username, authorEmail: author.email
      }, select: { id: true } });
      return { status: 201, id: report.id };
    });
    if (result.status === 429) reply.header("Retry-After", "600");
    return reply.code(result.status).send(result.id ? { id: result.id } : { message: result.message });
  });
}

// Register only inside the existing ADMIN-protected Fastify scope.
export async function registerAdminFeedbackRoutes(admin: FastifyInstance): Promise<void> {
  admin.get("/feedback", async (request, reply) => {
    const parsed = feedbackQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний фільтр." });
    const { page, status } = parsed.data;
    const where = status ? { status } : {};
    const [total, reports] = await prisma.$transaction([
      prisma.feedbackReport.count({ where }),
      prisma.feedbackReport.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25,
        include: { user: { select: { username: true, email: true } } } })
    ]);
    return { reports, total, page, pageSize: 25 };
  });

  admin.patch<{ Params: { id: string } }>("/feedback/:id", async (request, reply) => {
    const actor = await getOptionalAuthUser(request);
    if (actor?.role !== "ADMIN") return reply.code(403).send({ message: "Доступ лише для адміністратора." });
    const parsed = feedbackUpdate.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний статус звернення." });
    const { status, updatedAt } = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.feedbackReport.findUnique({ where: { id: request.params.id } });
      if (!current) return { status: 404, message: "Звернення не знайдено." };
      const changed = await tx.feedbackReport.updateMany({
        where: { id: current.id, updatedAt: new Date(updatedAt) }, data: { status }
      });
      if (!changed.count) return { status: 409, message: "Звернення вже змінилось. Оновіть список." };
      await tx.auditEvent.create({ data: { userId: actor.id, action: "admin.feedback.status", entity: "FeedbackReport", entityId: current.id,
        metadata: { before: current.status, after: status } } });
      return { status: 200, message: "Статус збережено." };
    });
    return reply.code(result.status).send({ message: result.message });
  });
}
