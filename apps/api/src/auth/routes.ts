import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client";
import { createAuthToken, getOptionalAuthUser, hashPassword, verifyPassword } from "./service";

const authSchema = z.object({
  email: z.string(),
  username: z.string(),
  password: z.string()
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  locale: true,
  role: true
} satisfies Prisma.UserSelect;

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/auth/register", async (request, reply) => {
    const parsed = authSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_REGISTER_INPUT",
        issues: parsed.error.flatten()
      });
    }

    try {
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email,
          username: parsed.data.username,
          passwordHash: hashPassword(parsed.data.password)
        },
        select: authUserSelect
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

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_LOGIN_INPUT",
        issues: parsed.error.flatten()
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        username: parsed.data.username
      },
      select: {
        ...authUserSelect,
        passwordHash: true
      }
    });

    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password"
      });
    }

    const { passwordHash: _passwordHash, ...authUser } = user;

    return {
      user: authUser,
      token: createAuthToken(authUser)
    };
  });

  app.get("/auth/me", async (request, reply) => {
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
