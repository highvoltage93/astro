import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { recordUserActivity } from "./activity";
import { registrationPasswordError } from "./password-policy";
import { createAuthToken, getOptionalAuthUser, hashPassword, verifyPassword } from "./service";
import { consumeAuthLimit, enforceAuthLimit, type ConsumeLimit } from "./rate-limit";
import { defaultAccessSettings, trialEnd } from "../access/policy";

const dummyPasswordHash = hashPassword("not-a-user-password");

const authSchema = z.object({
  email: z.string().trim().email().max(160),
  username: z.string().trim().min(3).max(50),
  password: z.string().superRefine((password, ctx) => {
    const message = registrationPasswordError(password);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  })
});

const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(4).max(128)
});

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  locale: true,
  role: true
} satisfies Prisma.UserSelect;

export const registerAuthRoutes = async (app: FastifyInstance, deps: {
  database: Pick<typeof prisma, "user" | "$transaction">; consume: ConsumeLimit; recordLogin?: typeof recordUserActivity;
} = { database: prisma, consume: consumeAuthLimit }): Promise<void> => {
  app.post("/auth/register", { bodyLimit: 4096, preHandler: async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    await enforceAuthLimit(request, reply, "register-ip", request.ip, 5, 3600, deps.consume);
  } }, async (request, reply) => {
    const parsed = authSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_REGISTER_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      const user = await deps.database.$transaction(async (tx) => {
        const settings = await tx.accessSettings.findUnique({ where: { id: "default" } }) ?? defaultAccessSettings;
        const now = new Date();
        return tx.user.create({
          data: {
            email: parsed.data.email,
            username: parsed.data.username,
            passwordHash: hashPassword(parsed.data.password),
            lastLoginAt: now,
            lastActiveAt: now,
            ...(settings.trialEnabled ? { accessGrants: { create: { plan: "TRIAL", source: "registration",
              reason: "Пробний період при реєстрації", startsAt: now, endsAt: trialEnd(now, settings.trialDays) } } } : {})
          },
          select: authUserSelect
        });
      });

      return reply.code(201).send({
        user,
        token: createAuthToken(user)
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.code(409).send({
          code: "USER_ALREADY_EXISTS",
          message: "User with this email or username already exists"
        });
      }

      throw error;
    }
  });

  app.post("/auth/login", { bodyLimit: 4096, preHandler: async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    await enforceAuthLimit(request, reply, "login-ip", request.ip, 30, 900, deps.consume);
  } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_LOGIN_INPUT",
        issues: parsed.error.flatten()
      });
    }

    if (!await enforceAuthLimit(request, reply, "login-username", parsed.data.username, 10, 900, deps.consume)) return;

    const user = await deps.database.user.findUnique({
      where: {
        username: parsed.data.username
      },
      select: {
        ...authUserSelect,
        authVersion: true,
        passwordHash: true
      }
    });

    const validPassword = verifyPassword(parsed.data.password, user?.passwordHash ?? dummyPasswordHash);
    if (!user || !validPassword) {
      return reply.code(401).send({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password"
      });
    }

    const { passwordHash: _passwordHash, authVersion, ...authUser } = user;

    try {
      await (deps.recordLogin ?? recordUserActivity)(user.id, true);
    } catch {
      request.log.warn("Unable to record successful login time");
    }

    return {
      user: authUser,
      token: createAuthToken(authUser, authVersion)
    };
  });

  app.get("/auth/me", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const user = await getOptionalAuthUser(request);

    if (!user) {
      return reply.code(401).send({
        code: "UNAUTHENTICATED",
        message: "Missing or invalid auth token"
      });
    }

    return {
      user
    };
  });
};
