import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerAuthRoutes } from "../src/auth/routes";
import { registerRecoveryRoutes } from "../src/auth/recovery-routes";
import { limitKey, type ConsumeLimit } from "../src/auth/rate-limit";
import { hashPassword, verifyAuthToken, tokenVersionMatches } from "../src/auth/service";

type AuthDependencies = NonNullable<Parameters<typeof registerAuthRoutes>[1]>;
const allowed: ConsumeLimit = async () => ({ allowed: true, retryAfter: 900 });

test("limiter identifiers are scoped, normalized hashes, not raw usernames or addresses", () => {
  assert.equal(limitKey("login-username", " Admin "), limitKey("login-username", "admin"));
  assert.match(limitKey("login-ip", "127.0.0.1"), /^[a-f0-9]{64}$/);
  assert.notEqual(limitKey("login-ip", "admin"), limitKey("login-username", "admin"));
});

test("username limiter stops guessing across IPs before password lookup", async () => {
  const app = Fastify();
  let lookups = 0;
  const counts = new Map<string, number>();
  await registerAuthRoutes(app, {
    database: { user: { findUnique: async () => { lookups++; return null; } } } as unknown as AuthDependencies["database"],
    consume: async (scope, identity, max) => {
      const key = limitKey(scope, identity);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { allowed: count <= max, retryAfter: 700 };
    }
  });
  try {
    for (let i = 0; i < 301; i++) {
      const response = await app.inject({ method: "POST", url: "/auth/login", remoteAddress: `192.0.${2 + Math.floor(i / 254)}.${i % 254 + 1}`,
        payload: { username: i % 2 ? "ADMIN" : "admin", password: "wrong" } });
      assert.equal(response.statusCode, i < 300 ? 401 : 429);
      if (i === 300) assert.equal(response.headers["retry-after"], "700");
    }
    assert.equal(lookups, 300);
  } finally { await app.close(); }
});

test("untrusted forwarded IP cannot bypass login IP limiter, and unavailable limiter fails closed", async () => {
  for (const unavailable of [false, true]) {
    const app = Fastify({ trustProxy: false });
    await registerAuthRoutes(app, {
      database: { user: { findUnique: async () => { throw new Error("Must not query users"); } } } as unknown as AuthDependencies["database"],
      consume: async (scope, identity) => {
        assert.equal(scope, "login-ip"); assert.equal(identity, "192.0.2.10");
        if (unavailable) throw new Error("Database unavailable");
        return { allowed: false, retryAfter: 60 };
      }
    });
    try {
      const response = await app.inject({ method: "POST", url: "/auth/login", remoteAddress: "192.0.2.10",
        headers: { "x-forwarded-for": "198.51.100.1" }, payload: { username: "admin", password: "admin" } });
      assert.equal(response.statusCode, unavailable ? 503 : 429);
      assert.equal(response.headers["cache-control"], "no-store");
    } finally { await app.close(); }
  }
});

test("existing short passwords can still log in and tokens carry the current version", async () => {
  const app = Fastify();
  await registerAuthRoutes(app, {
    database: { user: { findUnique: async () => ({ id: "legacy", email: "admin@test.com", username: "admin", locale: "uk",
      role: "ADMIN", passwordHash: hashPassword("admin"), authVersion: 4 }) } } as unknown as AuthDependencies["database"],
    consume: allowed, recordLogin: async () => {}
  });
  try {
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "admin", password: "admin" } });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(verifyAuthToken(body.token)?.ver, 4);
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(body.user.authVersion, undefined);
    assert.equal(tokenVersionMatches(undefined, 0), true);
    assert.equal(tokenVersionMatches(undefined, 1), false);
    assert.equal(tokenVersionMatches(4, 5), false);
  } finally { await app.close(); }
});

test("recovery gives the same response for queued addresses and email throttling", async () => {
  const app = Fastify();
  const queued: string[] = [];
  await registerRecoveryRoutes(app, {
    enabled: true,
    consume: async (scope, identity) => ({ allowed: scope !== "forgot-email" || identity !== "limited@example.com", retryAfter: 3600 }),
    enqueue: async (email) => { queued.push(email); }, complete: async () => false
  });
  try {
    const bodies: string[] = [];
    for (const email of ["Known@example.com", "unknown@example.com", "limited@example.com"]) {
      const response = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email } });
      assert.equal(response.statusCode, 202); bodies.push(response.body);
    }
    assert.equal(new Set(bodies).size, 1);
    assert.deepEqual(queued, ["known@example.com", "unknown@example.com"]);
  } finally { await app.close(); }
});

test("reset enforces password policy and token shape before invoking persistence", async () => {
  const app = Fastify();
  let calls = 0;
  await registerRecoveryRoutes(app, {
    enabled: true, consume: allowed, enqueue: async () => {}, complete: async () => { calls++; return false; }
  });
  try {
    for (const payload of [{ token: "invalid", password: "Strong12!" }, { token: "a".repeat(43), password: "admin" }]) {
      const response = await app.inject({ method: "POST", url: "/auth/reset-password", payload });
      assert.equal(response.statusCode, 400);
    }
    assert.equal(calls, 0);
    const response = await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "a".repeat(43), password: "Strong12!" } });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "RESET_LINK_INVALID");
    assert.equal(calls, 1);
  } finally { await app.close(); }
});

test("disabled recovery never queues mail or changes a password", async () => {
  const app = Fastify();
  await registerRecoveryRoutes(app, { enabled: false, consume: allowed,
    enqueue: async () => { assert.fail("No mail when disabled"); }, complete: async () => { assert.fail("No reset when disabled"); } });
  try {
    assert.deepEqual((await app.inject("/auth/password-reset/config")).json(), { enabled: false });
    assert.equal((await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "user@example.com" } })).statusCode, 503);
    assert.equal((await app.inject({ method: "POST", url: "/auth/reset-password", payload: { token: "a".repeat(43), password: "Strong12!" } })).statusCode, 503);
  } finally { await app.close(); }
});
