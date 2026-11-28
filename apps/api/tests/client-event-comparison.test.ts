import assert from "node:assert/strict";
import test from "node:test";
import { compareEventDates, savedForecastExacts, type ComparisonRow } from "../../web/src/lib/client-event-comparison";
import type { SavedForecast } from "../../web/src/lib/forecast-archive";

const row = (exactAt: string): ComparisonRow => ({ source: "transit", exactAt, title: "Test" });
test("comparison uses the selected local calendar date without shifting the life event", () => {
  const rows = [row("2026-11-28T22:30:00Z")];
  assert.equal(compareEventDates(rows, "2026-11-29", 0, "Europe/Kyiv").length, 1);
  assert.equal(compareEventDates(rows, "2026-11-29", 0, "UTC").length, 0);
  assert.equal(compareEventDates(rows, "2026-11-28", 7, "Europe/Kyiv")[0]?.offset, 1);
});
test("date windows include both boundaries and use calendar days across DST", () => {
  const rows = [row("2026-03-28T12:00:00Z"), row("2026-03-29T12:00:00Z"), row("2026-04-04T12:00:00Z"), row("2026-04-05T12:00:00Z")];
  assert.deepEqual(compareEventDates(rows, "2026-03-28", 7, "Europe/Kyiv").map((value) => value.offset), [0, 1, 7]);
  assert.equal(compareEventDates(rows, "invalid", 7, "UTC").length, 0);
  assert.equal(compareEventDates(rows, "2026-03-28", 3, "UTC").length, 0);
});
test("saved exacts are deduplicated and missing exact dates are not fabricated", () => {
  const aspect = { exactAt: "2026-11-28T10:00:00Z", bodyA: "jupiter", bodyB: "sun", type: "trine" };
  const forecast = { schemaVersion: 1, kind: "forecast", result: {
    chartType: "forecast", timelineEvents: [{ ...aspect, source: "transit", aspectType: "trine" }],
    exactTransits: [aspect, { ...aspect, exactAt: null }], secondaryProgression: null, solarReturn: null, lunarReturn: null
  } } as unknown as SavedForecast;
  const before = JSON.stringify(forecast);
  assert.equal(savedForecastExacts(forecast).length, 1);
  assert.equal(JSON.stringify(forecast), before);
  assert.throws(() => savedForecastExacts({ ...forecast, schemaVersion: 2 }));
});
