ALTER TABLE "users" ADD COLUMN "sharedKnowledgeUntil" TIMESTAMP(3);

CREATE TABLE "knowledge_publications" (
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "conditionsJson" JSONB NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_publications_pkey" PRIMARY KEY ("noteId")
);

CREATE TABLE "knowledge_activations" (
    "userId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "acceptedRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_activations_pkey" PRIMARY KEY ("userId", "publicationId")
);

CREATE INDEX "knowledge_publications_published_noteId_idx" ON "knowledge_publications"("published", "noteId");
CREATE INDEX "knowledge_activations_publicationId_idx" ON "knowledge_activations"("publicationId");
ALTER TABLE "knowledge_publications" ADD CONSTRAINT "knowledge_publications_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "knowledge_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_activations" ADD CONSTRAINT "knowledge_activations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_activations" ADD CONSTRAINT "knowledge_activations_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "knowledge_publications"("noteId") ON DELETE CASCADE ON UPDATE CASCADE;
