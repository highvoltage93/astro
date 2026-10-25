import { prisma } from "../prisma/client";

// Activity must not change updatedAt, which is the admin form's edit revision.
// Conditional SQL also throttles writes across concurrent API instances.
export async function recordUserActivity(userId: string, login = false): Promise<void> {
  if (login) {
    await prisma.$executeRaw`
      UPDATE "users" SET
        "lastLoginAt" = GREATEST("lastLoginAt", CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        "lastActiveAt" = GREATEST("lastActiveAt", CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      WHERE "id" = ${userId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "users" SET "lastActiveAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
      WHERE "id" = ${userId}
        AND ("lastActiveAt" IS NULL OR "lastActiveAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 minute')
    `;
  }
}
