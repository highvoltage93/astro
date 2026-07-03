import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { calculateNatalChart, calculateTransitPreview, generateNatalInterpretationPreview } = require("../dist");

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../fixtures/smoke-charts/kyiv-natal.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ephemerisPath = process.env.SWISSEPH_EPHE_PATH
  ? resolve(process.env.SWISSEPH_EPHE_PATH)
  : undefined;

const chart = calculateNatalChart({
  ...fixture.input,
  ephemerisPath
});

const pointKeys = new Set([...chart.angles, ...chart.bodies].map((point) => point.key));

assert.equal(chart.chartType, fixture.expect.chartType);
assert.equal(chart.engine.status, "swiss-ephemeris");
assert.equal(chart.settings.houseSystem, fixture.input.houseSystem);

for (const key of fixture.expect.requiredPointKeys) {
  assert.ok(pointKeys.has(key), `Expected chart point ${key}`);
}

for (const point of [...chart.angles, ...chart.bodies]) {
  assert.ok(Number.isFinite(point.longitude), `${point.key} longitude should be finite`);
  assert.ok(point.longitude >= 0 && point.longitude < 360, `${point.key} longitude should be normalized`);
}

const hasFallbackWarnings = chart.warnings.some(
  (warning) => warning.code === "EPHEMERIS_FALLBACK" || warning.code === "BODY_UNAVAILABLE"
);
const minBodies = hasFallbackWarnings
  ? fixture.expect.minBodiesWithoutEphemerisFiles
  : fixture.expect.minBodiesWithEphemerisFiles;

assert.ok(chart.bodies.length >= minBodies, `Expected at least ${minBodies} bodies, got ${chart.bodies.length}`);

const interpretation = generateNatalInterpretationPreview(chart);

assert.ok(interpretation.summary.length > 0, "Expected interpretation summary");
assert.ok(interpretation.highlights.length >= 3, "Expected at least 3 interpretation highlights");

const unknownTimeChart = calculateNatalChart({
  ...fixture.input,
  birthTimeKnown: false,
  ephemerisPath
});
const unknownTimeInterpretation = generateNatalInterpretationPreview(unknownTimeChart);

assert.equal(unknownTimeChart.subject.birthTimeKnown, false);
assert.equal(unknownTimeChart.angles.length, 0, "Unknown time chart should omit angles");
assert.equal(unknownTimeChart.houses.length, 0, "Unknown time chart should omit houses");
assert.ok(
  unknownTimeChart.warnings.some((warning) => warning.code === "UNKNOWN_BIRTH_TIME"),
  "Unknown time chart should include UNKNOWN_BIRTH_TIME warning"
);
assert.ok(
  !unknownTimeInterpretation.missingFactorKeys.some((key) => key.startsWith("angle.asc")),
  "Unknown time interpretation should not treat Ascendant as missing content"
);

const transitPreview = calculateTransitPreview({
  transitDateTime: "2026-07-03T12:00:00.000Z",
  natal: fixture.input,
  ephemerisPath
});

assert.equal(transitPreview.chartType, "transit");
assert.equal(transitPreview.transit.chartType, "transit");
assert.ok(transitPreview.transit.bodies.length >= minBodies, "Expected transit bodies");
assert.ok(transitPreview.moonPhase, "Expected transit Moon phase");
assert.ok(
  transitPreview.moonPhase.illuminatedFraction >= 0 && transitPreview.moonPhase.illuminatedFraction <= 1,
  "Expected Moon illumination to be normalized"
);
assert.equal(transitPreview.weekAhead.length, 7, "Expected 7 day transit forecast");
assert.ok(
  transitPreview.transitToNatalAspects.length > 0,
  "Expected at least one transit-to-natal major aspect"
);
assert.ok(transitPreview.transitToNatalAspects[0].phase, "Expected enriched transit aspect phase");
assert.ok(
  Number.isFinite(transitPreview.transitToNatalAspects[0].score),
  "Expected enriched transit aspect score"
);
assert.ok(transitPreview.transitToNatalAspects[0].strength, "Expected enriched transit aspect strength");
assert.ok(
  "activeFrom" in transitPreview.transitToNatalAspects[0],
  "Expected enriched transit active window"
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      engine: chart.engine,
      bodies: chart.bodies.length,
      aspects: chart.aspects.length,
      transitAspects: transitPreview.transitToNatalAspects.length,
      moonPhase: transitPreview.moonPhase.name,
      interpretationHighlights: interpretation.highlights.length,
      unknownTimeWarnings: unknownTimeChart.warnings.map((warning) => warning.code),
      warnings: chart.warnings.map((warning) => warning.code)
    },
    null,
    2
  )
);
