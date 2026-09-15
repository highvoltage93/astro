import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { defaultCalculationRules } from "@astroprocessor/astrology-core";
import { Prisma } from "@prisma/client";
import { registerCalculationProfileRoutes, type CalculationProfileDependencies } from "../src/calculation-profiles/routes";
import { calculationProfileConfigSchema, updateCalculationProfileSchema } from "../src/calculation-profiles/schemas";
import { natalPreviewSchema } from "../src/charts/schemas";
import { savedForecastInputSchema } from "../src/saved-forecasts/schemas";
import { sameProfileConfig } from "../../web/src/lib/calculation-profiles";

const config = {
  calculationRules: defaultCalculationRules("modern"), houseSystem: "koch", zodiac: "tropical" as const,
  pointOrbs: { sun: 5, moon: 4 }, visiblePointKeys: { sun: true, moon: true, chiron: false }
};
const headers = { authorization: "Bearer owner" };
const unexpected = () => assert.fail("Unexpected database call");
const createApp = async (t: TestContext, database: unknown = {}) => {
  const app = Fastify();
  await registerCalculationProfileRoutes(app, {
    authenticate: async (request) => request.headers.authorization === "Bearer owner" ? { id: "owner" } : null,
    database: database as CalculationProfileDependencies["database"]
  });
  t.after(() => app.close());
  return app;
};

test("profile endpoints require authentication", async (t) => {
  const app = await createApp(t);
  for (const request of [
    { method: "GET" as const, url: "/calculation-profiles" },
    { method: "POST" as const, url: "/calculation-profiles", payload: { name: "Test", config } },
    { method: "PUT" as const, url: "/calculation-profiles/test", payload: { name: "Test", config, revision: 1 } },
    { method: "PUT" as const, url: "/calculation-profiles/default", payload: { id: "test" } },
    { method: "DELETE" as const, url: "/calculation-profiles/test" }
  ]) assert.equal((await app.inject(request)).statusCode, 401);
});

test("catalog reads only the current user's profiles", async (t) => {
  const app = await createApp(t, {
    calculationProfile: { findMany: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { ownerUserId: "owner" }); return [];
    } },
    user: { findUnique: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "owner" }); return { defaultCalculationProfileId: null };
    } }
  });
  const response = await app.inject({ method: "GET", url: "/calculation-profiles", headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(response.json().profiles.length, 3);
  assert.ok(response.json().profiles.every((profile: { builtIn: boolean }) => profile.builtIn));
});

test("creation binds ownership server-side and revisions are optimistic", async (t) => {
  const app = await createApp(t, { calculationProfile: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      assert.equal(data.ownerUserId, "owner");
      return { ...data, id: "test", revision: 1, schemaVersion: 1 };
    },
    update: async (args: { where: unknown; data: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { id: "test", ownerUserId: "owner", revision: 1 });
      assert.deepEqual(args.data.revision, { increment: 1 });
      throw new Prisma.PrismaClientKnownRequestError("Not found", { code: "P2025", clientVersion: "5.18.0" });
    }
  } });
  const saved = await app.inject({ method: "POST", url: "/calculation-profiles", headers, payload: { name: "My profile", config } });
  assert.equal(saved.statusCode, 201);
  assert.equal(saved.json().profile.revision, 1);
  assert.equal("ownerUserId" in saved.json().profile, false);
  const updated = await app.inject({ method: "PUT", url: "/calculation-profiles/test", headers, payload: { name: "New name", config, revision: 1 } });
  assert.equal(updated.statusCode, 409);
});

test("a foreign profile cannot become the user's default", async (t) => {
  const tx = {
    calculationProfile: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "foreign", ownerUserId: "owner" }); return null;
    } },
    user: { update: unexpected }
  };
  const app = await createApp(t, { $transaction: async (action: (transaction: typeof tx) => Promise<unknown>) => action(tx) });
  const response = await app.inject({ method: "PUT", url: "/calculation-profiles/default", headers, payload: { id: "foreign" } });
  assert.equal(response.statusCode, 404);
});

test("the default route sets and clears an owned profile", async (t) => {
  const updates: unknown[] = [];
  const tx = {
    calculationProfile: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "test", ownerUserId: "owner" }); return { id: "test" };
    } },
    user: { update: async (args: unknown) => { updates.push(args); return {}; } }
  };
  const app = await createApp(t, { $transaction: async (action: (transaction: typeof tx) => Promise<unknown>) => action(tx) });
  for (const id of ["test", null]) {
    const response = await app.inject({ method: "PUT", url: "/calculation-profiles/default", headers, payload: { id } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { defaultProfileId: id });
  }
  assert.deepEqual(updates, [
    { where: { id: "owner" }, data: { defaultCalculationProfileId: "test" } },
    { where: { id: "owner" }, data: { defaultCalculationProfileId: null } }
  ]);
});

test("deletion is scoped to the owner without deleting natal charts or forecasts", async (t) => {
  const app = await createApp(t, { calculationProfile: { deleteMany: async (args: { where: unknown }) => {
    assert.deepEqual(args.where, { id: "test", ownerUserId: "owner" }); return { count: 1 };
  } } });
  const response = await app.inject({ method: "DELETE", url: "/calculation-profiles/test", headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { deletedProfileId: "test" });
});

test("unsupported rules, invalid ranges and missing revisions are rejected", () => {
  assert.equal(calculationProfileConfigSchema.safeParse(config).success, true);
  for (const calculationRules of [
    { ...config.calculationRules, version: 2 },
    { ...config.calculationRules, rulershipModel: "unknown" },
    { ...config.calculationRules, containedSignMinDegrees: -0.1 },
    { ...config.calculationRules, tenseHouses: [0, 13] }
  ]) assert.equal(calculationProfileConfigSchema.safeParse({ ...config, calculationRules }).success, false);
  assert.equal(updateCalculationProfileSchema.safeParse({ name: "No revision", config }).success, false);
});

test("natal and archived forecast contracts retain the complete rule snapshot", () => {
  const natal = {
    birthDate: "1995-04-12", birthTime: "14:30:27", birthTimeKnown: true, timezone: "Europe/Kyiv",
    latitude: 50.4501, longitude: 30.5234, ...config,
    calculationProfile: { id: "test", name: "Snapshot", revision: 4 }
  };
  const parsed = natalPreviewSchema.parse(natal);
  assert.deepEqual(parsed.calculationRules, config.calculationRules);
  assert.deepEqual(parsed.calculationProfile, natal.calculationProfile);
  assert.deepEqual(parsed.visiblePointKeys, config.visiblePointKeys);
  const archive = savedForecastInputSchema.parse({
    kind: "transit", parameters: { natal, transitDateTime: "2026-09-14T00:00:00Z" },
    context: { subject: { displayName: "Test", birthplaceName: "Kyiv", countryCode: "UA" }, visiblePointKeys: config.visiblePointKeys }
  });
  assert.equal(archive.kind, "transit");
  if (archive.kind === "transit") assert.deepEqual(archive.parameters.natal.calculationRules, config.calculationRules);
  assert.equal(sameProfileConfig(config, { ...config, pointOrbs: { moon: 4, sun: 5 } }), true);
  assert.equal(sameProfileConfig(config, { ...config, pointOrbs: { sun: 6, moon: 4 } }), false);
});
