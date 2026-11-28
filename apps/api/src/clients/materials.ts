import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { getOptionalAuthUser } from "../auth/service";
import { clientQuery } from "./schema";

export const materialKind = z.enum(["chart", "forecast", "consultation"]);
const querySchema = clientQuery.extend({ kind: materialKind, linked: z.enum(["true", "false"]).default("true") });
const paramsSchema = z.object({ id: z.string().min(1), kind: materialKind, materialId: z.string().min(1).max(160) });

// Registered inside the admin-only clients pilot scope.
export async function registerClientMaterialRoutes(app: FastifyInstance, deps = { database: prisma, authenticate: getOptionalAuthUser }) {
  app.get<{ Params: { id: string } }>("/:id/materials", async (request, reply) => {
    const user = await deps.authenticate(request);
    if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний пошук матеріалів." });
    const clientId = request.params.id;
    if (!await deps.database.client.findFirst({ where: { id: clientId, ownerUserId: user.id } })) return reply.code(404).send({ message: "Клієнта не знайдено." });
    const { kind, search, linked, page } = parsed.data;
    const common = { ownerUserId: user.id, clientLinks: linked === "true" ? { some: { clientId } } : { none: { clientId } } };
    const paging = { take: 26, skip: (page - 1) * 25, orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }] };
    let items: { id: string; title: string; createdAt: Date }[];
    if (kind === "chart") {
      const rows = await deps.database.birthProfile.findMany({ where: { ...common, displayName: { contains: search, mode: "insensitive" } }, ...paging,
        select: { id: true, displayName: true, createdAt: true } });
      items = rows.map(({ displayName, ...row }) => ({ ...row, title: displayName }));
    } else if (kind === "forecast") {
      items = await deps.database.savedForecast.findMany({ where: { ...common, title: { contains: search, mode: "insensitive" } }, ...paging, select: { id: true, title: true, createdAt: true } });
    } else {
      items = await deps.database.consultation.findMany({ where: { ...common, title: { contains: search, mode: "insensitive" } }, ...paging, select: { id: true, title: true, createdAt: true } });
    }
    return { items: items.slice(0, 25), hasMore: items.length > 25 };
  });
  for (const method of ["PUT", "DELETE"] as const) {
    app.route({ method, url: "/:id/materials/:kind/:materialId", handler: async (request, reply) => {
      const user = await deps.authenticate(request);
      if (!user || user.role !== "ADMIN") return reply.code(403).send({ message: "Доступ заборонено." });
      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ message: "Некоректний матеріал." });
      const { id: clientId, kind, materialId } = parsed.data;
      try {
        const found = await deps.database.$transaction(async (tx) => {
          if (!await tx.client.findFirst({ where: { id: clientId, ownerUserId: user.id } })) return false;
          const where = { id: materialId, ownerUserId: user.id };
          const material = kind === "chart" ? await tx.birthProfile.findFirst({ where, select: { id: true } })
            : kind === "forecast" ? await tx.savedForecast.findFirst({ where, select: { id: true } })
            : await tx.consultation.findFirst({ where, select: { id: true } });
          if (!material) return false;
          const target = kind === "chart" ? { birthProfileId: materialId } : kind === "forecast" ? { forecastId: materialId } : { consultationId: materialId };
          if (method === "DELETE") await tx.clientMaterial.deleteMany({ where: { clientId, ...target } });
          else await tx.clientMaterial.createMany({ data: [{ clientId, ...target }], skipDuplicates: true });
          return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        if (!found) return reply.code(404).send({ message: "Клієнт або матеріал недоступний." });
        return { saved: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2003"].includes(error.code)) return reply.code(409).send({ message: "Матеріали змінилися. Оновіть список і повторіть." });
        throw error;
      }
    } });
  }
}
