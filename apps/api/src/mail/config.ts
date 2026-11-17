import { z } from "zod";

export function readMailConfig(source: NodeJS.ProcessEnv = process.env) {
  const transport = z.enum(["disabled", "smtp"]).parse(source.EMAIL_TRANSPORT || "disabled");
  if (transport === "disabled") return { enabled: false as const };
  const origin = new URL(source.APP_ORIGIN || "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("APP_ORIGIN must be one HTTP(S) origin");
  }
  const secure = source.SMTP_SECURE === "true";
  const requireTLS = source.SMTP_REQUIRE_TLS !== "false";
  if (source.NODE_ENV === "production" && (origin.protocol !== "https:" || (!secure && !requireTLS))) {
    throw new Error("Production recovery requires HTTPS and encrypted SMTP");
  }
  const from = z.string().email().parse(source.MAIL_FROM || "noreply@zoria.test");
  if (source.NODE_ENV === "production" && (!source.APP_ORIGIN || !source.MAIL_FROM || !source.SMTP_HOST)) {
    throw new Error("Production SMTP requires APP_ORIGIN, MAIL_FROM and SMTP_HOST");
  }
  const user = source.SMTP_USER || undefined, pass = source.SMTP_PASSWORD || undefined;
  if (!!user !== !!pass) throw new Error("Configure both SMTP_USER and SMTP_PASSWORD");
  return { enabled: true as const, origin: origin.origin, from,
    host: source.SMTP_HOST || "mailpit", port: z.coerce.number().int().min(1).max(65535).parse(source.SMTP_PORT || "1025"),
    secure, requireTLS, auth: user && pass ? { user, pass } : undefined };
}

export const mailConfig = readMailConfig();
