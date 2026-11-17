import assert from "node:assert/strict";
import test from "node:test";
import { completePasswordReset, newResetToken, resetLink, resetTokenHash } from "../src/auth/password-reset";
import { verifyPassword } from "../src/auth/service";
import { readMailConfig } from "../src/mail/config";

test("reset tokens have 256 random bits and are only in the URL fragment", () => {
  const token = newResetToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newResetToken(), token);
  assert.match(resetTokenHash(token), /^[a-f0-9]{64}$/);
  const url = new URL(resetLink("https://zoria.example", token));
  assert.equal(url.origin, "https://zoria.example");
  assert.equal(url.pathname, "/reset-password");
  assert.equal(url.search, "");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), token);
});

test("production recovery requires an explicit HTTPS origin, sender and encrypted SMTP", () => {
  assert.deepEqual(readMailConfig({ NODE_ENV: "production" }), { enabled: false });
  const config = { NODE_ENV: "production", EMAIL_TRANSPORT: "smtp", APP_ORIGIN: "https://zoria.example",
    MAIL_FROM: "noreply@zoria.example", SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_REQUIRE_TLS: "true" };
  assert.equal(readMailConfig(config).enabled, true);
  for (const change of [{ APP_ORIGIN: "http://zoria.example" }, { APP_ORIGIN: "https://user:pass@zoria.example" },
    { APP_ORIGIN: "https://zoria.example/path" }, { SMTP_REQUIRE_TLS: "false" }, { SMTP_HOST: "" },
    { MAIL_FROM: "" }, { SMTP_USER: "user" }]) {
    assert.throws(() => readMailConfig({ ...config, ...change }));
  }
  assert.equal(readMailConfig({ EMAIL_TRANSPORT: "smtp", SMTP_REQUIRE_TLS: "false" }).enabled, true);
});

type ResetDatabase = NonNullable<Parameters<typeof completePasswordReset>[2]>;

function resetFixture(expired = false, currentVersion = 0) {
  const token = newResetToken();
  let stored = true;
  let version = currentVersion;
  let passwordHash = "";
  let audited = false;
  const reset = { userId: "user", email: "user@example.com", authVersion: 0,
    expiresAt: new Date(Date.now() + (expired ? -60000 : 60000)) };
  const tx = {
    passwordResetToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => stored && where.tokenHash === resetTokenHash(token) ? reset : null,
      deleteMany: async () => { const count = stored ? 1 : 0; stored = false; return { count }; }
    },
    user: { updateMany: async ({ where, data }: { where: { authVersion: number }; data: { passwordHash: string; authVersion: { increment: number } } }) => {
      if (where.authVersion !== version) return { count: 0 };
      version += data.authVersion.increment; passwordHash = data.passwordHash; return { count: 1 };
    } },
    authMailJob: { deleteMany: async () => ({ count: 0 }) },
    auditEvent: { create: async () => { audited = true; } }
  };
  const db = { $transaction: async (callback: (value: typeof tx) => Promise<boolean>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable"); return callback(tx);
  } } as unknown as ResetDatabase;
  return { token, db, state: () => ({ version, passwordHash, audited }) };
}

test("reset consumes the token, hashes the new password and revokes old token versions", async () => {
  const fixture = resetFixture();
  assert.equal(await completePasswordReset(fixture.token, "Strong12!", fixture.db), true);
  assert.equal(fixture.state().version, 1);
  assert.equal(fixture.state().audited, true);
  assert.equal(verifyPassword("Strong12!", fixture.state().passwordHash), true);
  assert.equal(await completePasswordReset(fixture.token, "Other123!", fixture.db), false);
});

test("expired, unknown and version-stale tokens cannot change the password", async () => {
  for (const fixture of [resetFixture(true), resetFixture(false, 1)]) {
    assert.equal(await completePasswordReset(fixture.token, "Strong12!", fixture.db), false);
    assert.equal(fixture.state().passwordHash, "");
    assert.equal(fixture.state().audited, false);
  }
  const fixture = resetFixture();
  assert.equal(await completePasswordReset(newResetToken(), "Strong12!", fixture.db), false);
  assert.equal(fixture.state().version, 0);
});
