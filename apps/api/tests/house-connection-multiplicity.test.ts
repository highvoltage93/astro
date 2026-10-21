import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateHouseConnections } from "../../../packages/astrology-core/src/swiss-ephemeris";
import { defaultCalculationRules } from "../../../packages/astrology-core/src/calculation-rules";
import type { Aspect, ChartPoint, HouseRuler } from "../../../packages/astrology-core/src/types";

const body = (key: string, house: number): ChartPoint => ({
  key, label: key, house, kind: "body", longitude: 0, sign: "aries", signDegree: 0
});
const ruler = (rulerKey: string, house: number, sign: string, rulerSource: HouseRuler["rulerSource"] = "cusp"): HouseRuler => ({
  rulerKey, rulerLabel: rulerKey, house, sign, rulerSource, rulerType: "retrograde"
});
const rulers = [ruler("mars", 2, "scorpio"), ruler("mars", 3, "aries"),
  ruler("uranus", 5, "capricorn"), ruler("uranus", 4, "aquarius"),
  ruler("uranus", 5, "aquarius", "contained-sign"), ruler("uranus", 6, "aquarius")];
const aspect: Aspect = { bodyA: "mars", bodyB: "uranus", type: "trine", exactAngle: 120, orb: 0 };

test("node aspects on either side do not contribute to house connections", () => {
  const bodies = [body("mars", 1), body("uranus", 5), body("north-node", 8), body("south-node", 2)];
  const nodeAspects: Aspect[] = ["north-node", "south-node"].flatMap((key) => [
    { ...aspect, bodyA: key }, { ...aspect, bodyB: key }
  ]);
  nodeAspects.push({ ...aspect, bodyA: "north-node", bodyB: "south-node", type: "opposition", exactAngle: 180 });
  const input = [aspect, ...nodeAspects];
  const original = JSON.stringify(input);
  assert.deepEqual(
    calculateHouseConnections(rulers, bodies, input, defaultCalculationRules()),
    calculateHouseConnections(rulers, bodies, [aspect], defaultCalculationRules())
  );
  assert.equal(JSON.stringify(input), original);
});

test("each independent responsibility contributes to repeated aspect formulas", () => {
  const result = calculateHouseConnections(rulers, [body("mars", 1), body("uranus", 5)], [aspect], defaultCalculationRules());
  const details = result.flatMap((connection) => connection.details).filter((detail) => detail.source === "aspect");
  assert.equal(details.length, 15);
  for (const house of [1, 2, 3]) {
    const repeated = details.filter((detail) => detail.fromHouse === house && detail.toHouse === 5);
    assert.equal(repeated.length, 3);
    assert.ok(repeated.every((detail) => detail.tone === "harmonious"));
    assert.deepEqual(repeated.map((detail) => detail.toRulerSource), [undefined, "cusp", "contained-sign"]);
  }
  assert.equal(result.find((connection) => connection.fromHouse === 5 && connection.toHouse === 5)?.total, 3);
});

test("identical input records are not extra independent responsibilities", () => {
  const bodies = [body("mars", 1), body("uranus", 5)];
  assert.deepEqual(
    calculateHouseConnections([...rulers, rulers[2]!], bodies, [aspect], defaultCalculationRules()),
    calculateHouseConnections(rulers, bodies, [aspect], defaultCalculationRules())
  );
});

test("multiplicities on both sides multiply, including diagonal aspects", () => {
  const result = calculateHouseConnections([
    ruler("mars", 5, "scorpio"), ruler("uranus", 5, "capricorn"),
    ruler("uranus", 5, "aquarius", "contained-sign")
  ], [body("mars", 5), body("uranus", 5)], [aspect], defaultCalculationRules());
  assert.equal(result[0]?.details.filter((detail) => detail.source === "aspect").length, 6);
});

test("conjunction signs and Chiron exclusion remain unchanged", () => {
  const result = calculateHouseConnections(rulers, [body("mars", 1), body("uranus", 5), body("chiron", 1)], [
    { ...aspect, type: "conjunction", exactAngle: 0 }, { ...aspect, bodyA: "chiron" }
  ], defaultCalculationRules());
  const details = result.flatMap((connection) => connection.details).filter((detail) => detail.source === "aspect");
  assert.equal(details.length, 15);
  assert.equal(details.filter((detail) => detail.tone === "tense").length, 3);
  assert.ok(details.every((detail) => detail.planetA !== "chiron"));
});
