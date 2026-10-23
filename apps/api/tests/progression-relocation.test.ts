import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import { calculateSecondaryProgression } from "../../../packages/astrology-core/src/swiss-ephemeris";
import { progressionCalendarWindow } from "../../../packages/astrology-core/src/progression-calendar-window";
import { forecastPreviewSchema } from "../src/charts/schemas";

const natal = { birthDate: "1990-01-01", birthTime: "12:34:56", timezone: "Europe/Kyiv",
  latitude: 50.4501, longitude: 30.5234, houseSystem: "placidus" as const };
const location = { name: "New York", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };

test("relocation keeps birth instant and planetary longitudes but changes houses", () => {
  const result = calculateSecondaryProgression({ natal, targetDateTime: "2026-10-21T12:00:00Z", progressionLocation: location });
  assert.ok(result.birthNatal);
  assert.equal(result.natal.subject.utcDateTime, result.birthNatal.subject.utcDateTime);
  assert.equal(result.natal.subject.latitude, location.latitude);
  for (const body of result.natal.bodies) {
    assert.equal(body.longitude, result.birthNatal.bodies.find((original) => original.key === body.key)?.longitude);
  }
  assert.notEqual(result.natal.houses[0]?.longitude, result.birthNatal.houses[0]?.longitude);
  assert.equal(result.calendarTimezone, location.timezone);
  const planetEvents = result.calendar?.filter((event) => !event.bodyA.startsWith("house-")) ?? [];
  assert.ok(planetEvents.length > 0);
  assert.ok(planetEvents.every((event) => event.formulaA && !event.formulaA.includes("/")));
});

test("calendar starts on today's local date, not server or Kyiv date", () => {
  const window = progressionCalendarWindow(DateTime.fromISO("2026-10-21T01:00:00Z"), location.timezone);
  assert.equal(window.start.setZone(location.timezone).toISODate(), "2026-10-20");
  assert.equal(window.end.setZone(location.timezone).toISODate(), "2027-10-20");
});

test("forecast validates and preserves the saved relocation settings", () => {
  const input = { natal, fromDateTime: "2026-10-21T12:00:00Z", progressionLocation: location };
  assert.deepEqual(forecastPreviewSchema.parse(input).progressionLocation, location);
  assert.equal(forecastPreviewSchema.safeParse({ ...input, progressionLocation: { ...location, timezone: "invalid/zone" } }).success, false);
});
