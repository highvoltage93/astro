CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "feedback_reports" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "authorUsername" TEXT NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "pagePath" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feedback_reports_userId_requestId_key" ON "feedback_reports"("userId", "requestId");
CREATE INDEX "feedback_reports_status_createdAt_id_idx" ON "feedback_reports"("status", "createdAt", "id");
CREATE INDEX "feedback_reports_userId_createdAt_idx" ON "feedback_reports"("userId", "createdAt");
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
