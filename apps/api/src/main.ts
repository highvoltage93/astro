import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerBirthProfileRoutes } from "./birth-profiles/routes";
import { registerChartRoutes } from "./charts/routes";
import { env } from "./config/env";
import { registerHealthRoutes } from "./health/routes";
import { prisma } from "./prisma/client";

const app = Fastify({
  logger: {
    level: env.nodeEnv === "development" ? "info" : "warn"
  }
});

const start = async (): Promise<void> => {
  await app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });

  await registerHealthRoutes(app);
  await registerBirthProfileRoutes(app);
  await registerChartRoutes(app);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({
    host: "0.0.0.0",
    port: env.port
  });
};

start().catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
