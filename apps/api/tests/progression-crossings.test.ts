import assert from "node:assert/strict";
import { test } from "node:test";
import { findProgressionCrossings } from "../../../packages/astrology-core/src/progression-crossings";
import { calculateAspectsBetween } from "../../../packages/astrology-core/src/aspects";
import type { ChartPoint } from "../../../packages/astrology-core/src/types";

test("calendar refines the real calendar time and handles zodiac wrap", () => {
  const longitudeAt = (time: number) => (359 + time / 100000) % 360;
  const roots = findProgressionCrossings([
    { time: 0, longitude: 359 }, { time: 200000, longitude: 1 }
  ], 0, longitudeAt);
  assert.equal(roots.length, 1);
  assert.ok(Math.abs(roots[0]! - 100000) <= 1000);
});

test("opposite-longitude wrap is not a crossing", () => {
  assert.deepEqual(findProgressionCrossings([
    { time: 0, longitude: 179 }, { time: 200000, longitude: 181 }
  ], 0, (time) => 179 + time / 100000), []);
});

test("retrograde repeat passes remain separate events", () => {
  const longitudeAt = (time: number) => 10 + Math.cos(time / 100000 * Math.PI);
  const samples = Array.from({ length: 5 }, (_, index) => ({
    time: index * 100000, longitude: longitudeAt(index * 100000)
  }));
  const roots = findProgressionCrossings(samples, 10, longitudeAt);
  assert.equal(roots.length, 4);
  roots.forEach((time, index) => assert.ok(Math.abs(time - (50000 + index * 100000)) <= 1000));
});

test("shared sample boundary is not duplicated", () => {
  assert.equal(findProgressionCrossings([
    { time: 0, longitude: 9 }, { time: 100000, longitude: 10 }, { time: 200000, longitude: 11 }
  ], 10, (time) => 9 + time / 100000).length, 1);
});

test("progressions include all four directed planet/cusp pair types", () => {
  const point = (key: string): ChartPoint => ({
    key, label: key, longitude: 10, sign: "aries", signDegree: 10,
    kind: key.startsWith("house-") ? "angle" : "body"
  });
  const aspects = calculateAspectsBetween([point("sun"), point("house-1")], [point("moon"), point("house-2")], { conjunction: 1 });
  assert.deepEqual(aspects.map((aspect) => [aspect.bodyA, aspect.bodyB]), [
    ["sun", "moon"], ["sun", "house-2"], ["house-1", "moon"], ["house-1", "house-2"]
  ]);
});
