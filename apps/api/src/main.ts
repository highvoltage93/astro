import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAuthRoutes } from "./auth/routes";
import { registerBirthProfileRoutes } from "./birth-profiles/routes";
import { registerChartRoutes } from "./charts/routes";
import { env } from "./config/env";
import { registerHealthRoutes } from "./health/routes";
import { registerInterpretationRoutes } from "./interpretations/routes";
import { registerPlaceRoutes } from "./places/routes";
import { prisma } from "./prisma/client";
import { registerSavedForecastRoutes } from "./saved-forecasts/routes";
import { registerCalculationProfileRoutes } from "./calculation-profiles/routes";
import { registerConsultationRoutes } from "./consultations/routes";
import { registerConsultationTemplateRoutes } from "./consultation-templates/routes";

const app = Fastify({
  logger: {
    level: env.nodeEnv === "development" ? "info" : "warn"
  }
});

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    void app.close().then(() => process.exit(0)).catch((error: unknown) => {
      app.log.error(error);
      process.exit(1);
    });
  });
}

const start = async (): Promise<void> => {
  await app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPlaceRoutes(app);
  await registerBirthProfileRoutes(app);
  await registerChartRoutes(app);
  await registerSavedForecastRoutes(app);
  await registerCalculationProfileRoutes(app);
  await registerConsultationRoutes(app);
  await registerConsultationTemplateRoutes(app);
  await registerInterpretationRoutes(app);

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
