import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAuthRoutes } from "./auth/routes";
import { registerClientRoutes } from "./clients/routes";
import { registerAccessRoutes } from "./access/routes";
import { registerWorkAccessGuard } from "./access/guard";
import { registerRecoveryRoutes } from "./auth/recovery-routes";
import { startMailWorker } from "./mail/worker";
import { registerAdminRoutes } from "./admin/routes";
import { registerAstrologerRankingRoutes } from "./admin/astrologer-ranking";
import { registerAdminKnowledgeRoutes } from "./admin/knowledge";
import { registerFeedbackRoutes } from "./feedback/routes";
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
import { registerKnowledgeNoteRoutes } from "./knowledge-notes/routes";
import { registerKnowledgeSharingRoutes } from "./knowledge-notes/sharing-routes";
import { registerAstroEventRoutes } from "./astro-events/routes";

const app = Fastify({
  trustProxy: env.trustedProxyCidrs.length ? env.trustedProxyCidrs : false,
  logger: {
    redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "req.body.token"],
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
  await registerAccessRoutes(app);
  await registerRecoveryRoutes(app);
  await registerAdminRoutes(app);
  await registerAstrologerRankingRoutes(app);
  await registerAdminKnowledgeRoutes(app);
  await registerFeedbackRoutes(app);
  await registerPlaceRoutes(app);
  await app.register(async (work) => {
    registerWorkAccessGuard(work);
    await registerClientRoutes(work);
    await registerBirthProfileRoutes(work);
    await registerChartRoutes(work);
    await registerSavedForecastRoutes(work);
    await registerCalculationProfileRoutes(work);
    await registerConsultationRoutes(work);
    await registerConsultationTemplateRoutes(work);
    await registerKnowledgeNoteRoutes(work);
    await registerKnowledgeSharingRoutes(work);
    await registerAstroEventRoutes(work);
    await registerInterpretationRoutes(work);
  });

  const stopMailWorker = startMailWorker(app);
  app.addHook("onClose", async () => {
    await stopMailWorker();
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
