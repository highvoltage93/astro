import { defaultCalculationRules, type RulershipModel } from "@astroprocessor/astrology-core";
import { Prisma, type CalculationProfile } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { saveCalculationProfileSchema, updateCalculationProfileSchema } from "./schemas";

const pointOrbs = {
  sun: 8, moon: 8, mercury: 6, venus: 6, mars: 6, jupiter: 6, saturn: 6,
  uranus: 5, neptune: 5, pluto: 5, "north-node": 3, "south-node": 3, chiron: 3, lilith: 3, asc: 5, mc: 5
};
const builtins = ([
  ["astroprocessor", "Astroprocessor: поточні правила"],
  ["traditional", "Традиційні управителі"],
  ["modern", "Сучасні управителі"]
] as Array<[RulershipModel, string]>).map(([model, name]) => ({
  id: `builtin:${model}:1`, name, revision: 1, schemaVersion: 1, builtIn: true,
  config: {
    calculationRules: defaultCalculationRules(model), houseSystem: "koch", zodiac: "tropical", pointOrbs,
    visiblePointKeys: Object.fromEntries([...Object.keys(pointOrbs), "desc", "ic"].map((key) => [key, true]))
  }
}));

const view = (record: CalculationProfile) => ({
  id: record.id, name: record.name, revision: record.revision, schemaVersion: record.schemaVersion,
  config: record.configJson, builtIn: false, createdAt: record.createdAt, updatedAt: record.updatedAt
});
const idSchema = z.object({ id: z.string().min(1).max(120) });
const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export type CalculationProfileDependencies = {
  authenticate: (request: FastifyRequest) => Promise<{ id: string } | null>;
  database: Pick<typeof prisma, "calculationProfile" | "user" | "$transaction">;
};

export const registerCalculationProfileRoutes = async (
  app: FastifyInstance,
  { authenticate, database: db }: CalculationProfileDependencies = { authenticate: getOptionalAuthUser, database: prisma }
): Promise<void> => {
  app.get("/calculation-profiles", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const records = await db.calculationProfile.findMany({ where: { ownerUserId: user.id }, orderBy: { updatedAt: "desc" } });
    const account = await db.user.findUnique({ where: { id: user.id }, select: { defaultCalculationProfileId: true } });
    return { profiles: [...builtins, ...records.map(view)], defaultProfileId: account?.defaultCalculationProfileId ?? null };
  });

  app.post("/calculation-profiles", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = saveCalculationProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Перевір назву й налаштування профілю.", issues: parsed.error.flatten() });
    const record = await db.calculationProfile.create({
      data: { ownerUserId: user.id, name: parsed.data.name, configJson: toJson(parsed.data.config) }
    });
    return reply.code(201).send({ profile: view(record) });
  });

  app.put("/calculation-profiles/:id", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const params = idSchema.safeParse(request.params);
    const parsed = updateCalculationProfileSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ message: "Некоректний профіль розрахунку." });
    try {
      const record = await db.calculationProfile.update({
        where: { id: params.data.id, ownerUserId: user.id, revision: parsed.data.revision },
        data: { name: parsed.data.name, configJson: toJson(parsed.data.config), revision: { increment: 1 } }
      });
      return { profile: view(record) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return reply.code(409).send({ message: "Профіль змінено або він недоступний. Онови список перед збереженням." });
      }
      throw error;
    }
  });

  app.put("/calculation-profiles/default", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const parsed = z.object({ id: z.string().min(1).max(120).nullable() }).strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Некоректний профіль." });
    const id = parsed.data.id;
    try {
      const updated = await db.$transaction(async (tx) => {
        if (id && !await tx.calculationProfile.findFirst({ where: { id, ownerUserId: user.id }, select: { id: true } })) return false;
        await tx.user.update({ where: { id: user.id }, data: { defaultCalculationProfileId: id } });
        return true;
      });
      if (!updated) return reply.code(404).send({ message: "Профіль не знайдено." });
      return { defaultProfileId: id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return reply.code(404).send({ message: "Профіль уже видалено. Онови список." });
      }
      throw error;
    }
  });

  app.delete("/calculation-profiles/:id", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ message: "Потрібно увійти в обліковий запис." });
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: "Некоректний профіль." });
    const result = await db.calculationProfile.deleteMany({ where: { id: params.data.id, ownerUserId: user.id } });
    if (!result.count) return reply.code(404).send({ message: "Профіль не знайдено." });
    return { deletedProfileId: params.data.id };
  });
};
