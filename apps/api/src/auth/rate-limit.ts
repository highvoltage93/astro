import { createHmac } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma/client";
import { env } from "../config/env";

export type LimitDecision = { allowed: boolean; retryAfter: number };
export type ConsumeLimit = (scope: string, identity: string, max: number, seconds: number) => Promise<LimitDecision>;
export const limitKey = (scope: string, identity: string) => createHmac("sha256", env.jwtSecret)
  .update(JSON.stringify(["auth-limit-v1", scope, identity.trim().toLowerCase()])).digest("hex");
let nextCleanup = 0;

export const consumeAuthLimit: ConsumeLimit = async (scope, identity, max, seconds) => {
  const now = new Date();
  if (now.getTime() >= nextCleanup) {
    nextCleanup = now.getTime() + 60000;
    await prisma.$executeRaw`DELETE FROM "auth_rate_limits" WHERE "key" IN
      (SELECT "key" FROM "auth_rate_limits" WHERE "expiresAt" <= ${now} LIMIT 1000)`;
  }
  const key = limitKey(scope, identity);
  const expiresAt = new Date(now.getTime() + seconds * 1000);
  // The increment and expiry reset are atomic across API replicas.
  const [row] = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "auth_rate_limits" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "auth_rate_limits"."expiresAt" <= ${now} THEN 1
                     ELSE LEAST("auth_rate_limits"."count" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "auth_rate_limits"."expiresAt" <= ${now} THEN ${expiresAt}
                         ELSE "auth_rate_limits"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  if (!row) throw new Error("Auth limiter unavailable");
  return { allowed: row.count <= max, retryAfter: Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)) };
};

export async function enforceAuthLimit(request: FastifyRequest, reply: FastifyReply, scope: string,
  identity: string, max: number, seconds: number, consume: ConsumeLimit = consumeAuthLimit): Promise<boolean> {
  try {
    const result = await consume(scope, identity, max, seconds);
    if (result.allowed) return true;
    reply.header("Retry-After", result.retryAfter).code(429).send({ code: "AUTH_RATE_LIMITED",
      message: "Забагато спроб. Спробуйте пізніше.", retryAfter: result.retryAfter });
  } catch {
    request.log.warn("Auth limiter unavailable");
    reply.code(503).send({ code: "AUTH_UNAVAILABLE", message: "Вхід тимчасово недоступний. Спробуйте пізніше." });
  }
  return false;
}
