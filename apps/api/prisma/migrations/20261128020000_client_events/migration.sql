CREATE TABLE "client_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "approximate" BOOLEAN NOT NULL DEFAULT false,
  "category" TEXT NOT NULL DEFAULT 'other',
  "notes" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_events_category_check" CHECK ("category" IN ('relocation', 'work', 'relationships', 'family', 'health', 'education', 'other'))
);
CREATE INDEX "client_events_clientId_date_id_idx" ON "client_events"("clientId", "date", "id");
