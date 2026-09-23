import { DateTime } from "luxon";
import { constants, jdut1_to_utc, lun_eclipse_when, sol_eclipse_when_glob } from "sweph";
import { createEventSearchSession } from "./swiss-ephemeris";
import { calculateAspectsBetween } from "./aspects";
import { MAJOR_ASPECT_ANGLES, ZODIAC_SIGNS } from "./constants";
import type { Aspect, AspectType, ChartPoint, NatalCalculationInput } from "./types";

export const EVENT_PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
export const EVENT_KINDS = ["ingress", "station", "new-moon", "full-moon", "solar-eclipse", "lunar-eclipse"] as const;
export type EventKind = typeof EVENT_KINDS[number];
export type EventPlanet = typeof EVENT_PLANETS[number];
export type EventSearchInput = { natal: NatalCalculationInput; from: string; until: string; kinds: EventKind[]; planets: EventPlanet[]; aspectOrb: number };
export type AstronomicalEvent = {
  id: string; kind: EventKind; exactAt: string; pointKey: string; longitude: number; sign: string; signDegree: number;
  fromSign?: string; toSign?: string; motion?: "direct" | "retrograde"; eclipseType?: string; natalAspects: Aspect[];
};
const normalize = (angle: number) => (angle % 360 + 360) % 360;
const delta = (angle: number, target: number) => normalize(angle - target + 180) - 180;
const DAY = 86400000;

// Bisection requires a bracket: never substitute the nearest endpoint for a missing root.
export function refineEventRoot(valueAt: (time: number) => number, start: number, end: number): number | null {
  let a = start, b = end, fa = valueAt(a), fb = valueAt(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) throw new Error("Некоректні ефемериди під час уточнення події.");
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;
  for (let index = 0; index < 64 && b - a > 1000; index++) {
    const middle = (a + b) / 2, value = valueAt(middle);
    if (!Number.isFinite(value)) throw new Error("Некоректні ефемериди під час уточнення події.");
    if (value === 0) return middle;
    if (fa * value < 0) { b = middle; fb = value; } else { a = middle; fa = value; }
  }
  return (a + b) / 2;
}

export function angularEventCrossing(valueAt: (time: number) => number, target: number, start: number, end: number): number | null {
  const a = delta(valueAt(start), target), b = delta(valueAt(end), target);
  if (Math.abs(a - b) >= 180 || a * b > 0) return null;
  return refineEventRoot((time) => delta(valueAt(time), target), start, end);
}

export function searchAstronomicalEvents(input: EventSearchInput) {
  const from = Date.parse(input.from), until = Date.parse(input.until);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until - from > 93 * DAY ||
    new Date(from).getUTCFullYear() < 1900 || new Date(until - 1).getUTCFullYear() > 2100 ||
    !input.kinds.length || input.kinds.some((kind) => !EVENT_KINDS.includes(kind)) || !input.planets.length || input.planets.some((planet) => !EVENT_PLANETS.includes(planet)) ||
    !Number.isFinite(input.aspectOrb) || input.aspectOrb < 0 || input.aspectOrb > 5) throw new Error("Період пошуку: до 93 днів у межах 1900–2100 років; орбіс: 0–5°.");
  const rawSession = createEventSearchSession(input.natal);
  const cache = new Map<string, ReturnType<typeof rawSession.position>>();
  const session = { ...rawSession, position: (time: number, key: string) => {
    const cacheKey = `${key}:${time}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const result = rawSession.position(time, key);
    cache.set(cacheKey, result);
    return result;
  } };
  const events: AstronomicalEvent[] = [];
  const targets = session.natal.bodies.filter((point) => EVENT_PLANETS.includes(point.key as EventPlanet));
  const orbs = Object.fromEntries(Object.keys(MAJOR_ASPECT_ANGLES).map((key) => [key, input.aspectOrb])) as Record<AspectType, number>;
  const makePoint = (time: number, key: string): ChartPoint => {
    const position = session.position(time, key);
    const index = Math.floor(position.longitude / 30);
    return { key, label: key, kind: "body", ...position, sign: ZODIAC_SIGNS[index]!, signDegree: position.longitude - index * 30 };
  };
  const add = (kind: EventKind, time: number, pointKey: string, extra: Partial<AstronomicalEvent> = {}) => {
    time = Math.round(time);
    if (time < from || time >= until || events.some((event) => event.kind === kind && event.pointKey === pointKey && Math.abs(Date.parse(event.exactAt) - time) < 2000)) return;
    const point = makePoint(time, pointKey);
    const aspectPoints = kind === "ingress" || kind === "station" ? [point] : [makePoint(time, "sun"), makePoint(time, "moon")];
    const natalAspects = calculateAspectsBetween(aspectPoints, targets, orbs, input.natal.pointOrbs).map((aspect) => {
      const moving = aspectPoints.find((item) => item.key === aspect.bodyA)!;
      const target = targets.find((item) => item.key === aspect.bodyB)!;
      const distance = Math.abs(delta(moving.longitude, target.longitude));
      return { ...aspect, orb: Math.abs(distance - aspect.exactAngle) };
    });
    const exactAt = new Date(Math.round(time)).toISOString();
    events.push({ id: `${kind}:${pointKey}:${exactAt}`, kind, exactAt, pointKey, longitude: point.longitude, sign: point.sign, signDegree: point.signDegree, natalAspects, ...extra });
  };
  const step = 6 * 3600000;
  for (let start = from; start < until; start += step) {
    const end = Math.min(until, start + step);
    if (input.kinds.includes("ingress") || input.kinds.includes("station")) for (const key of new Set(input.planets)) {
      const a = session.position(start, key), b = session.position(end, key);
      const station = a.speed * b.speed <= 0 ? refineEventRoot((time) => session.position(time, key).speed, start, end) : null;
      if (station !== null && input.kinds.includes("station")) {
        const before = session.position(station - 60000, key).speed, after = session.position(station + 60000, key).speed;
        if (before * after < 0) add("station", station, key, { motion: after < 0 ? "retrograde" : "direct" });
      }
      if (!input.kinds.includes("ingress")) continue;
      const bounds = station !== null && station > start && station < end ? [start, station, end] : [start, end];
      for (let part = 0; part < bounds.length - 1; part++) for (let boundary = 0; boundary < 360; boundary += 30) {
        const time = angularEventCrossing((t) => session.position(t, key).longitude, boundary, bounds[part]!, bounds[part + 1]!);
        if (time === null) continue;
        const before = session.position(time - 2000, key), after = session.position(time + 2000, key);
        const fromIndex = Math.floor(before.longitude / 30), toIndex = Math.floor(after.longitude / 30);
        if (fromIndex !== toIndex) add("ingress", time, key, { fromSign: ZODIAC_SIGNS[fromIndex], toSign: ZODIAC_SIGNS[toIndex], motion: after.speed < 0 ? "retrograde" : "direct" });
      }
    }
    for (const [kind, target] of [["new-moon", 0], ["full-moon", 180]] as const) {
      if (!input.kinds.includes(kind)) continue;
      const time = angularEventCrossing((t) => normalize(session.position(t, "moon").longitude - session.position(t, "sun").longitude), target, start, end);
      if (time !== null) add(kind, time, "moon");
    }
    cache.clear();
  }
  for (const kind of ["solar-eclipse", "lunar-eclipse"] as const) {
    if (!input.kinds.includes(kind)) continue;
    let cursor = session.julianUt(from - 1000);
    for (let index = 0; index < 20; index++) {
      const result = kind === "solar-eclipse" ? sol_eclipse_when_glob(cursor, constants.SEFLG_SWIEPH, 0, false) : lun_eclipse_when(cursor, constants.SEFLG_SWIEPH, 0, false);
      if (result.flag < 0 || !Number.isFinite(result.data[0]) || result.data[0] <= cursor) throw new Error(result.error || "Не вдалося знайти затемнення.");
      if (result.error) session.warnings.push({ code: "ECLIPSE_EPHEMERIS_WARNING", message: result.error });
      const date = jdut1_to_utc(result.data[0], constants.SE_GREG_CAL);
      const time = DateTime.utc(date.year, date.month, date.day, date.hour, date.minute).toMillis() + date.second * 1000;
      if (time >= until) break;
      const eclipseType = result.flag & constants.SE_ECL_ANNULAR_TOTAL ? "hybrid" : result.flag & constants.SE_ECL_TOTAL ? "total" : result.flag & constants.SE_ECL_ANNULAR ? "annular" : result.flag & constants.SE_ECL_PARTIAL ? "partial" : "penumbral";
      add(kind, time, kind === "solar-eclipse" ? "sun" : "moon", { eclipseType });
      cursor = result.data[0] + 1;
    }
  }
  return { generatedAt: new Date().toISOString(), from: new Date(from).toISOString(), until: new Date(until).toISOString(),
    zodiac: session.natal.settings.zodiac, ayanamsa: session.natal.settings.zodiac === "sidereal" ? session.natal.settings.ayanamsa ?? "lahiri" : null,
    kinds: [...new Set(input.kinds)], planets: [...new Set(input.planets)], aspectOrb: input.aspectOrb, samplingHours: 6, timeToleranceSeconds: 1,
    events: events.sort((a, b) => Date.parse(a.exactAt) - Date.parse(b.exactAt)), warnings: session.warnings };
}
