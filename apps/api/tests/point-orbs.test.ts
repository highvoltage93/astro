import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedOrbForPair, calculateMajorAspects, calculateAspectsBetween } from "../../../packages/astrology-core/src/aspects";
import { MAJOR_ASPECT_ANGLES } from "../../../packages/astrology-core/src/constants";
import type { AspectType, ChartPoint } from "../../../packages/astrology-core/src/types";

const point = (key: string, longitude: number): ChartPoint => ({
  key, longitude, label: key, kind: "body", sign: "aries", signDegree: longitude % 30
});

test("all major aspect types use point orbs without legacy type caps", () => {
  for (const [type, angle] of Object.entries(MAJOR_ASPECT_ANGLES) as Array<[AspectType, number]>) {
    const longitude = angle === 180 ? angle - 8.5 : angle + 8.5;
    const a = point("sun", 0), b = point("moon", longitude);
    assert.equal(allowedOrbForPair(type, a, b), 8.5);
    assert.ok(calculateMajorAspects([a, b]).some((aspect) => aspect.type === type));
    assert.ok(calculateAspectsBetween([a], [b]).some((aspect) => aspect.type === type));
    const outside = point("moon", angle === 180 ? angle - 8.51 : angle + 8.51);
    assert.ok(!calculateMajorAspects([a, outside]).some((aspect) => aspect.type === type));
  }
});

test("smaller point orb wins, including node, Lilith, Saturn and Pluto defaults", () => {
  assert.equal(allowedOrbForPair("sextile", { key: "saturn" }, { key: "saturn" }), 9);
  assert.equal(allowedOrbForPair("square", { key: "sun" }, { key: "pluto" }), 6.5);
  for (const key of ["north-node", "south-node", "lilith"]) {
    assert.equal(allowedOrbForPair("trine", { key }, { key: "sun" }), 5);
  }
});

test("custom zero orbs and explicit method limits remain effective", () => {
  assert.equal(allowedOrbForPair("trine", { key: "sun" }, { key: "moon" }, {}, { sun: 0 }), 0);
  assert.equal(allowedOrbForPair("trine", { key: "sun" }, { key: "moon" }, { trine: 1 }), 1);
  assert.equal(allowedOrbForPair("trine", { key: "sun" }, { key: "moon" }, {}, { sun: 12, moon: 11 }), 11);
  assert.ok(!calculateAspectsBetween([point("sun", 0)], [point("moon", 121.1)], { trine: 1 }).some((aspect) => aspect.type === "trine"));
});
