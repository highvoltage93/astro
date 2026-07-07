export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "astroprocessor-dev-secret",
  swissEphEphePath: process.env.SWISSEPH_EPHE_PATH,
  geocodingApiUrl: process.env.GEOCODING_API_URL ?? "https://geocoding-api.open-meteo.com/v1"
};
