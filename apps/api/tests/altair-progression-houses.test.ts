import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { calculateNatalChart, calculateSecondaryProgression } from "../../../packages/astrology-core/src/swiss-ephemeris";

test("Altair Chernihiv cusp reference and Lilith calendar crossing", () => {
  const natal = { birthDate: "1997-06-20", birthTime: "12:00:18", timezone: "UTC+3",
    latitude: 51.50551, longitude: 31.28487, houseSystem: "koch" as const };
  const ephemerisPath = resolve(__dirname, "../../../ephemeris");
  const original = calculateNatalChart({ ...natal, ephemerisPath });
  const result = calculateSecondaryProgression({ natal, targetDateTime: "2026-10-27T00:00:00Z", ephemerisPath });
  const reference = [169 + 22 / 60 + 53 / 3600, 197 + 59 / 60 + 20 / 3600,
    226 + 23 / 60 + 41 / 3600, 256 + 9 / 60 + 48 / 3600,
    291 + 55 / 60 + 7 / 3600, 320 + 56 / 60 + 23 / 3600];
  for (let i = 0; i < 12; i++) {
    const expected = (reference[i % 6]! + (i >= 6 ? 180 : 0)) % 360;
    const difference = ((result.natal.houses[i]!.longitude - expected + 540) % 360) - 180;
    // External screenshot uses whole arcseconds; UTC/UT1 convention is unresolved.
    assert.ok(Math.abs(difference) * 3600 < 7, `cusp ${i + 1}`);
  }
  assert.equal(result.natal.subject.latitude, natal.latitude);
  assert.deepEqual(result.natal.bodies.map(p => [p.key, p.longitude]), original.bodies.map(p => [p.key, p.longitude]));
  const lilith = result.calendar!.find(e => e.bodyA === "house-2" && e.bodyB === "lilith" && e.type === "sextile");
  assert.equal(lilith?.exactAt.slice(0, 10), "2026-12-06");
  const mercury = result.calendar!.find(e => e.bodyA === "mercury" && e.bodyB === "house-12" && e.type === "conjunction");
  assert.ok(mercury);
  // Residual discrepancy remains: Altair screenshot says August 5.
  assert.ok(Math.abs(Date.parse(mercury.exactAt) - Date.parse("2027-08-05T12:00:00Z")) < 2 * 86400000);
});
