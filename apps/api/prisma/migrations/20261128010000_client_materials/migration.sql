CREATE TABLE "client_materials" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "birthProfileId" TEXT REFERENCES "birth_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "forecastId" TEXT REFERENCES "saved_forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "consultationId" TEXT REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_materials_one_target" CHECK (num_nonnulls("birthProfileId", "forecastId", "consultationId") = 1)
);
CREATE UNIQUE INDEX "client_materials_clientId_birthProfileId_key" ON "client_materials"("clientId", "birthProfileId");
CREATE UNIQUE INDEX "client_materials_clientId_forecastId_key" ON "client_materials"("clientId", "forecastId");
CREATE UNIQUE INDEX "client_materials_clientId_consultationId_key" ON "client_materials"("clientId", "consultationId");
CREATE INDEX "client_materials_birthProfileId_idx" ON "client_materials"("birthProfileId");
CREATE INDEX "client_materials_forecastId_idx" ON "client_materials"("forecastId");
CREATE INDEX "client_materials_consultationId_idx" ON "client_materials"("consultationId");
