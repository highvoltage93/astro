import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { calculateNatalChart, generateNatalInterpretationPreview } = require("../dist");

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

console.log(
  JSON.stringify(
    {
      status: "ok",
      engine: chart.engine,
      bodies: chart.bodies.length,
      aspects: chart.aspects.length,
      interpretationHighlights: interpretation.highlights.length,
      warnings: chart.warnings.map((warning) => warning.code)
    },
    null,
    2
  )
);
