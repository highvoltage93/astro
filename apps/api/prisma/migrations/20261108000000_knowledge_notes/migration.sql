CREATE TABLE "knowledge_notes" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "conditionsJson" JSONB NOT NULL,
  "sourceProfileId" TEXT,
  "sourceLabel" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_notes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "knowledge_note_revisions" (
  "noteId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL,
  "conditionsJson" JSONB NOT NULL,
  "archived" BOOLEAN NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_note_revisions_pkey" PRIMARY KEY ("noteId", "revision")
);
CREATE INDEX "knowledge_notes_ownerUserId_archived_createdAt_id_idx" ON "knowledge_notes"("ownerUserId", "archived", "createdAt", "id");
CREATE INDEX "knowledge_notes_sourceProfileId_idx" ON "knowledge_notes"("sourceProfileId");
ALTER TABLE "knowledge_notes" ADD CONSTRAINT "knowledge_notes_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_notes" ADD CONSTRAINT "knowledge_notes_sourceProfileId_fkey" FOREIGN KEY ("sourceProfileId") REFERENCES "birth_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_note_revisions" ADD CONSTRAINT "knowledge_note_revisions_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "knowledge_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
