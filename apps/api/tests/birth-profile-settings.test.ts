import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import type { ChartResult } from "@astroprocessor/astrology-core";
import { registerBirthProfileRoutes, type BirthProfileDependencies } from "../src/birth-profiles/routes";

const settings = {
  houseSystem: "koch", zodiac: "tropical", pointOrbs: { sun: 0, moon: 3.5, mars: 15 },
  visiblePointKeys: { sun: true, moon: true }
};
const headers = { authorization: "Bearer owner" };
const url = "/birth-profiles/chart-1/calculation";
const profile = {
  id: "chart-1", ownerUserId: "owner", birthDate: new Date("1995-04-12T00:00:00Z"),
  birthTime: "14:30:27", birthTimeKnown: true, timezone: "Europe/Kyiv",
  latitude: 50.45, longitude: 30.52
};
const chart = {
  settings, engine: { name: "fixture", version: "1" }, warnings: []
} as unknown as ChartResult;

const createApp = async (t: TestContext, database: unknown, calculate: BirthProfileDependencies["calculate"] = () => chart) => {
  const app = Fastify();
  await registerBirthProfileRoutes(app, {
    database: database as BirthProfileDependencies["database"],
    calculate,
    authenticate: async (request) => request.headers.authorization === "Bearer owner"
      ? { id: "owner", email: "owner@example.com", username: "owner", locale: "uk", role: "USER" }
      : null
  });
  t.after(() => app.close());
  return app;
};

test("calculation settings require authentication and valid orbs before database access", async (t) => {
  const app = await createApp(t, {});
  assert.equal((await app.inject({ method: "PUT", url, payload: settings })).statusCode, 401);
  for (const pointOrbs of [undefined, { sun: -1 }, { moon: 15.1 }, { sun: "5" }]) {
    const response = await app.inject({ method: "PUT", url, headers, payload: { ...settings, pointOrbs } });
    assert.equal(response.statusCode, 400);
  }
});

test("a shared or foreign chart cannot be updated", async (t) => {
  const app = await createApp(t, { birthProfile: {
    findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { id: "chart-1", ownerUserId: "owner" });
      return null;
    },
    update: () => assert.fail("Must not write a foreign chart")
  } });
  assert.equal((await app.inject({ method: "PUT", url, headers, payload: settings })).statusCode, 404);
});

test("settings append a persisted snapshot without changing profile identity or birth data", async (t) => {
  let saved: unknown;
  const app = await createApp(t, { birthProfile: {
    findFirst: async () => profile,
    update: async ({ where, data }: { where: unknown; data: { calculations: { create: Record<string, unknown> } } }) => {
      assert.deepEqual(where, { id: "chart-1", ownerUserId: "owner" });
      assert.deepEqual(Object.keys(data), ["calculations"]);
      assert.deepEqual(data.calculations.create.settingsJson, settings);
      saved = data.calculations.create.resultJson;
      return { id: profile.id };
    }
  } }, (input) => {
    assert.equal(input.birthDate, "1995-04-12");
    assert.equal(input.birthTime, "14:30:27");
    assert.deepEqual(input.pointOrbs, settings.pointOrbs);
    return chart;
  });
  const response = await app.inject({ method: "PUT", url, headers, payload: { ...settings, birthDate: "2000-01-01" } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), saved);
  assert.deepEqual(response.json().settings.pointOrbs, settings.pointOrbs);
});

test("calculation failure leaves the saved chart untouched", async (t) => {
  const app = await createApp(t, { birthProfile: {
    findFirst: async () => profile,
    update: () => assert.fail("Failed calculations must not be saved")
  } }, () => { throw new Error("Calculation failed"); });
  assert.equal((await app.inject({ method: "PUT", url, headers, payload: settings })).statusCode, 422);
});

test("database failure is not reported as successful settings application", async (t) => {
  const app = await createApp(t, { birthProfile: {
    findFirst: async () => profile,
    update: async () => { throw new Error("Database unavailable"); }
  } });
  assert.equal((await app.inject({ method: "PUT", url, headers, payload: settings })).statusCode, 500);
});
