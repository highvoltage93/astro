CREATE TYPE "AccessPlan" AS ENUM ('TRIAL', 'PRO');
CREATE TABLE "access_grants" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "plan" "AccessPlan" NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_grants_valid_interval" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "access_grants_userId_endsAt_idx" ON "access_grants"("userId", "endsAt");
CREATE TABLE "access_settings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "trialEnabled" BOOLEAN NOT NULL DEFAULT true,
  "trialDays" INTEGER NOT NULL DEFAULT 7 CHECK ("trialDays" BETWEEN 1 AND 365),
  "revision" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "access_settings" ("id") VALUES ('default');
