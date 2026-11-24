import type { FastifyInstance, FastifyRequest } from "fastify";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";
import { accessDecision, defaultAccessSettings } from "./policy";

export async function userAccess(userId: string, role: string) {
  const settings = await prisma.accessSettings.findUnique({ where: { id: "default" } }) ?? defaultAccessSettings;
  const grants = await prisma.accessGrant.findMany({ where: { userId, revokedAt: null, endsAt: { gt: new Date() } } });
  return accessDecision(role, grants, new Date(), settings.enforcementEnabled);
}

// Applied to the work routes only. Authentication, billing, support and archive reads stay available.
export function requiresWorkAccess(method: string, route: string) {
  if (["GET", "HEAD", "OPTIONS", "DELETE"].includes(method)) return false;
  // Matching stored observations does not create a new chart or change the archive.
  if (["/knowledge-notes/matches", "/knowledge-library/matches"].includes(route)) return false;
  return true;
}

export function registerWorkAccessGuard(app: FastifyInstance, deps: {
  authenticate: (request: FastifyRequest) => Promise<{ id: string; role: string } | null>;
  settings: () => Promise<{ enforcementEnabled: boolean }>;
  access: (userId: string, role: string) => Promise<{ canWork: boolean }>;
} = {
  authenticate: getOptionalAuthUser,
  settings: async () => prisma.accessSettings.findUnique({ where: { id: "default" } }).then(value => value ?? defaultAccessSettings),
  access: userAccess
}) {
  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    if (!requiresWorkAccess(request.method, request.routeOptions.url ?? "")) return;
    const settings = await deps.settings();
    if (!settings.enforcementEnabled) return;
    reply.header("Cache-Control", "no-store");
    const user = await deps.authenticate(request);
    if (!user) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Увійдіть до акаунта." });
    const access = await deps.access(user.id, user.role);
    if (!access.canWork) return reply.code(403).send({ code: "SUBSCRIPTION_REQUIRED", plansUrl: "/plans",
      message: "Строк доступу завершився. Для нових розрахунків і редагування потрібна підписка. Ваш архів доступний для перегляду." });
  });
}
