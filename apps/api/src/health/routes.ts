import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma/client";

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/health", async () => ({
    status: "ok",
    service: "astroprocessor-api",
    timestamp: new Date().toISOString()
  }));

  app.get("/health/db", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "postgresql",
      timestamp: new Date().toISOString()
    };
  });
};

