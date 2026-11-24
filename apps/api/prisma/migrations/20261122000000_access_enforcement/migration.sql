ALTER TABLE "access_settings"
  ADD COLUMN "enforcementEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "transitionDays" INTEGER NOT NULL DEFAULT 14 CHECK ("transitionDays" BETWEEN 1 AND 365),
  ADD COLUMN "launchedAt" TIMESTAMP(3);
