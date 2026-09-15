import assert from "node:assert/strict";
import {
  calculateForecastPreview, calculateNatalChart, calculateSynastryPreview, calculateTransitPreview,
  defaultCalculationRules, resolveCalculationRules, rulershipTables
} from "../dist/index.js";

const input = {
  birthDate: "1995-04-12", birthTime: "14:30:27", birthTimeKnown: true,
  timezone: "Europe/Kyiv", latitude: 50.4501, longitude: 30.5234, houseSystem: "koch", zodiac: "tropical",
  ephemerisPath: process.env.SWISSEPH_EPHE_PATH
};
const legacy = defaultCalculationRules();
const traditional = defaultCalculationRules("traditional");
const modern = defaultCalculationRules("modern");

assert.deepEqual(rulershipTables(legacy).direct.mars, ["scorpio"]);
assert.deepEqual(rulershipTables(legacy).retrograde.mars, ["scorpio", "aries"]);
assert.deepEqual(rulershipTables(legacy).direct.pluto, ["aries"]);
assert.deepEqual(rulershipTables(traditional).direct.mars, ["aries", "scorpio"]);
assert.deepEqual(rulershipTables(traditional).retrograde.mars, ["aries", "scorpio"]);
assert.deepEqual(rulershipTables(modern).direct.pluto, ["scorpio"]);
assert.deepEqual(rulershipTables(modern).retrograde.pluto, ["scorpio"]);
assert.equal(rulershipTables(traditional).direct.uranus, undefined);
assert.equal(rulershipTables(modern).direct.lilith, undefined);
assert.equal(rulershipTables(legacy).direct.lilith, undefined);
assert.throws(() => resolveCalculationRules({ ...legacy, version: 2 }));
assert.throws(() => resolveCalculationRules({ ...legacy, containedSignMinDegrees: -1 }));
assert.throws(() => resolveCalculationRules({ ...legacy, tenseHouses: [13] }));
assert.deepEqual(resolveCalculationRules({ ...legacy, tenseHouses: [12, 6, 6, 8] }).tenseHouses, [6, 8, 12]);

const mutableTables = rulershipTables(legacy);
mutableTables.direct.mars.push("leo");
assert.deepEqual(rulershipTables(legacy).direct.mars, ["scorpio"]);

// This is compatibility coverage, not an independent astronomical reference.
// The existing accuracy:verify and accuracy:audit fixtures remain authoritative for their respective checks.
const original = calculateNatalChart(input);
const explicit = calculateNatalChart({ ...input, calculationRules: legacy });
assert.deepEqual(explicit, original, "Omitted rules must resolve to the exact legacy behavior");
assert.ok(explicit.houseRulers.some((ruler) => ruler.rulerKey === "lilith" && ruler.house === 8));
assert.ok(explicit.houseConnections.every((connection) => connection.details.every((detail) => detail.planetA !== "chiron" && detail.planetB !== "chiron")));

const physicalFields = ({ bodies, houses, angles, aspects, syntheticSignature, aspectConfigurations }) =>
  ({ bodies, houses, angles, aspects, syntheticSignature, aspectConfigurations });

for (const rules of [traditional, modern]) {
  const chart = calculateNatalChart({ ...input, calculationRules: rules });
  assert.deepEqual(physicalFields(chart), physicalFields(original), "Rulership presets must not move planets or cusps");
  assert.ok(chart.houseRulers.every((ruler) => ruler.rulerSource === "cusp" && ruler.rulerKey !== "lilith"));
  assert.ok(chart.houseConnections.every((connection) => connection.details.every((detail) =>
    detail.source === "aspect" && detail.aspectType !== "conjunction" || detail.tone === "harmonious")));
  const expectedAriesRuler = chart.signRulerships.aries.filter((ruler) => ruler.rulerType === "direct").map((ruler) => ruler.key);
  assert.deepEqual(expectedAriesRuler, ["mars"]);
  for (const dignity of chart.essentialDignities) {
    const keys = chart.signRulerships[dignity.sign].map((ruler) => ruler.key);
    assert.ok(keys.includes(dignity.dispositorKey), "Dispositors must use the selected rulership model");
  }
}

const custom = calculateNatalChart({ ...input, calculationRules: { ...legacy, containedSignMinDegrees: 30, lilithRulesEighthHouse: false, tenseHouses: [] } });
assert.ok(custom.houseRulers.every((ruler) => ruler.rulerSource === "cusp"));
const unknown = calculateNatalChart({ ...input, birthTimeKnown: false, calculationRules: modern });
assert.deepEqual(unknown.houses, []);
assert.deepEqual(unknown.houseRulers, []);
assert.deepEqual(unknown.houseConnections, []);

const reference = { id: "fixture-profile", name: "Fixture profile", revision: 3 };
const snapshotRules = defaultCalculationRules("modern");
const snapshotted = calculateNatalChart({ ...input, calculationRules: snapshotRules, calculationProfile: reference });
snapshotRules.tenseHouses.push(8);
reference.name = "Changed later";
assert.deepEqual(snapshotted.settings.calculationRules, modern);
assert.equal(snapshotted.settings.calculationProfile.name, "Fixture profile");

const natal = { ...input, calculationRules: modern, calculationProfile: { ...reference, name: "Forecast profile" }, visiblePointKeys: { chiron: false } };
const assertProfile = (chart) => {
  assert.deepEqual(chart.settings.calculationRules, modern);
  assert.deepEqual(chart.settings.calculationProfile, natal.calculationProfile);
  assert.deepEqual(chart.settings.visiblePointKeys, natal.visiblePointKeys);
  assert.deepEqual(chart.signRulerships.scorpio.filter((ruler) => ruler.rulerType === "direct").map((ruler) => ruler.key), ["pluto"]);
};

const transit = calculateTransitPreview({ natal, transitDateTime: "2026-09-14T12:34:56Z", ephemerisPath: input.ephemerisPath });
assertProfile(transit.natal);
assertProfile(transit.transit);
const synastry = calculateSynastryPreview({ subjectA: natal, subjectB: { ...natal, birthTime: "10:05:09" }, ephemerisPath: input.ephemerisPath });
assertProfile(synastry.subjectA);
assertProfile(synastry.subjectB);
const forecast = calculateForecastPreview({
  natal, fromDateTime: "2026-09-14T00:00:00Z", targetYear: 2026, days: 1,
  returnLatitude: 0, returnLongitude: 0, ephemerisPath: input.ephemerisPath
});
assertProfile(forecast.natal);
assert.ok(forecast.solarReturn, "Expected a solar return fixture");
assert.ok(forecast.lunarReturn, "Expected a lunar return fixture");
assertProfile(forecast.solarReturn.chart);
assertProfile(forecast.lunarReturn.chart);
assertProfile(forecast.secondaryProgression.progressed);
assertProfile(forecast.solarArcDirections.directed);
assert.deepEqual(calculateNatalChart(input), original, "A later call must not inherit another user's rules");
console.log("Calculation profile compatibility and inheritance scenarios passed.");
