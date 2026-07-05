import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { calculateNatalChart } = require("../dist");

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures/accuracy-charts");
const ephemerisPath = process.env.SWISSEPH_EPHE_PATH ? resolve(process.env.SWISSEPH_EPHE_PATH) : undefined;

const referenceBodyKeys = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "north-node"
];
const aspectBodyKeys = new Set(referenceBodyKeys.filter((key) => key !== "north-node"));

const round = (value, digits = 4) => Number(value.toFixed(digits));

const motionForPoint = (point) => {
  if (Math.abs(point.speed ?? 0) < 0.0001) {
    return "stationary";
  }

  return (point.speed ?? 0) < 0 ? "retrograde" : "direct";
};

const actualBodies = (chart) =>
  Object.fromEntries(
    chart.bodies
      .filter((point) => referenceBodyKeys.includes(point.key))
      .map((point) => [
        point.key,
        {
          longitude: round(point.longitude),
          sign: point.sign,
          signDegree: round(point.signDegree),
          motion: motionForPoint(point)
        }
      ])
  );

const actualAngles = (chart) =>
  Object.fromEntries(
    chart.angles.map((point) => [
      point.key,
      {
        longitude: round(point.longitude),
        sign: point.sign,
        signDegree: round(point.signDegree)
      }
    ])
  );

const actualHouses = (chart) =>
  chart.houses.map((house) => ({
    house: house.house,
    longitude: round(house.longitude),
    sign: house.sign,
    signDegree: round(house.signDegree)
  }));

const actualBodyHouses = (chart) =>
  Object.fromEntries(
    chart.bodies
      .filter((point) => referenceBodyKeys.includes(point.key))
      .map((point) => [point.key, point.house ?? null])
  );

const actualHouseRulers = (chart) =>
  chart.houseRulers.map((ruler) => ({
    house: ruler.house,
    sign: ruler.sign,
    rulerKey: ruler.rulerKey,
    rulerType: ruler.rulerType,
    rulerHouse: ruler.rulerHouse,
    motion: ruler.motion
  }));

const actualPlanetRulerships = (chart) =>
  chart.planetRulerships
    .filter((rulership) => rulership.houses.length > 0)
    .map((rulership) => ({
      pointKey: rulership.pointKey,
      houses: rulership.houses,
      directHouses: rulership.directHouses,
      retrogradeHouses: rulership.retrogradeHouses
    }));

const actualAspects = (chart) =>
  chart.aspects
    .filter((aspect) => aspectBodyKeys.has(aspect.bodyA) && aspectBodyKeys.has(aspect.bodyB))
    .map((aspect) => ({
      bodyA: aspect.bodyA,
      type: aspect.type,
      bodyB: aspect.bodyB,
      orb: round(aspect.orb, 3)
    }));

const assertClose = (label, actual, expected, tolerance) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
};

const comparePositionMap = (label, actual, expected, tolerances) => {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label}: point keys changed`);

  for (const [key, expectedPoint] of Object.entries(expected)) {
    const actualPoint = actual[key];

    assert.equal(actualPoint.sign, expectedPoint.sign, `${label}.${key}.sign`);
    assert.equal(actualPoint.motion, expectedPoint.motion, `${label}.${key}.motion`);
    assertClose(`${label}.${key}.longitude`, actualPoint.longitude, expectedPoint.longitude, tolerances.longitude);
    assertClose(`${label}.${key}.signDegree`, actualPoint.signDegree, expectedPoint.signDegree, tolerances.signDegree);
  }
};

const compareAngles = (label, actual, expected, tolerances) => {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label}: angle keys changed`);

  for (const [key, expectedAngle] of Object.entries(expected)) {
    const actualAngle = actual[key];

    assert.equal(actualAngle.sign, expectedAngle.sign, `${label}.${key}.sign`);
    assertClose(`${label}.${key}.longitude`, actualAngle.longitude, expectedAngle.longitude, tolerances.longitude);
    assertClose(`${label}.${key}.signDegree`, actualAngle.signDegree, expectedAngle.signDegree, tolerances.signDegree);
  }
};

const compareHouses = (label, actual, expected, tolerances) => {
  assert.equal(actual.length, expected.length, `${label}: house count changed`);

  for (let index = 0; index < expected.length; index += 1) {
    const actualHouse = actual[index];
    const expectedHouse = expected[index];

    assert.equal(actualHouse.house, expectedHouse.house, `${label}[${index}].house`);
    assert.equal(actualHouse.sign, expectedHouse.sign, `${label}[${index}].sign`);
    assertClose(`${label}[${index}].longitude`, actualHouse.longitude, expectedHouse.longitude, tolerances.longitude);
    assertClose(`${label}[${index}].signDegree`, actualHouse.signDegree, expectedHouse.signDegree, tolerances.signDegree);
  }
};

const compareAspects = (label, actual, expected, tolerances) => {
  assert.equal(actual.length, expected.length, `${label}: aspect count changed`);

  for (let index = 0; index < expected.length; index += 1) {
    const actualAspect = actual[index];
    const expectedAspect = expected[index];

    assert.equal(actualAspect.bodyA, expectedAspect.bodyA, `${label}[${index}].bodyA`);
    assert.equal(actualAspect.type, expectedAspect.type, `${label}[${index}].type`);
    assert.equal(actualAspect.bodyB, expectedAspect.bodyB, `${label}[${index}].bodyB`);
    assertClose(`${label}[${index}].orb`, actualAspect.orb, expectedAspect.orb, tolerances.orb);
  }
};

const fixtureFiles = (await readdir(fixturesDir)).filter((file) => file.endsWith(".json")).sort();

assert.ok(fixtureFiles.length > 0, "Expected at least one accuracy fixture");

const summary = [];

for (const fixtureFile of fixtureFiles) {
  const fixture = JSON.parse(await readFile(join(fixturesDir, fixtureFile), "utf8"));
  const tolerances = {
    longitude: fixture.tolerances?.longitude ?? 0.02,
    signDegree: fixture.tolerances?.signDegree ?? 0.02,
    orb: fixture.tolerances?.orb ?? 0.03
  };

  for (const [houseSystem, expectedSystem] of Object.entries(fixture.expect.houseSystems)) {
    const chart = calculateNatalChart({
      ...fixture.input,
      houseSystem,
      ephemerisPath
    });

    assert.equal(chart.engine.status, "swiss-ephemeris", `${fixtureFile}.${houseSystem}: expected Swiss Ephemeris`);
    comparePositionMap(`${fixtureFile}.${houseSystem}.bodies`, actualBodies(chart), fixture.expect.bodies, tolerances);
    compareAngles(`${fixtureFile}.${houseSystem}.angles`, actualAngles(chart), expectedSystem.angles, tolerances);
    compareHouses(`${fixtureFile}.${houseSystem}.houses`, actualHouses(chart), expectedSystem.houses, tolerances);
    assert.deepEqual(actualBodyHouses(chart), expectedSystem.bodyHouses, `${fixtureFile}.${houseSystem}.bodyHouses`);
    assert.deepEqual(actualHouseRulers(chart), expectedSystem.houseRulers, `${fixtureFile}.${houseSystem}.houseRulers`);
    assert.deepEqual(
      actualPlanetRulerships(chart),
      expectedSystem.planetRulerships,
      `${fixtureFile}.${houseSystem}.planetRulerships`
    );
    compareAspects(`${fixtureFile}.${houseSystem}.aspects`, actualAspects(chart), expectedSystem.aspects, tolerances);

    summary.push({
      fixture: fixtureFile,
      houseSystem,
      houses: chart.houses.length,
      rulers: chart.houseRulers.length,
      aspects: expectedSystem.aspects.length
    });
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      fixtures: fixtureFiles.length,
      systems: summary.length,
      summary
    },
    null,
    2
  )
);
