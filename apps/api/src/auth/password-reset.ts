import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { hashPassword } from "./service";

export const RESET_TTL_MS = 30 * 60 * 1000;
export const newResetToken = () => randomBytes(32).toString("base64url");
export const resetTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const resetLink = (origin: string, token: string) => {
  const url = new URL("/reset-password", origin);
  // Fragments never reach proxy access logs or the Referer header.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
};

export async function completePasswordReset(token: string, password: string,
  db: Pick<typeof prisma, "$transaction"> = prisma): Promise<boolean> {
  const tokenHash = resetTokenHash(token);
  const passwordHash = hashPassword(password);
  try {
    return await db.$transaction(async (tx) => {
      const now = new Date();
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!reset || reset.expiresAt <= now) return false;
      const consumed = await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, tokenHash, expiresAt: { gt: now } } });
      if (consumed.count !== 1) return false;
      const updated = await tx.user.updateMany({ where: { id: reset.userId, authVersion: reset.authVersion, email: reset.email },
        data: { passwordHash, passwordChangedAt: now, authVersion: { increment: 1 } } });
      if (updated.count !== 1) return false;
      await tx.authMailJob.deleteMany({ where: { email: reset.email.toLowerCase() } });
      await tx.auditEvent.create({ data: { userId: reset.userId, action: "auth.password.reset", entity: "User", entityId: reset.userId } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return false;
    throw error;
  }
}
