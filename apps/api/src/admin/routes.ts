import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { registerAdminFeedbackRoutes } from "../feedback/routes";

const select = {
  id: true, username: true, email: true, role: true, createdAt: true, updatedAt: true,
  lastLoginAt: true, lastActiveAt: true,
  _count: { select: { birthProfiles: true, savedForecasts: true, consultations: true } }
} satisfies Prisma.UserSelect;

const querySchema = z.object({
  search: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1)
});
const updateSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email().max(160),
  role: z.enum(["USER", "CONSULTANT", "ADMIN"]),
  updatedAt: z.string().datetime()
}).strict();

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (admin) => {
    admin.addHook("preHandler", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const actor = await getOptionalAuthUser(request);
      if (!actor) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      if (actor.role !== "ADMIN") return reply.code(403).send({ message: "Доступ лише для адміністратора." });
    });

    await registerAdminFeedbackRoutes(admin);

    admin.get("/users", async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректні параметри пошуку." });
      const { search, page } = parsed.data;
      const where: Prisma.UserWhereInput = search ? { OR: [
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ] } : {};
      const [total, users] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, select, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 25, take: 25 })
      ]);
      return { users, total, page, pageSize: 25 };
    });

    admin.patch<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Перевірте email, username (3–50 символів) та роль." });
      const actor = await getOptionalAuthUser(request);
      if (!actor) return reply.code(401).send({ message: "Сесія завершилась." });
      const { updatedAt, ...data } = parsed.data;
      try {
        const result = await prisma.$transaction(async (tx): Promise<
          { status: number; message: string } | { user: Prisma.UserGetPayload<{ select: typeof select }> }
        > => {
          // Read roles inside the serializable transaction, never trust the JWT's role.
          const currentActor = await tx.user.findUnique({ where: { id: actor.id } });
          if (currentActor?.role !== "ADMIN") return { status: 403, message: "Доступ лише для адміністратора." } as const;
          const target = await tx.user.findUnique({ where: { id: request.params.id } });
          if (!target) return { status: 404, message: "Користувача не знайдено." } as const;
          if (target.updatedAt.toISOString() !== updatedAt) return { status: 409, message: "Дані вже змінилися. Оновіть список і відкрийте користувача знову." } as const;
          if (target.role === "ADMIN" && data.role !== "ADMIN") {
            if (target.id === actor.id) return { status: 400, message: "Не можна зняти власні права адміністратора." } as const;
            if (await tx.user.count({ where: { role: "ADMIN" } }) <= 1) return { status: 400, message: "Потрібно залишити хоча б одного адміністратора." } as const;
          }
          const user = await tx.user.update({ where: { id: target.id }, data, select });
          await tx.auditEvent.create({ data: {
            userId: actor.id, action: "admin.user.update", entity: "User", entityId: target.id,
            metadata: { before: { username: target.username, email: target.email, role: target.role }, after: data }
          } });
          return { user };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        if ("status" in result) return reply.code(result.status).send({ message: result.message });
        return result;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") return reply.code(409).send({ message: "Цей email або username вже використовується." });
          if (error.code === "P2034") return reply.code(409).send({ message: "Одночасна зміна даних. Оновіть список і повторіть." });
        }
        throw error;
      }
    });

    admin.get("/audit", async () => ({ events: await prisma.auditEvent.findMany({
      where: { action: { startsWith: "admin." } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
      select: { id: true, action: true, entityId: true, createdAt: true, metadata: true,
        user: { select: { username: true } } }
    }) }));
  }, { prefix: "/admin" });
}
