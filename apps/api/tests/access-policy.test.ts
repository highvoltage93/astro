import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { accessDecision, trialEnd, type Grant } from "../src/access/policy";
import { registerAuthRoutes } from "../src/auth/routes";

const now = new Date("2030-01-01T00:00:00.000Z");
const grant = (change: Partial<Grant> = {}): Grant => ({ plan: "TRIAL", startsAt: now,
  endsAt: trialEnd(now, 7), revokedAt: null, ...change });

test("existing users without grants stay Free in preview, administrators remain a separate role", () => {
  const free = accessDecision("USER", [], now);
  assert.equal(free.plan, "FREE");
  assert.equal(free.mode, "preview");
  assert.equal(free.endsAt, null);
  assert.equal(free.proposed.natal, true);
  assert.equal(free.proposed.ownObservations, true);
  assert.equal(free.proposed.sharedObservations, false);
  assert.equal(accessDecision("ADMIN", [], now).plan, "FREE");
  assert.equal(accessDecision("ADMIN", [], now).administrator, true);
  assert.ok(Object.values(accessDecision("ADMIN", [], now).proposed).every(Boolean));
});

test("grant starts inclusively, expires exclusively, and revoked or future grants never apply", () => {
  assert.equal(accessDecision("USER", [grant()], now).plan, "TRIAL");
  assert.equal(accessDecision("USER", [grant()], trialEnd(now, 7)).plan, "FREE");
  assert.equal(accessDecision("USER", [grant({ revokedAt: now })], now).plan, "FREE");
  assert.equal(accessDecision("USER", [grant({ startsAt: trialEnd(now, 1) })], now).plan, "FREE");
});

test("Pro wins over Trial; expiry and revocation preserve other independent grants", () => {
  const trial = grant();
  const pro = grant({ plan: "PRO", endsAt: trialEnd(now, 2) });
  const extendedPro = grant({ plan: "PRO", endsAt: trialEnd(now, 4) });
  assert.equal(accessDecision("USER", [trial, pro, extendedPro], now).endsAt?.toISOString(), trialEnd(now, 4).toISOString());
  assert.equal(accessDecision("USER", [trial, pro], now).plan, "PRO");
  assert.equal(accessDecision("USER", [trial, pro], trialEnd(now, 2)).plan, "TRIAL");
  assert.equal(accessDecision("USER", [trial, { ...pro, revokedAt: now }], now).plan, "TRIAL");
});

test("trial duration is elapsed UTC days, including leap years and DST boundaries", () => {
  const start = new Date("2028-02-28T12:34:56.000Z");
  assert.equal(trialEnd(start, 3).toISOString(), "2028-03-02T12:34:56.000Z");
  assert.equal(trialEnd(start, 7).getTime() - start.getTime(), 7 * 86400000);
  const dst = new Date("2030-03-30T12:00:00Z");
  assert.equal(trialEnd(dst, 3).getTime() - dst.getTime(), 3 * 86400000);
});

test("registration creates the configured trial atomically; disabling trial creates no grant", async () => {
  type Dependencies = NonNullable<Parameters<typeof registerAuthRoutes>[1]>;
  for (const trialEnabled of [true, false]) {
    const app = Fastify();
    const tx = {
      accessSettings: { findUnique: async () => ({ trialEnabled, trialDays: 3, revision: 1 }) },
      user: { create: async ({ data }: { data: { accessGrants?: { create: Grant & { source: string } } } }) => {
        const created = data.accessGrants?.create;
        if (trialEnabled) {
          assert.ok(created);
          assert.equal(created.plan, "TRIAL"); assert.equal(created.source, "registration");
          assert.equal(created.endsAt.getTime() - created.startsAt.getTime(), 3 * 86400000);
        } else assert.equal(created, undefined);
        return { id: "new-user", username: "tester", email: "test@example.com", locale: "uk", role: "USER" };
      } }
    };
    await registerAuthRoutes(app, { database: { $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as Dependencies["database"],
      consume: async () => ({ allowed: true, retryAfter: 1 }) });
    try {
      const response = await app.inject({ method: "POST", url: "/auth/register", payload: {
        email: "test@example.com", username: "tester", password: "Strong12!"
      } });
      assert.equal(response.statusCode, 201);
      assert.equal(response.json().user.username, "tester");
    } finally { await app.close(); }
  }
});
