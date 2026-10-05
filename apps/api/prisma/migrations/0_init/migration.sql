-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'CONSULTANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "BirthProfileVisibility" AS ENUM ('PRIVATE', 'LINK', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ChartType" AS ENUM ('NATAL', 'TRANSIT', 'SYNASTRY', 'PROGRESSION', 'RETURN');

-- CreateEnum
CREATE TYPE "InterpretationStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiSessionMode" AS ENUM ('NATAL_SUMMARY', 'CHAT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'uk',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "defaultCalculationProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birth_profiles" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "birthTime" TEXT,
    "birthTimeKnown" BOOLEAN NOT NULL DEFAULT true,
    "birthplaceName" TEXT NOT NULL,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "utcDateTime" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'user',
    "visibility" "BirthProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birth_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_calculations" (
    "id" TEXT NOT NULL,
    "birthProfileId" TEXT,
    "chartType" "ChartType" NOT NULL,
    "zodiacType" TEXT NOT NULL DEFAULT 'tropical',
    "ayanamsa" TEXT,
    "houseSystem" TEXT NOT NULL,
    "calculationEngineVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_profiles" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sourceProfileId" TEXT NOT NULL,
    "sourceCalculationId" TEXT NOT NULL,
    "sourceSnapshotJson" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "contentJson" JSONB NOT NULL,
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lastMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_revisions" (
    "consultationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "privateNotes" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_revisions_pkey" PRIMARY KEY ("consultationId","revision")
);

-- CreateTable
CREATE TABLE "consultation_templates" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "bodyJson" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lastMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_forecasts" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "inputJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "interpretationJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpretation_items" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "interpretationType" TEXT NOT NULL,
    "factorKey" TEXT NOT NULL,
    "school" TEXT NOT NULL DEFAULT 'psychological',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readingLevel" TEXT NOT NULL DEFAULT 'beginner',
    "status" "InterpretationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interpretation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "birthProfileId" TEXT,
    "chartCalculationId" TEXT,
    "mode" "AiSessionMode" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "safetyStatus" TEXT NOT NULL DEFAULT 'pending',
    "messagesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "birth_profiles_ownerUserId_idx" ON "birth_profiles"("ownerUserId");

-- CreateIndex
CREATE INDEX "birth_profiles_visibility_idx" ON "birth_profiles"("visibility");

-- CreateIndex
CREATE INDEX "chart_calculations_birthProfileId_idx" ON "chart_calculations"("birthProfileId");

-- CreateIndex
CREATE INDEX "chart_calculations_chartType_idx" ON "chart_calculations"("chartType");

-- CreateIndex
CREATE INDEX "chart_calculations_inputHash_idx" ON "chart_calculations"("inputHash");

-- CreateIndex
CREATE INDEX "calculation_profiles_ownerUserId_updatedAt_idx" ON "calculation_profiles"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "consultations_ownerUserId_createdAt_id_idx" ON "consultations"("ownerUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "consultations_ownerUserId_sourceProfileId_idx" ON "consultations"("ownerUserId", "sourceProfileId");

-- CreateIndex
CREATE INDEX "consultation_templates_ownerUserId_createdAt_id_idx" ON "consultation_templates"("ownerUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "saved_forecasts_ownerUserId_createdAt_id_idx" ON "saved_forecasts"("ownerUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_forecasts_ownerUserId_requestId_key" ON "saved_forecasts"("ownerUserId", "requestId");

-- CreateIndex
CREATE INDEX "interpretation_items_status_idx" ON "interpretation_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "interpretation_items_locale_factorKey_school_version_key" ON "interpretation_items"("locale", "factorKey", "school", "version");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_terms_locale_slug_key" ON "glossary_terms"("locale", "slug");

-- CreateIndex
CREATE INDEX "ai_sessions_userId_idx" ON "ai_sessions"("userId");

-- CreateIndex
CREATE INDEX "ai_sessions_birthProfileId_idx" ON "ai_sessions"("birthProfileId");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");

-- CreateIndex
CREATE INDEX "audit_events_entity_entityId_idx" ON "audit_events"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_defaultCalculationProfileId_fkey" FOREIGN KEY ("defaultCalculationProfileId") REFERENCES "calculation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_calculations" ADD CONSTRAINT "chart_calculations_birthProfileId_fkey" FOREIGN KEY ("birthProfileId") REFERENCES "birth_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_profiles" ADD CONSTRAINT "calculation_profiles_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_revisions" ADD CONSTRAINT "consultation_revisions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_templates" ADD CONSTRAINT "consultation_templates_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_forecasts" ADD CONSTRAINT "saved_forecasts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_birthProfileId_fkey" FOREIGN KEY ("birthProfileId") REFERENCES "birth_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_chartCalculationId_fkey" FOREIGN KEY ("chartCalculationId") REFERENCES "chart_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
