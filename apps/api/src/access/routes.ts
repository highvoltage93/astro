import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { getOptionalAuthUser } from "../auth/service";
import { accessDecision, defaultAccessSettings } from "./policy";

const settingsInput = z.object({ trialEnabled: z.boolean(), trialDays: z.number().int().min(1).max(365), revision: z.number().int().min(0) }).strict();
const grantInput = z.object({ plan: z.enum(["TRIAL", "PRO"]), endsAt: z.string().datetime({ offset: true }), reason: z.string().trim().min(3).max(500) }).strict();
const revokeInput = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export async function registerAccessRoutes(app: FastifyInstance) {
  app.get("/account", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const actor = await getOptionalAuthUser(request);
    if (!actor) return reply.code(401).send({ message: "Увійдіть до акаунта." });
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: {
      id: true, username: true, email: true, role: true, createdAt: true, lastLoginAt: true,
      _count: { select: { birthProfiles: true, savedForecasts: true, consultations: true } }
    } });
    if (!user) return reply.code(401).send({ message: "Сесія завершилась." });
    const grants = await prisma.accessGrant.findMany({ where: { userId: actor.id, revokedAt: null, endsAt: { gt: new Date() } } });
    const settings = await prisma.accessSettings.findUnique({ where: { id: "default" } }) ?? defaultAccessSettings;
    return { user, access: accessDecision(actor.role, grants), trialDays: settings.trialDays, trialEnabled: settings.trialEnabled };
  });

  await app.register(async (admin) => {
    admin.addHook("preHandler", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const actor = await getOptionalAuthUser(request);
      if (!actor) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      if (actor.role !== "ADMIN") return reply.code(403).send({ message: "Доступ лише для адміністратора." });
    });
    admin.get("/settings", async () => prisma.accessSettings.findUnique({ where: { id: "default" } }).then((row) => row ?? defaultAccessSettings));
    admin.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { id: request.params.id }, select: { role: true } });
      if (!user) return reply.code(404).send({ message: "Користувача не знайдено." });
      const now = new Date();
      const [active, history] = await prisma.$transaction([
        prisma.accessGrant.findMany({ where: { userId: request.params.id, revokedAt: null, endsAt: { gt: now } } }),
        prisma.accessGrant.findMany({ where: { userId: request.params.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 })
      ]);
      return { access: accessDecision(user.role, active, now), history };
    });

    // Role recheck and audit belong to the same transaction as every administrative write.
    async function change(request: Parameters<typeof getOptionalAuthUser>[0], reply: import("fastify").FastifyReply,
      action: (tx: Prisma.TransactionClient, actorId: string) => Promise<unknown>) {
      const actor = await getOptionalAuthUser(request);
      if (!actor) return reply.code(401).send({ message: "Сесія завершилась." });
      try {
        return await prisma.$transaction(async (tx) => {
          const current = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true } });
          if (current?.role !== "ADMIN") throw new AccessError(403, "Доступ лише для адміністратора.");
          return action(tx, actor.id);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof AccessError) return reply.code(error.status).send({ message: error.message });
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) return reply.code(409).send({ message: "Дані змінилися. Оновіть і повторіть." });
        throw error;
      }
    }
    admin.put("/settings", async (request, reply) => {
      const parsed = settingsInput.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Trial: від 1 до 365 днів." });
      return change(request, reply, async (tx, actorId) => {
        const before = await tx.accessSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
        if (before.revision !== parsed.data.revision) throw new AccessError(409, "Налаштування змінилися. Оновіть сторінку.");
        const after = await tx.accessSettings.update({ where: { id: "default" }, data: {
          trialEnabled: parsed.data.trialEnabled, trialDays: parsed.data.trialDays, revision: { increment: 1 }
        } });
        await tx.auditEvent.create({ data: { userId: actorId, action: "admin.access.settings", entity: "AccessSettings", entityId: "default", metadata: { before, after } } });
        return after;
      });
    });
    admin.post<{ Params: { id: string } }>("/users/:id/grants", async (request, reply) => {
      const parsed = grantInput.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Оберіть план, дату завершення та причину (3–500 символів)." });
      return change(request, reply, async (tx, actorId) => {
        const now = new Date(), endsAt = new Date(parsed.data.endsAt);
        if (endsAt <= now || endsAt.getTime() > now.getTime() + 3660 * 86400000) throw new AccessError(400, "Оберіть майбутню дату в межах 10 років.");
        if (!await tx.user.findUnique({ where: { id: request.params.id }, select: { id: true } })) throw new AccessError(404, "Користувача не знайдено.");
        const grant = await tx.accessGrant.create({ data: { userId: request.params.id, plan: parsed.data.plan,
          endsAt, startsAt: now, source: "admin", reason: parsed.data.reason } });
        await tx.auditEvent.create({ data: { userId: actorId, action: "admin.access.grant", entity: "User", entityId: request.params.id,
          metadata: { grantId: grant.id, plan: grant.plan, endsAt: endsAt.toISOString(), reason: grant.reason } } });
        return { grant };
      });
    });
    admin.post<{ Params: { id: string; grantId: string } }>("/users/:id/grants/:grantId/revoke", async (request, reply) => {
      const parsed = revokeInput.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Вкажіть причину відкликання (3–500 символів)." });
      return change(request, reply, async (tx, actorId) => {
        const grant = await tx.accessGrant.findFirst({ where: { id: request.params.grantId, userId: request.params.id } });
        if (!grant) throw new AccessError(404, "Запис доступу не знайдено.");
        if (grant.revokedAt) return { revoked: true };
        await tx.accessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
        await tx.auditEvent.create({ data: { userId: actorId, action: "admin.access.revoke", entity: "User", entityId: request.params.id,
          metadata: { grantId: grant.id, reason: parsed.data.reason } } });
        return { revoked: true };
      });
    });
  }, { prefix: "/admin/access" });
}

class AccessError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
