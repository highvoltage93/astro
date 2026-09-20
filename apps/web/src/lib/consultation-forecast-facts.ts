import { consultationContentSchema } from "@astroprocessor/consultation-format";
import type { ConsultationContent } from "@astroprocessor/consultation-format";
import type { SavedForecast } from "./forecast-archive";
import type { Aspect, ForecastTimelineSource } from "./chart-types";
import { aspectLabels, planetLabelsUk } from "./astrology-labels";
import { appendConsultationFacts, consultationFacts } from "./consultation-facts";

export type ForecastFact = { id: string; text: string };
const methods: Record<ForecastTimelineSource, string> = {
  transit: "Транзит", "solar-return": "Соляр", "lunar-return": "Лунар",
  "secondary-progression": "Вторинна прогресія", "solar-arc": "Дирекція сонячної дуги"
};
const utc = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").replace("Z", " UTC") : "дату не визначено";
};
const aspectText = (aspect: Aspect) =>
  `${planetLabelsUk[aspect.bodyA] ?? aspect.bodyA} — натальний ${planetLabelsUk[aspect.bodyB] ?? aspect.bodyB}: ` +
  `${aspectLabels[aspect.type] ?? aspect.type}; кут аспекту ${aspect.exactAngle}°; орбіс ${aspect.orb.toFixed(4)}°`;

export function consultationForecastFacts(forecast: SavedForecast): ForecastFact[] {
  if (forecast.kind === "synastry") return [];
  if (forecast.kind === "transit") return forecast.result.transitToNatalAspects.map((aspect, index) => ({
    id: `transit:${index}:${aspect.bodyA}:${aspect.bodyB}:${aspect.type}`,
    text: `Транзит на ${utc(forecast.input.parameters.transitDateTime)}. ${aspectText(aspect)}. ` +
      (aspect.exactAt ? `Розрахункова дата точного аспекту: ${utc(aspect.exactAt)}.` : "Точну дату не визначено.") +
      (aspect.activeFrom ? ` Початок орбісу: ${utc(aspect.activeFrom)}.` : "") +
      (aspect.activeUntil ? ` Кінець орбісу: ${utc(aspect.activeUntil)}.` : "")
  }));
  const facts: ForecastFact[] = [];
  for (const event of [forecast.result.solarReturn, forecast.result.lunarReturn]) {
    if (!event) continue;
    const method = event.kind === "solar" ? "Соляр" : "Лунар";
    facts.push({ id: `${event.kind}:return`, text: `${method}: повернення ${utc(event.exactAt)}.` +
      (event.validUntil ? ` Наступне повернення: ${utc(event.validUntil)}.` : "") });
    for (const fact of consultationFacts(event.chart).filter((item) => item.category === "placements")) {
      facts.push({ id: `${event.kind}:${fact.id}`, text: `${method} (${utc(event.exactAt)}). ${fact.text}` });
    }
    event.returnToNatalAspects.forEach((aspect, index) => facts.push({
      id: `${event.kind}:aspect:${index}`, text: `${method} (${utc(event.exactAt)}). ${aspectText(aspect)}.`
    }));
  }
  for (const event of forecast.result.timelineEvents ?? []) {
    if ((event.source === "solar-return" && forecast.result.solarReturn) ||
      (event.source === "lunar-return" && forecast.result.lunarReturn)) continue;
    const estimated = event.source === "secondary-progression" || event.source === "solar-arc";
    facts.push({ id: `timeline:${event.id}`, text: `${methods[event.source]}. ${estimated ? "Розрахункова дата" : "Дата події"}: ${utc(event.exactAt)}. ` +
      (event.bodyA && event.bodyB ? `${planetLabelsUk[event.bodyA] ?? event.bodyA} — натальний ${planetLabelsUk[event.bodyB] ?? event.bodyB}. ` : "") +
      (event.aspectType ? `${aspectLabels[event.aspectType] ?? event.aspectType}. ` : "") +
      (event.exactAngle !== undefined ? `Кут аспекту ${event.exactAngle}°. ` : "") +
      (event.orb !== undefined ? `Орбіс ${event.orb.toFixed(4)}°. ` : "") +
      (event.activeFrom ? `Початок орбісу: ${utc(event.activeFrom)}. ` : "") +
      (event.activeUntil ? `Кінець орбісу: ${utc(event.activeUntil)}.` : "") });
  }
  return facts;
}

export function importedForecastEvents(content: ConsultationContent, forecastId: string): Set<string> {
  return new Set(content.sections.flatMap((section) => section.forecastSources ?? [])
    .filter((source) => source.forecastId === forecastId).map((source) => source.eventId));
}

export function appendForecastFacts(content: ConsultationContent, target: string, forecast: SavedForecast, ids: string[], newId: string): ConsultationContent {
  if (forecast.kind === "synastry") throw new Error("Вибери прогноз або транзити.");
  const imported = importedForecastEvents(content, forecast.id);
  const facts = consultationForecastFacts(forecast).filter((fact) => ids.includes(fact.id) && !imported.has(fact.id));
  if (!facts.length) throw new Error("Вибрані події вже додано або вони недоступні.");
  const parameters = forecast.input.parameters;
  const header = `Прогноз: ${forecast.title}. Особа: ${forecast.input.context.subject.displayName}. ` +
    `Знімок розрахунку: ${forecast.result.generatedAt}. Дати подій: UTC. ` +
    `Часовий пояс народження: ${parameters.natal.timezone}; система домів: ${parameters.natal.houseSystem}; зодіак: ${parameters.zodiac ?? parameters.natal.zodiac}.` +
    (forecast.kind === "forecast" ? ` Місце повернення: ${forecast.input.parameters.returnLatitude ?? parameters.natal.latitude}, ${forecast.input.parameters.returnLongitude ?? parameters.natal.longitude}.` : "");
  const result = appendConsultationFacts(content, target, [header, ...facts.map((fact) => fact.text)], newId, "Прогнозні події");
  const section = result.sections.find((item) => item.id === (target === "new" ? newId : target))!;
  section.forecastSources = [...(section.forecastSources ?? []), ...facts.map((fact) => ({
    forecastId: forecast.id, eventId: fact.id, generatedAt: forecast.result.generatedAt, timezone: "UTC" as const
  }))];
  const parsed = consultationContentSchema.safeParse(result);
  if (!parsed.success) throw new Error("Перевищено ліміт документа або джерел у розділі.");
  return parsed.data;
}
