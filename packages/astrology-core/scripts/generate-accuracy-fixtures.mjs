import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { calculateNatalChart } = require("../dist");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "../fixtures/accuracy-charts");
const ephemerisPath = process.env.SWISSEPH_EPHE_PATH ? resolve(process.env.SWISSEPH_EPHE_PATH) : undefined;

const fixtureCases = [
  {
    slug: "kyiv-1995-spring",
    name: "Kyiv 1995 spring reference",
    purpose: "Mixed direct and retrograde rulerships with Koch/Placidus divergence.",
    input: {
      birthDate: "1995-04-12",
      birthTime: "14:30:27",
      birthTimeKnown: true,
      timezone: "Europe/Kyiv",
      latitude: 50.4501,
      longitude: 30.5234,
      zodiac: "tropical"
    }
  },
  {
    slug: "london-1988-winter",
    name: "London 1988 winter reference",
    purpose: "Northern latitude winter chart with several slow retrograde bodies.",
    input: {
      birthDate: "1988-01-03",
      birthTime: "06:20:45",
      birthTimeKnown: true,
      timezone: "Europe/London",
      latitude: 51.5074,
      longitude: -0.1278,
      zodiac: "tropical"
    }
  },
  {
    slug: "buenos-aires-1977-spring",
    name: "Buenos Aires 1977 spring reference",
    purpose: "Southern hemisphere chart to protect house and angle calculations.",
    input: {
      birthDate: "1977-10-09",
      birthTime: "23:05:12",
      birthTimeKnown: true,
      timezone: "America/Argentina/Buenos_Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      zodiac: "tropical"
    }
  }
];

const houseSystems = ["koch", "placidus"];
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

const pointPosition = (point) => ({
  longitude: round(point.longitude),
  sign: point.sign,
  signDegree: round(point.signDegree),
  motion: motionForPoint(point)
});

const anglePosition = (point) => ({
  longitude: round(point.longitude),
  sign: point.sign,
  signDegree: round(point.signDegree)
});

const housePosition = (house) => ({
  house: house.house,
  longitude: round(house.longitude),
  sign: house.sign,
  signDegree: round(house.signDegree)
});

const houseRuler = (ruler) => ({
  house: ruler.house,
  sign: ruler.sign,
  signCoverageDegrees: ruler.signCoverageDegrees,
  rulerSource: ruler.rulerSource,
  rulerKey: ruler.rulerKey,
  rulerType: ruler.rulerType,
  rulerHouse: ruler.rulerHouse,
  motion: ruler.motion
});

const planetRulership = (rulership) => ({
  pointKey: rulership.pointKey,
  houses: rulership.houses,
  directHouses: rulership.directHouses,
  retrogradeHouses: rulership.retrogradeHouses
});

const aspect = (item) => ({
  bodyA: item.bodyA,
  type: item.type,
  bodyB: item.bodyB,
  orb: round(item.orb, 3)
});

const buildSystemExpectation = (input, houseSystem) => {
  const chart = calculateNatalChart({
    ...input,
    houseSystem,
    ephemerisPath
  });

  if (chart.engine.status !== "swiss-ephemeris") {
    throw new Error(`Swiss Ephemeris is required to generate accuracy fixtures. Got ${chart.engine.status}.`);
  }

  return {
    angles: Object.fromEntries(chart.angles.map((point) => [point.key, anglePosition(point)])),
    houses: chart.houses.map(housePosition),
    bodyHouses: Object.fromEntries(
      chart.bodies
        .filter((point) => referenceBodyKeys.includes(point.key))
        .map((point) => [point.key, point.house ?? null])
    ),
    houseRulers: chart.houseRulers.map(houseRuler),
    planetRulerships: chart.planetRulerships.filter((item) => item.houses.length > 0).map(planetRulership),
    aspects: chart.aspects
      .filter((item) => aspectBodyKeys.has(item.bodyA) && aspectBodyKeys.has(item.bodyB))
      .map(aspect)
  };
};

await mkdir(outputDir, { recursive: true });

for (const fixtureCase of fixtureCases) {
  const bodyChart = calculateNatalChart({
    ...fixtureCase.input,
    houseSystem: "koch",
    ephemerisPath
  });

  if (bodyChart.engine.status !== "swiss-ephemeris") {
    throw new Error(`Swiss Ephemeris is required to generate accuracy fixtures. Got ${bodyChart.engine.status}.`);
  }

  const fixture = {
    name: fixtureCase.name,
    purpose: fixtureCase.purpose,
    reference: {
      source: "Generated from the local Swiss Ephemeris adapter as a regression baseline.",
      engine: bodyChart.engine
    },
    input: fixtureCase.input,
    tolerances: {
      longitude: 0.02,
      signDegree: 0.02,
      orb: 0.03
    },
    expect: {
      bodies: Object.fromEntries(
        bodyChart.bodies
          .filter((point) => referenceBodyKeys.includes(point.key))
          .map((point) => [point.key, pointPosition(point)])
      ),
      houseSystems: Object.fromEntries(
        houseSystems.map((houseSystem) => [houseSystem, buildSystemExpectation(fixtureCase.input, houseSystem)])
      )
    }
  };

  await writeFile(join(outputDir, `${fixtureCase.slug}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
}

console.log(`Generated ${fixtureCases.length} accuracy fixtures in ${outputDir}`);
