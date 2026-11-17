import type { FastifyInstance } from "fastify";
import type { AuthMailJob } from "@prisma/client";
import { prisma } from "../prisma/client";
import { mailConfig } from "./config";
import { sendPasswordReset } from "./transport";
import { newResetToken, resetLink, resetTokenHash, RESET_TTL_MS } from "../auth/password-reset";

export function startMailWorker(app: FastifyInstance) {
  if (!mailConfig.enabled) return async () => {};
  const origin = mailConfig.origin;
  let stopped = false;
  let pending: Promise<void> | null = null;
  let cleanupAt = 0;
  async function tick() {
    const now = new Date();
    if (now.getTime() >= cleanupAt) {
      await prisma.authMailJob.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RESET_TTL_MS) } } });
      await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } });
      cleanupAt = now.getTime() + 60000;
    }
    const [job] = await prisma.$queryRaw<AuthMailJob[]>`
      UPDATE "auth_mail_jobs" SET "lockedUntil" = ${new Date(now.getTime() + 60000)}, "attempts" = "attempts" + 1
      WHERE "id" = (SELECT "id" FROM "auth_mail_jobs" WHERE "availableAt" <= ${now}
        AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now}) AND "attempts" < 5
        ORDER BY "createdAt", "id" LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`;
    if (!job) return;
    try {
      const expiresAt = new Date(job.createdAt.getTime() + RESET_TTL_MS);
      // Case-insensitive duplicates in legacy data must not select an arbitrary account.
      const users = await prisma.user.findMany({ where: { email: { equals: job.email, mode: "insensitive" } },
        select: { id: true, email: true, authVersion: true, passwordChangedAt: true }, take: 2 });
      const user = users.length === 1 ? users[0] : undefined;
      if (user && expiresAt > new Date() && (!user.passwordChangedAt || user.passwordChangedAt < job.createdAt)) {
        const token = newResetToken();
        await prisma.passwordResetToken.upsert({ where: { userId: user.id },
          create: { userId: user.id, tokenHash: resetTokenHash(token), authVersion: user.authVersion, email: user.email, expiresAt },
          update: { tokenHash: resetTokenHash(token), authVersion: user.authVersion, email: user.email, expiresAt } });
        await sendPasswordReset(user.email, resetLink(origin, token));
      }
      await prisma.authMailJob.deleteMany({ where: { id: job.id } });
    } catch {
      app.log.warn({ jobId: job.id, attempt: job.attempts }, "Password recovery email delivery failed");
      if (job.attempts >= 5) await prisma.authMailJob.deleteMany({ where: { id: job.id } });
      else await prisma.authMailJob.updateMany({ where: { id: job.id }, data: {
        lockedUntil: null, availableAt: new Date(Date.now() + Math.min(300000, 15000 * 2 ** job.attempts))
      } });
    }
  }
  const timer = setInterval(() => {
    if (stopped || pending) return;
    pending = tick().catch(() => { app.log.warn("Mail worker unavailable"); }).finally(() => { pending = null; });
  }, 2000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await pending; };
}
