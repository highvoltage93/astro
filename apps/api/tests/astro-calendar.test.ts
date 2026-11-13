import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { buildAstroCalendar, type AstroCalendarInput, type CalendarEphemeris } from "../../../packages/astrology-core/src/astro-calendar";
import { astroCalendarSchema, registerAstroEventRoutes } from "../src/astro-events/routes";

const DAY = 86400000;
const base = Date.parse("2000-06-01T00:00:00Z");
const at = (days: number) => new Date(base + days * DAY).toISOString();
const normalize = (value: number) => (value % 360 + 360) % 360;
const input: AstroCalendarInput = { from: at(0), until: at(30), category: "moon-phases", latitude: 50.45, longitude: 30.52, lunarDayMethod: "moonrise" };
const engine: CalendarEphemeris = {
  position: (time, key) => ({ longitude: key === "moon" ? normalize(12 * (time - base) / DAY) : 0, speed: key === "moon" ? 12 : 0 }),
  moonriseAfter: (time) => base + (Math.floor((time - base) / DAY - 0.25) + 1.25) * DAY,
  eclipses: () => [], warnings: []
};

test("four phase roots are ordered and the end of a period is exclusive", () => {
  const result = buildAstroCalendar(input, engine);
  assert.deepEqual(result.rows.map((row) => row.kind), ["new-moon", "first-quarter", "full-moon", "last-quarter"]);
  result.rows.forEach((row, index) => assert.ok(Math.abs(Date.parse(row.start) - (base + index * 7.5 * DAY)) <= 1000));
});

test("lunar day one starts at new moon and day two at the first subsequent rise", () => {
  const result = buildAstroCalendar({ ...input, category: "lunar-days", until: at(2) }, engine);
  assert.equal(result.rows[0]!.day, 1);
  assert.ok(Math.abs(Date.parse(result.rows[0]!.start) - base) <= 1000);
  assert.equal(result.rows[0]!.end, at(0.25));
  assert.equal(result.rows[1]!.day, 2);
  assert.equal(result.rows[1]!.start, at(0.25));
  assert.equal(result.rows[1]!.end, at(1.25));
  const partial = buildAstroCalendar({ ...input, category: "lunar-days", from: at(0.5), until: at(1) }, engine);
  assert.equal(partial.rows.length, 1);
  assert.equal(partial.rows[0]!.day, 2);
});

test("a missing moonrise does not fabricate daily boundaries", () => {
  const result = buildAstroCalendar({ ...input, category: "lunar-days", until: at(2) }, { ...engine, moonriseAfter: () => null });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.day, 1);
  assert.ok(Math.abs(Date.parse(result.rows[0]!.end!) - (base + 30 * DAY)) <= 1000);
});

test("retrograde period carries a clipped start and an exact direct station", () => {
  const result = buildAstroCalendar({ ...input, category: "retrograde", planet: "mercury", until: at(4) }, {
    ...engine, position: (time) => {
      const days = (time - base) / DAY;
      return { longitude: 40 + (days - 2) ** 2 / 2, speed: days - 2 };
    }
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.clippedStart, true);
  assert.equal(result.rows[0]!.clippedEnd, false);
  assert.ok(Math.abs(Date.parse(result.rows[0]!.end!) - (base + 2 * DAY)) <= 1000);
});

test("retrograde covering a whole month is not omitted when there are no stations", () => {
  const result = buildAstroCalendar({ ...input, category: "retrograde", planet: "saturn" }, { ...engine, position: () => ({ longitude: 250, speed: -0.01 }) });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.clippedStart, true);
  assert.equal(result.rows[0]!.clippedEnd, true);
  assert.equal(result.rows[0]!.end, input.until);
});

test("ingresses capture retrograde and direct entries around a station", () => {
  const result = buildAstroCalendar({ ...input, category: "ingress", planet: "mercury", from: at(-1), until: at(3) }, {
    ...engine, position: (time) => { const days = (time - base) / DAY; return { longitude: 29 + (days - 1) ** 2, speed: 2 * (days - 1) }; }
  });
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.motion), ["retrograde", "direct"]);
  assert.deepEqual(result.rows.map((row) => row.toSign), ["aries", "taurus"]);
});

test("void Moon starts at the last exact major aspect and ends at the next sign", () => {
  const result = buildAstroCalendar({ ...input, category: "void-moon", from: at(1.8), until: at(2.4) }, {
    ...engine, position: (time, key) => ({ longitude: key === "moon" ? normalize(12 * (time - base) / DAY) : 20, speed: key === "moon" ? 12 : 0 })
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.aspectAngle, 0);
  assert.ok(Math.abs(Date.parse(result.rows[0]!.start) - (base + DAY * 20 / 12)) <= 1000);
  assert.ok(Math.abs(Date.parse(result.rows[0]!.end!) - (base + 2.5 * DAY)) <= 1000);
});

test("eclipse corridor preserves events outside the visible range when it overlaps", () => {
  const result = buildAstroCalendar({ ...input, category: "eclipses", from: at(0), until: at(5) }, {
    ...engine, eclipses: () => [{ time: base - 7 * DAY, kind: "solar-eclipse", type: "total" }, { time: base + 7 * DAY, kind: "lunar-eclipse", type: "partial" }]
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.eclipses!.length, 2);
  assert.equal(result.rows[0]!.start, at(-7));
  assert.equal(result.rows[0]!.end, at(7));
});

test("API rejects unlimited periods, unknown planets and private profile payloads", () => {
  assert.equal(astroCalendarSchema.safeParse(input).success, true);
  assert.equal(astroCalendarSchema.safeParse({ ...input, until: at(33) }).success, false);
  assert.equal(astroCalendarSchema.safeParse({ ...input, planet: "chiron" }).success, false);
  assert.equal(astroCalendarSchema.safeParse({ ...input, natal: {} }).success, false);
  assert.equal(astroCalendarSchema.safeParse({ ...input, ephemerisPath: "/tmp" }).success, false);
  assert.equal(astroCalendarSchema.safeParse({ ...input, latitude: 91 }).success, false);
});

test("astro calendar requires authentication and sends only validated input to its worker", async (t: TestContext) => {
  let called = 0;
  const app = Fastify(); t.after(() => app.close());
  await registerAstroEventRoutes(app, {
    authenticate: async (request) => request.headers.authorization === "Bearer test" ? { id: "owner" } : null,
    calculate: async (value) => { called++; assert.equal(value.category, input.category); return buildAstroCalendar(value, engine); }
  });
  assert.equal((await app.inject({ method: "POST", url: "/astro-events", payload: input })).statusCode, 401);
  assert.equal(called, 0);
  const response = await app.inject({ method: "POST", url: "/astro-events", headers: { authorization: "Bearer test" }, payload: input });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(called, 1);
});
