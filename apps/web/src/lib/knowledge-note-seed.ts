import type { Aspect, ChartPoint } from "./chart-types";
import { emptyKnowledgeDraft, knowledgeConditionText, type KnowledgeDraft, type NoteCondition } from "./knowledge-notes";

const planets = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "lilith", "north-node", "south-node"]);
const signs = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const aspects = new Set(["conjunction", "sextile", "square", "trine", "opposition"]);
export type KnowledgeSeed = { version: 1; items: NoteCondition[] };
export type KnowledgeSourceContext = { sourceProfileId?: string; birthTimeKnown: boolean };

export function pointKnowledgeSeed(point: ChartPoint, birthTimeKnown: boolean): KnowledgeSeed | null {
  if (!planets.has(point.key)) return null;
  const items: NoteCondition[] = [];
  if (birthTimeKnown && point.house !== undefined && Number.isInteger(point.house) && point.house >= 1 && point.house <= 12) {
    items.push({ kind: "house", planet: point.key, house: point.house });
  }
  if (signs.has(point.sign)) items.push({ kind: "sign", planet: point.key, sign: point.sign });
  if (point.speed !== undefined && Number.isFinite(point.speed) && point.speed < -0.0001) items.push({ kind: "retrograde", planet: point.key });
  return items.length ? { version: 1, items } : null;
}

export function aspectKnowledgeSeed(aspect: Aspect): KnowledgeSeed | null {
  if (!planets.has(aspect.bodyA) || !planets.has(aspect.bodyB) || aspect.bodyA === aspect.bodyB || !aspects.has(aspect.type)) return null;
  return { version: 1, items: [{ kind: "aspect", planet: aspect.bodyA, otherPlanet: aspect.bodyB, aspect: aspect.type }] };
}

export function knowledgeSeedHref(seed: KnowledgeSeed | null, sourceProfileId?: string): string | undefined {
  if (!seed) return undefined;
  const params = new URLSearchParams({ seed: JSON.stringify(seed) });
  if (sourceProfileId) params.set("source", sourceProfileId);
  return `/knowledge?${params}`;
}

// URL data is untrusted. Reject malformed presets instead of silently inventing conditions.
export function knowledgeSeedDraft(raw: string): KnowledgeDraft | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const seed: unknown = JSON.parse(raw);
    if (!seed || typeof seed !== "object" || Array.isArray(seed)) return null;
    const value = seed as Record<string, unknown>;
    if (Object.keys(value).some((key) => !["version", "items"].includes(key)) || value.version !== 1 || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 10) return null;
    const items: NoteCondition[] = [];
    for (const candidate of value.items) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
      const item = candidate as Record<string, unknown>;
      if (typeof item.planet !== "string" || !planets.has(item.planet)) return null;
      let condition: NoteCondition;
      if (item.kind === "house" && typeof item.house === "number" && Number.isInteger(item.house) && item.house >= 1 && item.house <= 12) {
        condition = { kind: "house", planet: item.planet, house: item.house };
      } else if (item.kind === "sign" && typeof item.sign === "string" && signs.has(item.sign)) {
        condition = { kind: "sign", planet: item.planet, sign: item.sign };
      } else if (item.kind === "retrograde") {
        condition = { kind: "retrograde", planet: item.planet };
      } else if (item.kind === "aspect" && typeof item.otherPlanet === "string" && planets.has(item.otherPlanet) && item.otherPlanet !== item.planet && typeof item.aspect === "string" && aspects.has(item.aspect)) {
        condition = { kind: "aspect", planet: item.planet, otherPlanet: item.otherPlanet, aspect: item.aspect };
      } else return null;
      if (Object.keys(item).some((key) => !Object.hasOwn(condition, key))) return null;
      items.push(condition);
    }
    return { ...emptyKnowledgeDraft(), title: items.map(knowledgeConditionText).join(" · ").slice(0, 160),
      conditions: { version: 1, scope: "natal", match: "all", items } };
  } catch { return null; }
}
