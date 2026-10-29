import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateForecastPreview, calculateTransitPreview } from "../../../packages/astrology-core/src/swiss-ephemeris";

const natal = { birthDate: "1997-06-20", birthTime: "12:00:18", timezone: "UTC+3",
  latitude: 51.50551, longitude: 31.28487, houseSystem: "koch" as const };

test("transit preview and weekly summary target bodies, never house cusps or angles", () => {
  const result = calculateTransitPreview({ natal, transitDateTime: "2026-10-29T12:00:00Z" });
  const targets = new Set(result.natal.bodies.map(body => body.key));
  assert.ok(result.transitToNatalAspects.length > 0);
  for (const aspect of [...result.transitToNatalAspects, ...result.weekAhead.flatMap(day => day.strongestAspects)]) {
    assert.ok(targets.has(aspect.bodyB), aspect.bodyB);
  }
  assert.equal(result.natal.houses.length, 12);
});

test("exact transit calendar excludes natal angles while retaining house placements", () => {
  const result = calculateForecastPreview({ natal, method: "transits", days: 7, fromDateTime: "2026-10-29T12:00:00Z" });
  const targets = new Set(result.natal.bodies.map(body => body.key));
  assert.ok(result.exactTransits.length > 0);
  assert.ok(result.exactTransits.every(event => targets.has(event.bodyB)));
  assert.ok(result.exactTransits.some(event => event.natalHouse !== undefined));
});
