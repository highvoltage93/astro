import type { Aspect, ChartPoint } from "./chart-types";
import { emptyKnowledgeDraft, knowledgeConditionText, type KnowledgeDraft, type NoteCondition } from "./knowledge-notes";
import { aspectLabels, planetLabelsUk } from "./astrology-labels";

const planets = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "lilith", "north-node", "south-node"]);
const signs = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const aspects = new Set(["conjunction", "sextile", "square", "trine", "opposition"]);
export type KnowledgeSeed = { version: 1; items: NoteCondition[] };
export type KnowledgeSourceContext = { sourceProfileId?: string; birthTimeKnown: boolean };

const forecastSources: Record<string, string> = {
  transit: "Транзит", "secondary-progression": "Повільна прогресія", "solar-return": "Соляр", "lunar-return": "Лунар", "solar-arc": "Сонячна дуга"
};
type ForecastSeedSource = { source: string; exactAt: string; bodyA?: string; bodyB?: string; aspect?: string };

// Only astronomical facts enter the URL, never client names, event notes or chart details.
export function forecastKnowledgeSeedHref(row: ForecastSeedSource): string | undefined {
  const raw = JSON.stringify({ version: 2, kind: "forecast-context", source: row.source, exactAt: row.exactAt,
    ...(row.bodyA ? { bodyA: row.bodyA } : {}), ...(row.bodyB ? { bodyB: row.bodyB } : {}), ...(row.aspect ? { aspect: row.aspect } : {}) });
  return knowledgeSeedDraft(raw) ? `/knowledge?${new URLSearchParams({ seed: raw })}` : undefined;
}

function forecastSeedDraft(value: Record<string, unknown>): KnowledgeDraft | null {
  if (Object.keys(value).some((key) => !["version", "kind", "source", "exactAt", "bodyA", "bodyB", "aspect"].includes(key)) || value.kind !== "forecast-context") return null;
  if (typeof value.source !== "string" || !Object.hasOwn(forecastSources, value.source) || typeof value.exactAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.exactAt) || !Number.isFinite(Date.parse(value.exactAt))) return null;
  for (const key of ["bodyA", "bodyB"] as const) {
    const point = value[key];
    if (point !== undefined && (typeof point !== "string" || (!planets.has(point) && !/^house-(?:[1-9]|1[0-2])$/.test(point) && !["asc", "mc", "ic", "dsc"].includes(point)))) return null;
  }
  if (value.aspect !== undefined && (typeof value.aspect !== "string" || ![...aspects, "semisextile", "quincunx"].includes(value.aspect))) return null;
  const label = (point: unknown) => typeof point === "string" ? planetLabelsUk[point] ?? point : "";
  const title = [forecastSources[value.source], label(value.bodyA), typeof value.aspect === "string" ? aspectLabels[value.aspect] ?? value.aspect : "", label(value.bodyB)].filter(Boolean).join(" · ");
  return { ...emptyKnowledgeDraft(), title: title.slice(0, 160), archived: true,
    body: `${title}\nЕкзакт: ${new Date(value.exactAt).toISOString()} (UTC).\n\nРезультат спостереження:\n`,
    conditions: { version: 1, scope: "natal", match: "all", items: [] } };
}

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
    if (value.version === 2) return forecastSeedDraft(value);
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
