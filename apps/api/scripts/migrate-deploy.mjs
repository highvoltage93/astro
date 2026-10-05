import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL must point to the direct production database connection");
const parsed = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["require", "verify-full"].includes(parsed.searchParams.get("sslmode"))) {
  throw new Error("Migration connection must use PostgreSQL with SSL");
}
const cwd = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  cwd, stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
