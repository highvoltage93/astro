import { DateTime } from "luxon";
import type { SavedForecast } from "./forecast-archive";
import { aspectLabels, planetLabelsUk } from "./astrology-labels";

export type ComparisonRow = { source: string; exactAt: string; bodyA?: string; bodyB?: string; aspect?: string; title: string };
const sources: Record<string, string> = { transit: "Транзит", "secondary-progression": "Повільна прогресія", "solar-return": "Соляр", "lunar-return": "Лунар", "solar-arc": "Сонячна дуга" };

export function savedForecastExacts(forecast: SavedForecast): ComparisonRow[] {
  if (forecast.schemaVersion !== 1 || forecast.result.chartType !== forecast.kind) throw new Error("Ця версія прогнозу не підтримується.");
  if (forecast.kind === "synastry") return [];
  const rows: ComparisonRow[] = [];
  function add(source: string, exactAt: string | null | undefined, bodyA?: string, bodyB?: string, aspect?: string) {
    if (!exactAt || !DateTime.fromISO(exactAt, { setZone: true }).isValid) return;
    rows.push({ source, exactAt, bodyA, bodyB, aspect,
      title: [sources[source] ?? source, bodyA ? planetLabelsUk[bodyA] ?? bodyA : "", aspect ? aspectLabels[aspect] ?? aspect : "", bodyB ? planetLabelsUk[bodyB] ?? bodyB : ""].filter(Boolean).join(" · ") });
  }
  if (forecast.kind === "transit") {
    for (const aspect of forecast.result.transitToNatalAspects) add("transit", aspect.exactAt, aspect.bodyA, aspect.bodyB, aspect.type);
  } else {
    for (const row of forecast.result.timelineEvents ?? []) {
      if ((row.source === "solar-return" && forecast.result.solarReturn) || (row.source === "lunar-return" && forecast.result.lunarReturn)) continue;
      add(row.source, row.exactAt, row.bodyA, row.bodyB, row.aspectType);
    }
    for (const row of forecast.result.exactTransits ?? []) add("transit", row.exactAt, row.bodyA, row.bodyB, row.type);
    for (const row of forecast.result.secondaryProgression?.calendar ?? []) add("secondary-progression", row.exactAt, row.bodyA, row.bodyB, row.type);
    for (const item of [forecast.result.solarReturn, forecast.result.lunarReturn]) if (item) add(`${item.kind}-return`, item.exactAt);
  }
  const unique = new Map<string, ComparisonRow>();
  for (const row of rows) {
    const key = [row.source, DateTime.fromISO(row.exactAt).toMillis(), row.bodyA ?? "", row.bodyB ?? "", row.aspect ?? ""].join(":");
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) => DateTime.fromISO(a.exactAt).toMillis() - DateTime.fromISO(b.exactAt).toMillis());
}

export function compareEventDates(rows: ComparisonRow[], eventDate: string, days: number, timezone: string) {
  const day = DateTime.fromISO(eventDate.slice(0, 10), { zone: timezone }).startOf("day");
  if (!day.isValid || ![0, 7, 30, 90].includes(days)) return [];
  return rows.flatMap((row) => {
    const exact = DateTime.fromISO(row.exactAt, { setZone: true }).setZone(timezone);
    if (!exact.isValid) return [];
    const offset = Math.round(exact.startOf("day").diff(day, "days").days);
    return Math.abs(offset) <= days ? [{ ...row, offset, localDate: exact.toFormat("dd.MM.yyyy HH:mm") }] : [];
  });
}
