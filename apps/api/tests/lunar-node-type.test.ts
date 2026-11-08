import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { calculateNatalChart, calculateSecondaryProgression, calculateTransitChart } from "../../../packages/astrology-core/src/swiss-ephemeris";
import { defaultCalculationRules, resolveCalculationRules } from "../../../packages/astrology-core/src/calculation-rules";
import { calculationRulesSchema } from "../src/calculation-profiles/schemas";
import { natalPreviewSchema } from "../src/charts/schemas";
import { sameProfileConfig } from "../../web/src/lib/calculation-profiles";

const natal = {
  birthDate: "1990-02-14", birthTime: "04:32:57", timezone: "UTC+3",
  latitude: 50.4501, longitude: 30.5234, houseSystem: "koch" as const,
  ephemerisPath: process.env.SWISSEPH_EPHE_PATH ?? resolve(process.cwd(), "../../ephemeris")
};

test("lunar node input is explicit, validated and backward compatible", () => {
  const { lunarNodeType: _type, ...legacy } = defaultCalculationRules();
  assert.equal(resolveCalculationRules(legacy).lunarNodeType, "true");
  assert.equal(calculationRulesSchema.safeParse({ ...legacy, lunarNodeType: "unknown" }).success, false);
  for (const lunarNodeType of ["true", "mean"] as const) {
    const parsed = natalPreviewSchema.parse({ ...natal, calculationRules: { ...legacy, lunarNodeType } });
    assert.equal(parsed.calculationRules?.lunarNodeType, lunarNodeType);
  }
  const config = { calculationRules: legacy, houseSystem: "koch", zodiac: "tropical" as const, pointOrbs: {}, visiblePointKeys: {} };
  assert.ok(sameProfileConfig(config, { ...config, calculationRules: { ...legacy, lunarNodeType: "true" } }));
  assert.ok(!sameProfileConfig(config, { ...config, calculationRules: { ...legacy, lunarNodeType: "mean" } }));
});

test("Kyiv 1990 node positions match reported values without changing planets or houses", () => {
  const legacy = calculateNatalChart(natal);
  for (const [lunarNodeType, seconds] of [["true", 16 * 3600 + 26 * 60 + 41], ["mean", 16 * 3600 + 7 * 60 + 42]] as const) {
    const chart = calculateNatalChart({ ...natal, calculationRules: { ...defaultCalculationRules(), lunarNodeType } });
    const north = chart.bodies.find((point) => point.key === "north-node")!;
    const south = chart.bodies.find((point) => point.key === "south-node")!;
    assert.equal(north.sign, "aquarius");
    assert.ok(Math.abs((north.longitude - 300) * 3600 - seconds) < 1);
    assert.ok(Math.abs(((south.longitude - north.longitude + 360) % 360) - 180) < 0.0002);
    assert.deepEqual(chart.houses, legacy.houses);
    assert.deepEqual(chart.bodies.filter((point) => point.kind !== "node"), legacy.bodies.filter((point) => point.kind !== "node"));
    if (lunarNodeType === "true") assert.deepEqual(chart.bodies, legacy.bodies);
    assert.equal(chart.settings.calculationRules?.lunarNodeType, lunarNodeType);
  }
});

test("progressions inherit the same node definition at natal and progressed epochs", () => {
  for (const lunarNodeType of ["true", "mean"] as const) {
    const calculationRules = { ...defaultCalculationRules(), lunarNodeType };
    const result = calculateSecondaryProgression({
      natal: { ...natal, calculationRules }, targetDateTime: "2026-11-07T00:00:00Z",
      includeCalendar: false, ephemerisPath: natal.ephemerisPath
    });
    const direct = calculateTransitChart({ transitDateTime: result.progressedDateTime,
      latitude: natal.latitude, longitude: natal.longitude, calculationRules, ephemerisPath: natal.ephemerisPath });
    assert.equal(result.natal.settings.calculationRules?.lunarNodeType, lunarNodeType);
    assert.equal(result.progressed.settings.calculationRules?.lunarNodeType, lunarNodeType);
    assert.equal(result.progressed.bodies.find((point) => point.key === "north-node")?.longitude,
      direct.bodies.find((point) => point.key === "north-node")?.longitude);
  }
});
