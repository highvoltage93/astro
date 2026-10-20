import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateProgressionAspects, findProgressionIngress } from "../../../packages/astrology-core/src/progression-aspects";
import { calculateAspectsBetween } from "../../../packages/astrology-core/src/aspects";
import type { ChartPoint } from "../../../packages/astrology-core/src/types";

const point = (key: string, longitude: number): ChartPoint => ({ key, label: key,
  longitude, kind: "body", sign: "aries", signDegree: longitude % 30 });

test("minor aspects are confined to secondary progressions", () => {
  for (const [angle, type] of [[30, "semisextile"], [150, "quincunx"]] as const) {
    const a = [point("sun", 0)], b = [point("moon", angle)];
    assert.equal(calculateProgressionAspects(a, b, 1)[0]?.type, type);
    assert.equal(calculateAspectsBetween(a, b).length, 0);
    assert.equal(calculateProgressionAspects(a, [point("moon", angle + 1.01)], 1).length, 0);
  }
});

test("ingress is the one-degree boundary, not exact time", () => {
  const result = findProgressionIngress(200000, 0, 1, 0, 50000,
    (time) => (358 + time / 100000) % 360);
  assert.ok(result !== null && Math.abs(result - 100000) <= 1000);
});

test("unknown beginning is not replaced by the search boundary", () => {
  assert.equal(findProgressionIngress(200000, 0, 1, 0, 50000, () => 0), null);
  assert.equal(findProgressionIngress(200000, 0, 1, 0, 50000, () => null), null);
});

test("retrograde ingress uses the same angular boundary", () => {
  const result = findProgressionIngress(200000, 10, 1, 0, 50000, (time) => 12 - time / 100000);
  assert.ok(result !== null && Math.abs(result - 100000) <= 1000);
});
