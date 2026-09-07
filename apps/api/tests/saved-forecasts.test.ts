import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import type { SavedForecast } from "@prisma/client";
import { registerSavedForecastRoutes, type SavedForecastDependencies } from "../src/saved-forecasts/routes";
import { savedForecastInputSchema } from "../src/saved-forecasts/schemas";
import { resolveForecastDateTime, toForecastDateTimeInput } from "../../web/src/lib/forecast-archive";

const natal = {
  birthDate: "1995-04-12", birthTime: "14:30:27", birthTimeKnown: true,
  timezone: "Europe/Kyiv", latitude: 50.4501, longitude: 30.5234,
  houseSystem: "koch", zodiac: "tropical", pointOrbs: { sun: 5, moon: 4 }
};
const context = {
  subject: { displayName: "Subject", birthplaceName: "Kyiv", countryCode: "UA" },
  visiblePointKeys: { sun: true, chiron: false }
};
const inputs = [
  { kind: "transit", parameters: { natal, transitDateTime: "2026-09-07T12:34:56.125Z", pointOrbs: { sun: 3 } }, context },
  { kind: "forecast", parameters: {
    natal, fromDateTime: "2026-09-07T12:34:56Z", targetYear: 2027, days: 30,
    returnLatitude: 0, returnLongitude: 0, pointOrbs: { sun: 3 }
  }, context },
  { kind: "synastry", parameters: { subjectA: natal, subjectB: { ...natal, birthTimeKnown: false }, pointOrbs: { moon: 2 } },
    context: { ...context, partner: { displayName: "Partner", birthplaceName: "Kyiv", countryCode: "UA" } } }
];

const createApp = async (t: TestContext, options: {
  store?: Partial<Record<keyof SavedForecastDependencies["store"], unknown>>;
  calculate?: SavedForecastDependencies["calculate"];
} = {}) => {
  const unexpected = () => assert.fail("Unexpected dependency call");
  const app = Fastify();
  await registerSavedForecastRoutes(app, {
    authenticate: async (request) => request.headers.authorization === "Bearer owner" ? { id: "owner" } : null,
    store: {
      findFirst: unexpected, findMany: unexpected, findUnique: unexpected, upsert: unexpected, deleteMany: unexpected,
      ...options.store
    } as SavedForecastDependencies["store"],
    calculate: options.calculate ?? unexpected
  });
  t.after(() => app.close());
  return app;
};
const headers = { authorization: "Bearer owner" };

test("every archive operation requires authentication before touching storage", async (t) => {
  const app = await createApp(t);
  for (const request of [
    { method: "GET" as const, url: "/saved-forecasts" },
    { method: "GET" as const, url: "/saved-forecasts/private" },
    { method: "DELETE" as const, url: "/saved-forecasts/private" },
    { method: "POST" as const, url: "/saved-forecasts", payload: {} }
  ]) {
    assert.equal((await app.inject(request)).statusCode, 401);
  }
});

test("reading or deleting another owner's forecast returns 404", async (t) => {
  const app = await createApp(t, { store: {
    findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "private", ownerUserId: "owner" });
      return null;
    },
    deleteMany: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "private", ownerUserId: "owner" });
      return { count: 0 };
    }
  } });
  assert.equal((await app.inject({ method: "GET", url: "/saved-forecasts/private", headers })).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: "/saved-forecasts/private", headers })).statusCode, 404);
});

for (const input of inputs) {
  test(`${input.kind}: save calculates once; retry and reopening preserve the snapshot`, async (t) => {
    let record: SavedForecast | null = null;
    let calculations = 0;
    // Deliberately minimal transport fixture; astronomical accuracy has separate core fixtures.
    const snapshot = { result: { chartType: input.kind, warnings: ["Fixture warning"] }, interpretation: { sections: [] } };
    const app = await createApp(t, {
      calculate: (parsed) => {
        calculations++;
        assert.deepEqual(parsed, savedForecastInputSchema.parse(input));
        return snapshot as unknown as ReturnType<SavedForecastDependencies["calculate"]>;
      },
      store: {
        findUnique: async (args: { where: { ownerUserId_requestId: { ownerUserId: string } } }) => {
          assert.equal(args.where.ownerUserId_requestId.ownerUserId, "owner");
          return record;
        },
        upsert: async (args: { create: Omit<SavedForecast, "id" | "createdAt" | "schemaVersion">; update: unknown }) => {
          assert.deepEqual(args.update, {});
          record = { ...args.create, id: "saved", schemaVersion: 1, createdAt: new Date("2026-09-07T14:00:00Z") };
          return record;
        },
        findFirst: async (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: "saved", ownerUserId: "owner" });
          return record;
        }
      }
    });
    const payload = { requestId: randomUUID(), title: "Consultation", notes: "Keep these notes", input, result: "Untrusted client result" };
    const saved = await app.inject({ method: "POST", url: "/saved-forecasts", headers, payload });
    assert.equal(saved.statusCode, 201);
    assert.deepEqual(saved.json().forecast.input, savedForecastInputSchema.parse(input));
    assert.deepEqual(saved.json().forecast.result, snapshot.result);
    assert.deepEqual(saved.json().forecast.interpretation, snapshot.interpretation);
    assert.equal(saved.json().forecast.notes, payload.notes);
    assert.equal("ownerUserId" in saved.json().forecast, false);
    assert.equal("inputHash" in saved.json().forecast, false);

    const retry = await app.inject({ method: "POST", url: "/saved-forecasts", headers, payload });
    assert.equal(retry.statusCode, 200);
    assert.deepEqual(retry.json(), saved.json());
    const reopened = await app.inject({ method: "GET", url: "/saved-forecasts/saved", headers });
    assert.deepEqual(reopened.json(), saved.json());
    assert.equal(calculations, 1);

    const conflict = await app.inject({ method: "POST", url: "/saved-forecasts", headers, payload: { ...payload, notes: "Different" } });
    assert.equal(conflict.statusCode, 409);
    assert.equal(calculations, 1);
  });
}

test("calculation failure leaves the archive unchanged", async (t) => {
  const app = await createApp(t, {
    store: { findUnique: async () => null },
    calculate: () => { throw new Error("Fixture calculation failure"); }
  });
  const response = await app.inject({ method: "POST", url: "/saved-forecasts", headers,
    payload: { requestId: randomUUID(), title: "Failed", input: inputs[0] } });
  assert.equal(response.statusCode, 422);
});

test("list scopes filters and cursor to the owner with stable ordering", async (t) => {
  const date = new Date("2026-09-07T14:00:00Z");
  const app = await createApp(t, { store: {
    findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "cursor", ownerUserId: "owner" });
      return { id: "cursor", createdAt: date };
    },
    findMany: async (args: { where: unknown; orderBy: unknown; take: number; select: Record<string, boolean> }) => {
      assert.deepEqual(args.where, {
        ownerUserId: "owner", kind: "forecast", AND: [
          { OR: [{ title: { contains: "solar", mode: "insensitive" } }, { notes: { contains: "solar", mode: "insensitive" } }] },
          { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: "cursor" } }] }
        ]
      });
      assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
      assert.equal(args.take, 3);
      assert.equal(args.select.resultJson, undefined);
      assert.equal(args.select.inputJson, undefined);
      return [{ id: "b" }, { id: "a" }, { id: "older" }];
    }
  } });
  const response = await app.inject({ method: "GET", url: "/saved-forecasts?limit=2&cursor=cursor&kind=forecast&query=solar", headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { forecasts: [{ id: "b" }, { id: "a" }], nextCursor: "a" });
});

test("invalid cursors and excessive page sizes do not query forecast bodies", async (t) => {
  const app = await createApp(t, { store: { findFirst: async () => null } });
  assert.equal((await app.inject({ method: "GET", url: "/saved-forecasts?cursor=missing", headers })).statusCode, 400);
  assert.equal((await app.inject({ method: "GET", url: "/saved-forecasts?limit=500", headers })).statusCode, 400);
});

test("archive requires an explicit solar year and a partner for synastry", () => {
  assert.equal(savedForecastInputSchema.safeParse({ kind: "forecast", parameters: { natal, fromDateTime: "2026-09-07T00:00:00Z" }, context }).success, false);
  assert.equal(savedForecastInputSchema.safeParse({ kind: "synastry", parameters: { subjectA: natal, subjectB: natal }, context }).success, false);
});

test("restoring dates preserves fractional seconds and the second occurrence of a DST hour", (t) => {
  const previousTimezone = process.env.TZ;
  t.after(() => { if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; });
  for (const timezone of ["Europe/Kyiv", "America/New_York", "Asia/Kolkata"]) {
    process.env.TZ = timezone;
    const original = "2024-11-03T06:30:27.125Z";
    const value = toForecastDateTimeInput(original);
    assert.equal(value.endsWith(":27.125"), true);
    assert.equal(resolveForecastDateTime(value, original).toISOString(), original);
    const changed = "2024-11-04T12:00:13.750";
    assert.equal(resolveForecastDateTime(changed, original).toISOString(), new Date(changed).toISOString());
  }
});
