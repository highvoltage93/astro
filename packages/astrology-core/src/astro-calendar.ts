import { DateTime } from "luxon";
import { constants, jdut1_to_utc, lun_eclipse_when, rise_trans, sol_eclipse_when_glob } from "sweph";
import { angularEventCrossing, EVENT_PLANETS, refineEventRoot, type EventPlanet } from "./event-search";
import { createEventSearchSession } from "./swiss-ephemeris";
import { ZODIAC_SIGNS } from "./constants";

export const CALENDAR_CATEGORIES = ["lunar-days", "void-moon", "moon-phases", "retrograde", "eclipses", "ingress"] as const;
export type CalendarCategory = typeof CALENDAR_CATEGORIES[number];
export type AstroCalendarInput = {
  from: string; until: string; category: CalendarCategory; planet?: EventPlanet;
  latitude: number; longitude: number; lunarDayMethod: "moonrise" | "tithi"; ephemerisPath?: string;
};
export type CalendarRow = {
  id: string; kind: string; start: string; end?: string; pointKey?: string; sign?: string; toSign?: string;
  degree?: number; motion?: "direct" | "retrograde"; day?: number; aspectAngle?: number;
  clippedStart?: boolean; clippedEnd?: boolean; eclipses?: { at: string; kind: string; type: string }[];
};
export type CalendarEphemeris = {
  position: (time: number, key: string) => { longitude: number; speed: number };
  moonriseAfter: (time: number) => number | null;
  eclipses: (from: number, until: number) => { time: number; kind: string; type: string }[];
  warnings: { code: string; message: string }[];
};
const DAY = 86400000;
const STEP = DAY / 8;
const normalize = (angle: number) => (angle % 360 + 360) % 360;
const iso = (time: number) => new Date(Math.round(time)).toISOString();
const overlap = (start: number, end: number, from: number, until: number) => start < until && end > from;

export function validateCalendarInput(input: AstroCalendarInput) {
  const from = Date.parse(input.from), until = Date.parse(input.until);
  const moon = ["lunar-days", "void-moon", "moon-phases"].includes(input.category);
  if (!CALENDAR_CATEGORIES.includes(input.category) || !Number.isFinite(from) || !Number.isFinite(until) || until <= from ||
    until - from > (moon ? 32 : 367) * DAY || new Date(from).getUTCFullYear() < 1900 || new Date(until - 1).getUTCFullYear() > 2100 ||
    !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180 ||
    !["moonrise", "tithi"].includes(input.lunarDayMethod) || (input.planet && !EVENT_PLANETS.includes(input.planet))) {
    throw new Error("Перевірте період, планету та координати. Місячні події: до 32 днів; інші: до року, 1900–2100.");
  }
  return { from, until };
}

// Pure orchestration over an ephemeris adapter, separate from personal forecast calculations.
export function buildAstroCalendar(input: AstroCalendarInput, engine: CalendarEphemeris) {
  const { from, until } = validateCalendarInput(input);
  const cache = new Map<string, ReturnType<CalendarEphemeris["position"]>>();
  const position = (time: number, key: string) => {
    const id = `${key}:${time}`;
    const cached = cache.get(id);
    if (cached) return cached;
    const result = engine.position(time, key);
    if (!Number.isFinite(result.longitude) || !Number.isFinite(result.speed)) throw new Error("Некоректні ефемериди.");
    if (cache.size >= 20000) cache.clear();
    cache.set(id, result); return result;
  };
  const rows: CalendarRow[] = [];
  const add = (kind: string, start: number, extra: Omit<CalendarRow, "id" | "kind" | "start"> = {}) => {
    rows.push({ id: `${kind}:${extra.pointKey ?? "moon"}:${Math.round(start)}`, kind, start: iso(start), ...extra });
  };
  const location = (time: number, key: string) => {
    const longitude = normalize(position(time, key).longitude);
    return { sign: ZODIAC_SIGNS[Math.floor(longitude / 30)]!, degree: longitude % 30 };
  };
  const roots = (start: number, end: number, value: (time: number) => number, targets: number[]) => {
    const result: { time: number; angle: number }[] = [];
    for (let a = start; a < end; a += STEP) for (const angle of targets) {
      const time = angularEventCrossing(value, angle, a, Math.min(a + STEP, end));
      if (time !== null && time >= start && time < end && !result.some((row) => row.angle === angle && Math.abs(row.time - time) < 2000)) result.push({ time, angle });
    }
    return result.sort((a, b) => a.time - b.time);
  };
  const elongation = (time: number) => normalize(position(time, "moon").longitude - position(time, "sun").longitude);

  if (input.category === "ingress" || input.category === "retrograde") {
    for (const key of input.planet ? [input.planet] : EVENT_PLANETS) {
      const stations: { time: number; motion: "direct" | "retrograde" }[] = [];
      const ingresses: { time: number; fromSign: string; toSign: string; motion: "direct" | "retrograde" }[] = [];
      for (let a = from; a < until; a += STEP * 2) {
        const b = Math.min(a + STEP * 2, until);
        const first = position(a, key), last = position(b, key);
        const station = first.speed * last.speed <= 0 ? refineEventRoot((t) => position(t, key).speed, a, b) : null;
        if (station !== null && station < until && position(station - 2000, key).speed * position(station + 2000, key).speed < 0 && !stations.some((row) => Math.abs(row.time - station) < 2000)) {
          stations.push({ time: station, motion: position(station + 2000, key).speed < 0 ? "retrograde" : "direct" });
        }
        if (input.category !== "ingress") continue;
        const bounds = station !== null && station > a && station < b ? [a, station, b] : [a, b];
        for (let index = 0; index < bounds.length - 1; index++) for (let angle = 0; angle < 360; angle += 30) {
          const time = angularEventCrossing((t) => position(t, key).longitude, angle, bounds[index]!, bounds[index + 1]!);
          if (time === null || time < from || time >= until || ingresses.some((row) => Math.abs(row.time - time) < 2000)) continue;
          const before = location(time - 2000, key).sign, after = location(time + 2000, key).sign;
          if (before !== after) ingresses.push({ time, fromSign: before, toSign: after, motion: position(time + 2000, key).speed < 0 ? "retrograde" : "direct" });
        }
      }
      if (input.category === "ingress") {
        ingresses.forEach((row) => add("ingress", row.time, { pointKey: key, sign: row.fromSign, toSign: row.toSign, motion: row.motion }));
      } else {
        let start: number | null = position(from + 1000, key).speed < 0 ? from : null;
        let clippedStart = start !== null;
        for (const station of stations.sort((a, b) => a.time - b.time)) {
          if (station.motion === "retrograde") { start = station.time; clippedStart = false; }
          else if (start !== null) {
            if (station.time > start) add("retrograde", start, { pointKey: key, end: iso(station.time), clippedStart, clippedEnd: false, ...location(start, key) });
            start = null;
          }
        }
        if (start !== null && start < until) add("retrograde", start, { pointKey: key, end: iso(until), clippedStart, clippedEnd: true, ...location(start, key) });
      }
    }
  } else if (input.category === "moon-phases") {
    const kinds: Record<number, string> = { 0: "new-moon", 90: "first-quarter", 180: "full-moon", 270: "last-quarter" };
    roots(from, until, elongation, [0, 90, 180, 270]).forEach(({ time, angle }) => add(kinds[angle]!, time, location(time, "moon")));
  } else if (input.category === "lunar-days") {
    const moons = roots(from - 35 * DAY, until + 35 * DAY, elongation, [0]).map((row) => row.time);
    for (let index = 0; index < moons.length - 1; index++) {
      const start = moons[index]!, end = moons[index + 1]!;
      if (!overlap(start, end, from, until)) continue;
      const boundaries = [start];
      if (input.lunarDayMethod === "tithi") {
        boundaries.push(...roots(start + 2000, end - 1000, elongation, Array.from({ length: 29 }, (_, i) => (i + 1) * 12)).map((row) => row.time));
      } else {
        let cursor = start + 1000;
        while (cursor < end) {
          const rise = engine.moonriseAfter(cursor);
          if (rise === null) { cursor += DAY / 2; continue; }
          if (!Number.isFinite(rise) || rise <= cursor) throw new Error("Некоректний час сходу Місяця.");
          if (rise >= end) break;
          boundaries.push(rise); cursor = rise + 1000;
        }
      }
      boundaries.push(end);
      for (let day = 0; day < boundaries.length - 1; day++) {
        if (overlap(boundaries[day]!, boundaries[day + 1]!, from, until)) add("lunar-day", boundaries[day]!, { day: day + 1, end: iso(boundaries[day + 1]!) });
      }
    }
  } else if (input.category === "void-moon") {
    const ingresses = roots(from - 4 * DAY, until + 4 * DAY, (t) => position(t, "moon").longitude, Array.from({ length: 12 }, (_, i) => i * 30));
    for (let index = 0; index < ingresses.length - 1; index++) {
      const start = ingresses[index]!.time, end = ingresses[index + 1]!.time;
      if (!overlap(start, end, from, until)) continue;
      let last: { time: number; key: string; angle: number } | null = null;
      for (const key of EVENT_PLANETS.filter((planet) => planet !== "moon")) {
        for (const aspect of roots(start, end, (t) => normalize(position(t, "moon").longitude - position(t, key).longitude), [0, 60, 90, 120, 180, 240, 270, 300])) {
          if (!last || aspect.time > last.time) last = { ...aspect, key };
        }
      }
      const voidStart = last?.time ?? start;
      if (overlap(voidStart, end, from, until)) add("void-moon", voidStart, { end: iso(end), sign: location(start + 2000, "moon").sign,
        toSign: location(end + 2000, "moon").sign, ...(last ? { pointKey: last.key, aspectAngle: Math.min(last.angle, 360 - last.angle) } : {}) });
    }
  } else {
    const eclipses = engine.eclipses(from - 40 * DAY, until + 40 * DAY).sort((a, b) => a.time - b.time);
    const groups: Array<typeof eclipses> = [];
    for (const event of eclipses) {
      const group = groups.at(-1);
      if (group && event.time - group.at(-1)!.time <= 35 * DAY && event.time - group[0]!.time <= 40 * DAY) group.push(event);
      else groups.push([event]);
    }
    for (const group of groups) {
      const start = group[0]!.time, end = group.at(-1)!.time;
      if (overlap(start, end + 1, from, until)) add("eclipse-corridor", start, { end: iso(end), eclipses: group.map((event) => ({ at: iso(event.time), kind: event.kind, type: event.type })) });
    }
  }
  return { from: iso(from), until: iso(until), category: input.category, lunarDayMethod: input.lunarDayMethod,
    zodiac: "tropical" as const, timeToleranceSeconds: 1, rows: rows.sort((a, b) => a.start.localeCompare(b.start)),
    warnings: engine.warnings.filter((warning) => warning.code !== "UNKNOWN_BIRTH_TIME") };
}

function julianToMilliseconds(julian: number) {
  const date = jdut1_to_utc(julian, constants.SE_GREG_CAL);
  return DateTime.utc(date.year, date.month, date.day, date.hour, date.minute).toMillis() + date.second * 1000;
}

export function calculateAstroCalendar(input: AstroCalendarInput) {
  const { from } = validateCalendarInput(input);
  const session = createEventSearchSession({ birthDate: iso(from).slice(0, 10), birthTime: "12:00:00", birthTimeKnown: false,
    timezone: "UTC", latitude: 0, longitude: 0, zodiac: "tropical", ephemerisPath: input.ephemerisPath });
  return buildAstroCalendar(input, {
    position: session.position, warnings: session.warnings,
    moonriseAfter: (time) => {
      const result = rise_trans(session.julianUt(time), constants.SE_MOON, null, constants.SEFLG_SWIEPH,
        constants.SE_CALC_RISE, [input.longitude, input.latitude, 0], 1013.25, 15);
      if (result.flag === -2) {
        if (!session.warnings.some((warning) => warning.code === "MOONRISE_UNAVAILABLE")) session.warnings.push({ code: "MOONRISE_UNAVAILABLE", message: "Є проміжки без сходу Місяця. Нумерація змінюється лише за фактичним сходом, не щодоби." });
        return null;
      }
      if (result.flag < 0 || !Number.isFinite(result.data)) throw new Error(result.error || "Не вдалося визначити схід Місяця.");
      return julianToMilliseconds(result.data);
    },
    eclipses: (start, end) => {
      const result: { time: number; kind: string; type: string }[] = [];
      for (const kind of ["solar-eclipse", "lunar-eclipse"]) {
        let cursor = session.julianUt(start - 1000);
        for (let attempt = 0; attempt < 20; attempt++) {
          const eclipse = kind === "solar-eclipse" ? sol_eclipse_when_glob(cursor, constants.SEFLG_SWIEPH, 0, false) : lun_eclipse_when(cursor, constants.SEFLG_SWIEPH, 0, false);
          const jd = eclipse.data[0];
          if (eclipse.flag < 0 || jd === undefined || !Number.isFinite(jd) || jd <= cursor) throw new Error(eclipse.error || "Не вдалося визначити затемнення.");
          if (eclipse.error) session.warnings.push({ code: "ECLIPSE_WARNING", message: eclipse.error });
          const time = julianToMilliseconds(jd);
          if (time >= end) break;
          const type = eclipse.flag & constants.SE_ECL_ANNULAR_TOTAL ? "hybrid" : eclipse.flag & constants.SE_ECL_TOTAL ? "total" : eclipse.flag & constants.SE_ECL_ANNULAR ? "annular" : eclipse.flag & constants.SE_ECL_PARTIAL ? "partial" : "penumbral";
          if (time >= start) result.push({ time, kind, type });
          cursor = jd + 1;
        }
      }
      return result;
    }
  });
}
