import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { clientInput, clientQuery, clientUpdate } from "./schema";
import { registerClientMaterialRoutes } from "./materials";
import { registerClientEventRoutes } from "./events";

export async function registerClientRoutes(app: FastifyInstance, deps = { database: prisma, authenticate: getOptionalAuthUser }) {
  await app.register(async (clients) => {
    clients.addHook("preHandler", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const user = await deps.authenticate(request);
      if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
      if (user.role !== "ADMIN") return reply.code(403).send({ message: "Клієнти поки доступні лише адміністраторам." });
      if (process.env.CLIENTS_PILOT_ENABLED === "false") return reply.code(503).send({ message: "Розділ клієнтів тимчасово вимкнено." });
    });
    await registerClientMaterialRoutes(clients, deps);
    await registerClientEventRoutes(clients, deps);
    clients.get("/", async (request, reply) => {
      const user = await deps.authenticate(request);
      if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
      const query = clientQuery.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ message: "Некоректні параметри пошуку." });
      const { search, page } = query.data;
      const where: Prisma.ClientWhereInput = { ownerUserId: user.id, ...(search ? { OR: [
        { name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } }, { tags: { has: search } }
      ] } : {}) };
      const [total, items] = await deps.database.$transaction([
        deps.database.client.count({ where }),
        deps.database.client.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25,
          select: { id: true, name: true, email: true, phone: true, tags: true, updatedAt: true } })
      ]);
      return { items, total, page };
    });
    clients.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
      const user = await deps.authenticate(request);
      if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
      const client = await deps.database.client.findFirst({ where: { id: request.params.id, ownerUserId: user.id } });
      if (!client) return reply.code(404).send({ message: "Клієнта не знайдено." });
      return { client };
    });
    clients.post("/", { bodyLimit: 131072 }, async (request, reply) => {
      const user = await deps.authenticate(request);
      if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
      const parsed = clientInput.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Перевірте ім’я, email та теги (до 20 тегів по 40 символів)." });
      const client = await deps.database.client.create({ data: { ...parsed.data, ownerUserId: user.id } });
      return reply.code(201).send({ client });
    });
    clients.put<{ Params: { id: string } }>("/:id", { bodyLimit: 131072 }, async (request, reply) => {
      const user = await deps.authenticate(request);
      if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
      const parsed = clientUpdate.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Перевірте заповнені поля." });
      const { revision, ...data } = parsed.data;
      const updated = await deps.database.client.updateMany({ where: { id: request.params.id, ownerUserId: user.id, revision },
        data: { ...data, revision: { increment: 1 } } });
      if (!updated.count) return reply.code(409).send({ message: "Картка змінилася або недоступна. Оновіть її перед збереженням." });
      return { saved: true };
    });
  }, { prefix: "/clients" });
}
