import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { calculateNatalChart } = require("../dist");

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures/external-reference-charts");
const ephemerisPath = process.env.SWISSEPH_EPHE_PATH ? resolve(process.env.SWISSEPH_EPHE_PATH) : undefined;

const aspectPlanetKeys = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
];
const aspectPlanetKeySet = new Set(aspectPlanetKeys);
const aspectAngles = {
  conjunction: 0,
  opposition: 180,
  trine: 120,
  square: 90,
  sextile: 60
};
const aspectOrbs = {
  conjunction: 8,
  opposition: 8,
  trine: 7,
  square: 7,
  sextile: 5
};

const normalizeLongitude = (value) => ((value % 360) + 360) % 360;

const circularDelta = (actual, expected) => {
  const difference = Math.abs(normalizeLongitude(actual) - normalizeLongitude(expected));
  return Math.min(difference, 360 - difference);
};

const shortestDistance = (longitudeA, longitudeB) => circularDelta(longitudeA, longitudeB);

const motionFromSpeed = (speed) => {
  if (Math.abs(speed ?? 0) < 0.0001) {
    return "stationary";
  }

  return speed < 0 ? "retrograde" : "direct";
};

const aspectKey = (bodyA, type, bodyB) =>
  [bodyA, bodyB].sort().join(":") + `:${type}`;

const expectedHouseForLongitude = (longitude, cusps) => {
  const normalizedLongitude = normalizeLongitude(longitude);

  for (let index = 0; index < cusps.length; index += 1) {
    const start = normalizeLongitude(cusps[index]);
    const end = normalizeLongitude(cusps[(index + 1) % cusps.length]);
    const span = normalizeLongitude(end - start);
    const offset = normalizeLongitude(normalizedLongitude - start);

    if (offset < span) {
      return index + 1;
    }
  }

  return null;
};

const buildExpectedAspects = (bodies) => {
  const aspects = new Map();

  for (let firstIndex = 0; firstIndex < aspectPlanetKeys.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < aspectPlanetKeys.length; secondIndex += 1) {
      const bodyA = aspectPlanetKeys[firstIndex];
      const bodyB = aspectPlanetKeys[secondIndex];
      const pointA = bodies[bodyA];
      const pointB = bodies[bodyB];

      if (!pointA || !pointB) {
        continue;
      }

      const distance = shortestDistance(pointA.longitude, pointB.longitude);

      for (const [type, exactAngle] of Object.entries(aspectAngles)) {
        const orb = Math.abs(distance - exactAngle);

        if (orb <= aspectOrbs[type]) {
          aspects.set(aspectKey(bodyA, type, bodyB), {
            bodyA,
            bodyB,
            type,
            orb
          });
        }
      }
    }
  }

  return aspects;
};

const actualAspects = (chart) =>
  new Map(
    chart.aspects
      .filter((aspect) => aspectPlanetKeySet.has(aspect.bodyA) && aspectPlanetKeySet.has(aspect.bodyB))
      .map((aspect) => [aspectKey(aspect.bodyA, aspect.type, aspect.bodyB), aspect])
  );

const failures = [];
const summaries = [];

const fail = ({ fixture, system, scope, field, expected, actual, delta, tolerance }) => {
  failures.push({
    fixture,
    system,
    scope,
    field,
    expected,
    actual,
    ...(delta === undefined ? {} : { delta: Number(delta.toFixed(6)) }),
    ...(tolerance === undefined ? {} : { tolerance })
  });
};

const compareClose = ({ fixture, system, scope, field, expected, actual, tolerance }) => {
  const delta = circularDelta(actual, expected);

  if (delta > tolerance) {
    fail({ fixture, system, scope, field, expected, actual, delta, tolerance });
  }

  return delta;
};

const fixtureFiles = (await readdir(fixturesDir)).filter((file) => file.endsWith(".json")).sort();

if (fixtureFiles.length === 0) {
  throw new Error("Expected at least one locked external reference fixture.");
}

for (const fixtureFile of fixtureFiles) {
  const fixture = JSON.parse(await readFile(join(fixturesDir, fixtureFile), "utf8"));

  if (fixture.schemaVersion !== 1 || fixture.locked !== true) {
    fail({
      fixture: fixtureFile,
      scope: "metadata",
      field: "locked schema",
      expected: "schemaVersion=1 and locked=true",
      actual: `schemaVersion=${fixture.schemaVersion}, locked=${fixture.locked}`
    });
    continue;
  }

  const tolerances = {
    longitude: fixture.tolerances?.longitude ?? 0.01,
    houseCusp: fixture.tolerances?.houseCusp ?? 0.01,
    aspectOrb: fixture.tolerances?.aspectOrb ?? 0.03
  };
  const expectedAspects = buildExpectedAspects(fixture.expect.bodies);

  for (const [houseSystem, expectedSystem] of Object.entries(fixture.expect.houseSystems)) {
    const chart = calculateNatalChart({
      ...fixture.input,
      houseSystem,
      ephemerisPath
    });
    const summary = {
      fixture: fixtureFile,
      houseSystem,
      bodyCount: Object.keys(fixture.expect.bodies).length,
      houseCount: expectedSystem.cusps.length,
      aspectCount: expectedAspects.size,
      maxBodyDelta: 0,
      maxCuspDelta: 0,
      maxAspectOrbDelta: 0
    };

    if (chart.engine.status !== "swiss-ephemeris") {
      fail({
        fixture: fixtureFile,
        system: houseSystem,
        scope: "engine",
        field: "status",
        expected: "swiss-ephemeris",
        actual: chart.engine.status
      });
      summaries.push(summary);
      continue;
    }

    const bodiesByKey = new Map(chart.bodies.map((point) => [point.key, point]));

    for (const [bodyKey, expectedBody] of Object.entries(fixture.expect.bodies)) {
      const actualBody = bodiesByKey.get(bodyKey);

      if (!actualBody) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "body",
          field: bodyKey,
          expected: "present",
          actual: "missing"
        });
        continue;
      }

      const bodyDelta = compareClose({
        fixture: fixtureFile,
        system: houseSystem,
        scope: "body",
        field: `${bodyKey}.longitude`,
        expected: expectedBody.longitude,
        actual: actualBody.longitude,
        tolerance: tolerances.longitude
      });
      summary.maxBodyDelta = Math.max(summary.maxBodyDelta, bodyDelta);

      const expectedMotion = motionFromSpeed(expectedBody.speed);
      const actualMotion = motionFromSpeed(actualBody.speed);

      if (actualMotion !== expectedMotion) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "body",
          field: `${bodyKey}.motion`,
          expected: expectedMotion,
          actual: actualMotion
        });
      }

      const expectedHouse = expectedHouseForLongitude(expectedBody.longitude, expectedSystem.cusps);

      if (actualBody.house !== expectedHouse) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "body-house",
          field: bodyKey,
          expected: expectedHouse,
          actual: actualBody.house ?? null
        });
      }
    }

    if (chart.houses.length !== expectedSystem.cusps.length) {
      fail({
        fixture: fixtureFile,
        system: houseSystem,
        scope: "houses",
        field: "count",
        expected: expectedSystem.cusps.length,
        actual: chart.houses.length
      });
    }

    for (let index = 0; index < expectedSystem.cusps.length; index += 1) {
      const actualHouse = chart.houses.find((house) => house.house === index + 1);

      if (!actualHouse) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "houses",
          field: `house-${index + 1}`,
          expected: expectedSystem.cusps[index],
          actual: "missing"
        });
        continue;
      }

      const cuspDelta = compareClose({
        fixture: fixtureFile,
        system: houseSystem,
        scope: "houses",
        field: `house-${index + 1}.longitude`,
        expected: expectedSystem.cusps[index],
        actual: actualHouse.longitude,
        tolerance: tolerances.houseCusp
      });
      summary.maxCuspDelta = Math.max(summary.maxCuspDelta, cuspDelta);
    }

    const anglesByKey = new Map(chart.angles.map((angle) => [angle.key, angle]));

    for (const [angleKey, expectedLongitude] of [
      ["asc", expectedSystem.ascendant],
      ["mc", expectedSystem.midheaven]
    ]) {
      const actualAngle = anglesByKey.get(angleKey);

      if (!actualAngle) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "angles",
          field: angleKey,
          expected: expectedLongitude,
          actual: "missing"
        });
        continue;
      }

      compareClose({
        fixture: fixtureFile,
        system: houseSystem,
        scope: "angles",
        field: `${angleKey}.longitude`,
        expected: expectedLongitude,
        actual: actualAngle.longitude,
        tolerance: tolerances.houseCusp
      });
    }

    const chartAspects = actualAspects(chart);
    const allAspectKeys = new Set([...expectedAspects.keys(), ...chartAspects.keys()]);

    for (const key of allAspectKeys) {
      const expectedAspect = expectedAspects.get(key);
      const actualAspect = chartAspects.get(key);

      if (!expectedAspect || !actualAspect) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "aspects",
          field: key,
          expected: expectedAspect ? "present" : "absent",
          actual: actualAspect ? "present" : "absent"
        });
        continue;
      }

      const orbDelta = Math.abs(actualAspect.orb - expectedAspect.orb);
      summary.maxAspectOrbDelta = Math.max(summary.maxAspectOrbDelta, orbDelta);

      if (orbDelta > tolerances.aspectOrb) {
        fail({
          fixture: fixtureFile,
          system: houseSystem,
          scope: "aspects",
          field: `${key}.orb`,
          expected: expectedAspect.orb,
          actual: actualAspect.orb,
          delta: orbDelta,
          tolerance: tolerances.aspectOrb
        });
      }
    }

    summaries.push({
      ...summary,
      maxBodyDelta: Number(summary.maxBodyDelta.toFixed(6)),
      maxCuspDelta: Number(summary.maxCuspDelta.toFixed(6)),
      maxAspectOrbDelta: Number(summary.maxAspectOrbDelta.toFixed(6))
    });
  }
}

const report = {
  status: failures.length === 0 ? "ok" : "failed",
  source: "Locked external Astrodienst swetest references",
  fixtures: fixtureFiles.length,
  systems: summaries.length,
  tolerances: {
    bodyLongitudeDegrees: 0.01,
    houseCuspDegrees: 0.01,
    aspectOrbDegrees: 0.03
  },
  summaries,
  failures
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
