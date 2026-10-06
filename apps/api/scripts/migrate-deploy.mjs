import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateProductionDatabaseUrl } = require("../dist/config/database-transport.js");

const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL must point to the direct production database connection");
validateProductionDatabaseUrl(databaseUrl, process.env.ALLOW_PRIVATE_DATABASE === "true");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  cwd, stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
