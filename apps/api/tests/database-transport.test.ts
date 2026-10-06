import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionDatabaseUrl } from "../src/config/database-transport";

test("external PostgreSQL requires explicit TLS even with private Docker mode enabled", () => {
  assert.doesNotThrow(() => validateProductionDatabaseUrl("postgresql://user:pass@db.example.com/db?sslmode=require", false));
  assert.doesNotThrow(() => validateProductionDatabaseUrl("postgresql://user:pass@db.example.com/db?sslmode=verify-full", true));
  assert.throws(() => validateProductionDatabaseUrl("postgresql://user:pass@db.example.com/db?sslmode=disable", true));
  assert.throws(() => validateProductionDatabaseUrl("postgresql://user:pass@db.example.com/db", false));
});

test("plaintext requires an explicit opt-in and the exact private Docker service", () => {
  const url = "postgresql://astro_app:pass@postgres:5432/astroprocessor?sslmode=disable&connection_limit=5";
  assert.doesNotThrow(() => validateProductionDatabaseUrl(url, true));
  assert.throws(() => validateProductionDatabaseUrl(url, false));
  assert.throws(() => validateProductionDatabaseUrl(url.replace("postgres:5432", "postgres.example.com:5432"), true));
  assert.throws(() => validateProductionDatabaseUrl(url.replace(":5432", ":6432"), true));
});

test("ambiguous parameters and host overrides are rejected without exposing credentials", () => {
  const url = "postgresql://user:pass@postgres/db?sslmode=disable";
  assert.throws(() => validateProductionDatabaseUrl(`${url}&host=elsewhere`, true));
  assert.throws(() => validateProductionDatabaseUrl(`${url}&sslmode=require`, true));
  assert.throws(() => validateProductionDatabaseUrl("postgresql://secret-password@", false), { message: "Invalid production database URL" });
});
