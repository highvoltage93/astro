import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { eventSearchSchema, registerEventSearchRoutes } from "../src/charts/event-search";

const payload = { natal: { birthDate: "1990-01-01", birthTime: "12:00:37", timezone: "UTC", latitude: 50.45, longitude: 30.52 },
  from: "2026-09-01T00:00:00Z", until: "2026-10-01T00:00:00Z", kinds: ["ingress", "station"], planets: ["mercury"], aspectOrb: 1 };
test("event search rejects reversed, excessive or unsupported requests", () => {
  assert.equal(eventSearchSchema.safeParse(payload).success, true);
  for (const patch of [{ until: payload.from }, { until: "2027-10-01T00:00:00Z" }, { from: "1899-09-01T00:00:00Z" }, { kinds: ["invented"] }, { planets: ["chiron"] }, { aspectOrb: 6 }, { kinds: [] }]) {
    assert.equal(eventSearchSchema.safeParse({ ...payload, ...patch }).success, false);
  }
});
test("event search authenticates before calculating and protects the ephemeris path", async (t) => {
  const app = Fastify(); t.after(() => app.close());
  let calls = 0;
  await registerEventSearchRoutes(app, {
    authenticate: async (request) => request.headers.authorization ? { id: "owner" } : null,
    calculate: (input) => {
      calls++;
      assert.equal(input.natal.birthTime, "12:00:37");
      assert.notEqual(input.natal.ephemerisPath, "client-path");
      return { generatedAt: "2026-09-01T00:00:00Z", from: input.from, until: input.until, zodiac: "tropical", ayanamsa: null,
        kinds: input.kinds, planets: input.planets, aspectOrb: input.aspectOrb, samplingHours: 6, timeToleranceSeconds: 1, events: [], warnings: [] };
    }
  });
  assert.equal((await app.inject({ method: "POST", url: "/charts/events/search", payload })).statusCode, 401);
  assert.equal(calls, 0);
  const result = await app.inject({ method: "POST", url: "/charts/events/search", headers: { authorization: "Bearer test" }, payload: { ...payload, natal: { ...payload.natal, ephemerisPath: "client-path" } } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["cache-control"], "private, no-store");
  assert.equal(calls, 1);
});
