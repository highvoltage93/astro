import assert from "node:assert/strict";
import { test } from "node:test";
import { solarArcMcHouses } from "../../../packages/astrology-core/src/solar-arc-mc";

const delta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const input = { natalMc: 120, natalSun: 280, progressedSun: 280,
  obliquity: 23.44, latitude: 50.45, houseSystem: "P" as const };

test("MC follows the actual Sun arc rather than Earth's daily rotation", () => {
  const first = solarArcMcHouses(input);
  const next = solarArcMcHouses({ ...input, progressedSun: 280.9856 });
  assert.ok(Math.abs(delta(first.mc, next.mc) - 0.9856) < 1e-8);
  assert.ok(Math.abs(delta(first.asc, next.asc) - 0.9856) > 1e-3);
  next.houses.forEach((longitude, index) => assert.ok(Math.abs(delta(first.houses[index]!, longitude)) < 5));
});

test("zero arc preserves MC and opposite house axes for Koch and Placidus", () => {
  for (const houseSystem of ["K", "P"] as const) {
    const result = solarArcMcHouses({ ...input, houseSystem });
    assert.ok(Math.abs(delta(input.natalMc, result.mc)) < 1e-8);
    assert.ok(Math.abs(delta(input.natalMc, result.houses[9]!)) < 1e-8);
    for (let index = 0; index < 6; index += 1) {
      assert.ok(Math.abs(Math.abs(delta(result.houses[index]!, result.houses[index + 6]!)) - 180) < 1e-8);
    }
  }
});

test("Sun arc and MC preserve quadrants at the zodiac boundary", () => {
  const result = solarArcMcHouses({ ...input, natalMc: 359.5, natalSun: 359.5, progressedSun: 0.5 });
  assert.ok(Math.abs(delta(0.5, result.mc)) < 1e-8);
});

test("sidereal coordinate offset is restored after ARMC calculation", () => {
  const result = solarArcMcHouses({ ...input, zodiacOffset: 24, progressedSun: 281 });
  assert.ok(Math.abs(delta(121, result.mc)) < 1e-8);
});
