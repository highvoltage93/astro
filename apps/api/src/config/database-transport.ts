export function validateProductionDatabaseUrl(value: string, allowPrivateNetwork: boolean): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid production database URL"); }
  const ssl = url.searchParams.get("sslmode");
  const privateDocker = allowPrivateNetwork && url.hostname === "postgres" &&
    (!url.port || url.port === "5432") && ssl === "disable";
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.searchParams.getAll("sslmode").length !== 1 ||
    (!privateDocker && ssl !== "require" && ssl !== "verify-full") ||
    ["host", "hostaddr", "service"].some((key) => url.searchParams.has(key))) {
    throw new Error("Database requires SSL; private opt-out is restricted to the postgres Docker service");
  }
}
