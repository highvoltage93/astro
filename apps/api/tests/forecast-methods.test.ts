import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateForecastPreview } from "../../../packages/astrology-core/src/swiss-ephemeris";
import { forecastPreviewSchema } from "../src/charts/schemas";

const input = {
  natal: { birthDate: "1990-01-01", birthTime: "12:34:56", timezone: "Europe/Kyiv",
    latitude: 50.4501, longitude: 30.5234, houseSystem: "placidus" as const },
  fromDateTime: "2026-10-21T12:00:00Z", targetYear: 2026
};

test("solar return excludes unrelated forecast results", () => {
  const result = calculateForecastPreview({ ...input, method: "solar-return" });
  assert.ok(result.solarReturn);
  assert.equal(result.lunarReturn, null);
  assert.equal(result.secondaryProgression, null);
  assert.equal(result.solarArcDirections, null);
  assert.deepEqual(result.exactTransits, []);
});

test("separate progression calendar preserves chart and active aspects", () => {
  const preview = calculateForecastPreview({ ...input, method: "progression" });
  assert.ok(preview.secondaryProgression);
  assert.equal(preview.secondaryProgression.calendar, undefined);
  assert.equal(preview.solarReturn, null);
  assert.equal(preview.lunarReturn, null);
  assert.equal(preview.solarArcDirections, null);
  assert.deepEqual(preview.exactTransits, []);
  const full = calculateForecastPreview({ ...input, method: "progression", includeProgressionCalendar: true });
  assert.ok(full.secondaryProgression);
  assert.ok(Array.isArray(full.secondaryProgression.calendar));
  assert.deepEqual(full.secondaryProgression.progressedReferencePoints, preview.secondaryProgression.progressedReferencePoints);
  assert.deepEqual(full.secondaryProgression.progressedToNatalAspects, preview.secondaryProgression.progressedToNatalAspects);
  assert.equal(full.secondaryProgression.calendarFrom, preview.secondaryProgression.calendarFrom);
  assert.equal(full.secondaryProgression.calendarUntil, preview.secondaryProgression.calendarUntil);
});

test("forecast schema preserves method and calendar flag", () => {
  const parsed = forecastPreviewSchema.parse({ ...input, method: "progression", includeProgressionCalendar: false });
  assert.equal(parsed.method, "progression");
  assert.equal(parsed.includeProgressionCalendar, false);
  assert.equal(forecastPreviewSchema.safeParse({ ...input, method: "unknown" }).success, false);
  assert.equal(forecastPreviewSchema.parse(input).method, undefined);
});
