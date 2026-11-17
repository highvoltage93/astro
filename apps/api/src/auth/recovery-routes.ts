import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { mailConfig } from "../mail/config";
import { registrationPasswordError } from "./password-policy";
import { completePasswordReset } from "./password-reset";
import { consumeAuthLimit, enforceAuthLimit, type ConsumeLimit } from "./rate-limit";

const requestSchema = z.object({ email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()) }).strict();
const resetSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().max(128).superRefine((value, ctx) => {
  const error = registrationPasswordError(value);
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
}) }).strict();
const genericMessage = "Якщо акаунт із такою адресою існує, ви отримаєте лист із посиланням для відновлення пароля.";

export async function registerRecoveryRoutes(app: FastifyInstance, deps = {
  enabled: mailConfig.enabled,
  consume: consumeAuthLimit as ConsumeLimit,
  enqueue: async (email: string) => { await prisma.authMailJob.create({ data: { email } }); },
  complete: completePasswordReset as (token: string, password: string) => Promise<boolean>
}) {
  await app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "no-store"); });
    routes.get("/auth/password-reset/config", async () => ({ enabled: deps.enabled }));
    routes.post("/auth/forgot-password", { bodyLimit: 4096, preHandler: async (request, reply) => {
      await enforceAuthLimit(request, reply, "forgot-ip", request.ip, 10, 3600, deps.consume);
    } }, async (request, reply) => {
      if (!deps.enabled) return reply.code(503).send({ message: "Відновлення через email ще не підключене. Зверніться до адміністратора." });
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Введіть коректну email-адресу." });
      try {
        const limit = await deps.consume("forgot-email", parsed.data.email, 3, 3600);
        // Queue all addresses: SMTP and account lookup must not reveal account existence via latency.
        if (limit.allowed) await deps.enqueue(parsed.data.email);
        return reply.code(202).send({ message: genericMessage });
      } catch {
        request.log.warn("Password recovery queue unavailable");
        return reply.code(503).send({ message: "Не вдалося прийняти запит. Спробуйте пізніше." });
      }
    });
    routes.post("/auth/reset-password", { bodyLimit: 4096, preHandler: async (request, reply) => {
      await enforceAuthLimit(request, reply, "reset-ip", request.ip, 10, 900, deps.consume);
    } }, async (request, reply) => {
      if (!deps.enabled) return reply.code(503).send({ message: "Відновлення пароля тимчасово недоступне." });
      const parsed = resetSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues.find((issue) => issue.path[0] === "password")?.message ?? "Посилання недійсне. Запитайте новий лист." });
      try {
        if (!await deps.complete(parsed.data.token, parsed.data.password)) return reply.code(400).send({ code: "RESET_LINK_INVALID", message: "Посилання використане або втратило чинність. Запитайте новий лист." });
        return { message: "Пароль змінено. Увійдіть з новим паролем." };
      } catch {
        request.log.warn("Password recovery unavailable");
        return reply.code(503).send({ message: "Не вдалося змінити пароль. Спробуйте пізніше." });
      }
    });
  });
}
