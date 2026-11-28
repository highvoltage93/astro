import assert from "node:assert/strict";
import test from "node:test";
import { forecastKnowledgeSeedHref, knowledgeSeedDraft } from "../../web/src/lib/knowledge-note-seed";

const context = { source: "transit", exactAt: "2026-11-28T12:00:00Z", bodyA: "jupiter", bodyB: "sun", aspect: "trine" };
test("forecast draft keeps predictive context separate from natal matching", () => {
  const href = forecastKnowledgeSeedHref(context);
  assert.ok(href);
  const seed = new URL(href, "https://example.test").searchParams.get("seed")!;
  const draft = knowledgeSeedDraft(seed)!;
  assert.ok(draft);
  assert.equal(draft.archived, true);
  assert.deepEqual(draft.conditions.items, []);
  assert.equal(draft.conditions.scope, "natal");
  assert.ok(draft.body.includes("2026-11-28T12:00:00.000Z"));
});
test("forecast link excludes private context and rejects unsupported presets", () => {
  const href = forecastKnowledgeSeedHref({ ...context, title: "Private client", notes: "Private notes" } as typeof context);
  assert.ok(href);
  assert.ok(!decodeURIComponent(href).includes("Private"));
  assert.equal(forecastKnowledgeSeedHref({ ...context, source: "unknown" }), undefined);
  assert.equal(forecastKnowledgeSeedHref({ ...context, bodyA: "house-13" }), undefined);
  assert.equal(forecastKnowledgeSeedHref({ ...context, exactAt: "invalid" }), undefined);
  assert.ok(forecastKnowledgeSeedHref({ ...context, source: "secondary-progression", bodyA: "house-12", aspect: "quincunx" }));
  assert.equal(knowledgeSeedDraft(JSON.stringify({ version: 2, kind: "forecast-context", ...context, body: "injected" })), null);
});
test("existing natal presets keep their matching conditions", () => {
  const item = { kind: "aspect", planet: "sun", otherPlanet: "moon", aspect: "trine" };
  const draft = knowledgeSeedDraft(JSON.stringify({ version: 1, items: [item] }))!;
  assert.deepEqual(draft.conditions.items, [item]);
  assert.equal(draft.archived, false);
});
