import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSecondaryProgression } from "../../../packages/astrology-core/src/swiss-ephemeris";

test("Chernihiv slow progression uses a 365-day key and uniform MC", () => {
  const result = calculateSecondaryProgression({
    natal: { birthDate: "1997-06-20", birthTime: "12:00:18", timezone: "UTC+3",
      latitude: 51.4982, longitude: 31.2893, houseSystem: "koch" },
    targetDateTime: "2026-10-27T00:00:00Z", includeCalendar: false
  });
  assert.equal(Date.parse(result.natal.subject.utcDateTime), Date.parse("1997-06-20T09:00:18Z"));
  assert.equal(result.yearLengthDays, 365);
  assert.equal(result.houseMethod, "uniform-mc-365");
  const birth = Date.parse(result.natal.subject.utcDateTime);
  const target = Date.parse(result.targetDateTime);
  const expected = birth + (target - birth) / 365;
  assert.ok(Math.abs(Date.parse(result.progressedDateTime) - expected) < 2);
  const mc = result.natal.houses.find((house) => house.house === 10)!;
  const progressedMc = result.progressed.houses.find((house) => house.house === 10)!;
  const arc = (target - birth) / 86400000 / 365;
  const error = ((progressedMc.longitude - mc.longitude - arc + 540) % 360) - 180;
  assert.ok(Math.abs(error) < 0.001);
  assert.equal(result.progressed.houses.length, 12);
});
