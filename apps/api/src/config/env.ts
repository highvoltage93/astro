import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import { validateProductionDatabaseUrl } from "./database-transport";

if (process.env.NODE_ENV === "production") {
  for (const key of ["DATABASE_URL", "JWT_SECRET", "CORS_ORIGIN", "SWISSEPH_EPHE_PATH"] as const) {
    if (!process.env[key]?.trim()) throw new Error(`Missing production variable: ${key}`);
  }
  if (process.env.JWT_SECRET!.length < 32 || /astroprocessor|REPLACE|CHANGE_ME/i.test(process.env.JWT_SECRET!)) {
    throw new Error("Production JWT_SECRET must be a new random secret of at least 32 characters");
  }
  const origin = new URL(process.env.CORS_ORIGIN!);
  if (origin.protocol !== "https:" || origin.origin !== process.env.CORS_ORIGIN) {
    throw new Error("Production CORS_ORIGIN must be one HTTPS origin without a trailing slash");
  }
  validateProductionDatabaseUrl(process.env.DATABASE_URL!, process.env.ALLOW_PRIVATE_DATABASE === "true");
  for (const file of ["sepl_18.se1", "semo_18.se1", "seas_18.se1"]) {
    accessSync(join(process.env.SWISSEPH_EPHE_PATH!, file), constants.R_OK);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "astroprocessor-dev-secret",
  swissEphEphePath: process.env.SWISSEPH_EPHE_PATH,
  geocodingApiUrl: process.env.GEOCODING_API_URL ?? "https://geocoding-api.open-meteo.com/v1"
};
