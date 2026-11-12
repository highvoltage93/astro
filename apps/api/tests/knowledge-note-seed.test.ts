import assert from "node:assert/strict";
import { test } from "node:test";
import { aspectKnowledgeSeed, knowledgeSeedDraft, knowledgeSeedHref, pointKnowledgeSeed } from "../../web/src/lib/knowledge-note-seed";
import { noteDraftSchema } from "../src/knowledge-notes/schemas";
import type { Aspect, ChartPoint } from "../../web/src/lib/chart-types";

const point: ChartPoint = { key: "mercury", label: "Mercury", kind: "planet", longitude: 165, sign: "virgo", signDegree: 15, house: 5, speed: -0.5 };
const aspect: Aspect = { bodyA: "mercury", bodyB: "saturn", type: "trine", exactAngle: 120, orb: 2.5 };

test("planet prefill uses existing facts without changing the calculation", () => {
  const original = structuredClone(point);
  const seed = pointKnowledgeSeed(Object.freeze(point), true);
  assert.deepEqual(seed, { version: 1, items: [
    { kind: "house", planet: "mercury", house: 5 },
    { kind: "sign", planet: "mercury", sign: "virgo" },
    { kind: "retrograde", planet: "mercury" }
  ] });
  assert.deepEqual(point, original);
  const draft = knowledgeSeedDraft(JSON.stringify(seed));
  assert.ok(draft);
  assert.equal(draft.body, "");
  assert.equal(draft.archived, false);
  assert.deepEqual(draft.tags, []);
  assert.equal(draft.conditions.match, "all");
  assert.equal(noteDraftSchema.safeParse({ ...draft, body: "My observation" }).success, true);
});

test("unknown time or missing house does not invent a house condition", () => {
  assert.equal(pointKnowledgeSeed(point, false)?.items.some((item) => item.kind === "house"), false);
  for (const house of [undefined, 0, 13, 1.5]) {
    assert.equal(pointKnowledgeSeed({ ...point, house }, true)?.items.some((item) => item.kind === "house"), false);
  }
});

test("retrograde prefill respects the natal stationary threshold", () => {
  for (const speed of [undefined, 0, 0.5, -0.00001, -0.0001, NaN, -Infinity]) {
    assert.equal(pointKnowledgeSeed({ ...point, speed }, true)?.items.some((item) => item.kind === "retrograde"), false);
  }
  assert.equal(pointKnowledgeSeed({ ...point, speed: -0.0002 }, true)?.items.some((item) => item.kind === "retrograde"), true);
});

test("aspect prefill copies endpoints and type but never introduces orb settings", () => {
  const original = structuredClone(aspect);
  const seed = aspectKnowledgeSeed(Object.freeze(aspect));
  assert.deepEqual(seed, { version: 1, items: [{ kind: "aspect", planet: "mercury", otherPlanet: "saturn", aspect: "trine" }] });
  assert.deepEqual(aspect, original);
  assert.equal(JSON.stringify(seed).includes("orb"), false);
  assert.equal(aspectKnowledgeSeed({ ...aspect, type: "quincunx" }), null);
  assert.equal(aspectKnowledgeSeed({ ...aspect, bodyB: "asc" }), null);
  assert.equal(aspectKnowledgeSeed({ ...aspect, bodyB: "mercury" }), null);
  assert.equal(pointKnowledgeSeed({ ...point, key: "asc" }, true), null);
});

test("links carry only structured conditions and optional source, never the note body", () => {
  const href = knowledgeSeedHref(pointKnowledgeSeed(point, true), "cmf8exampleprofile00000001");
  assert.ok(href);
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, "/knowledge");
  assert.equal(url.searchParams.get("source"), "cmf8exampleprofile00000001");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["seed", "source"]);
  assert.ok(knowledgeSeedDraft(url.searchParams.get("seed")!));
  const unlinked = new URL(knowledgeSeedHref(aspectKnowledgeSeed(aspect))!, "https://example.test");
  assert.equal(unlinked.searchParams.has("source"), false);
  assert.equal(knowledgeSeedHref(null), undefined);
});

test("malformed URL presets are rejected without creating a default interpretation", () => {
  const item = { kind: "house", planet: "mercury", house: 5 };
  for (const seed of [null, [], {}, { version: 2, items: [item] }, { version: 1, items: [] },
    { version: 1, items: Array(11).fill(item) },
    { version: 1, items: [{ ...item, house: "5" }] },
    { version: 1, items: [{ ...item, house: 13 }] },
    { version: 1, items: [{ ...item, planet: "toString" }] },
    { version: 1, items: [{ ...item, body: "Injected text" }] },
    { version: 1, items: [item], ownerUserId: "another" },
    { version: 1, items: [{ kind: "sign", planet: "sun", sign: "unknown" }] },
    { version: 1, items: [{ kind: "aspect", planet: "sun", otherPlanet: "sun", aspect: "conjunction" }] }
  ]) assert.equal(knowledgeSeedDraft(JSON.stringify(seed)), null);
  assert.equal(knowledgeSeedDraft("not-json"), null);
  assert.equal(knowledgeSeedDraft("x".repeat(2001)), null);
});
