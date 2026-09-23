import type { ChartResult, ForecastTimelineEvent } from "./chart-types";
import { ConsultationError } from "./consultations";
export type PrintChart = Pick<ChartResult, "settings" | "bodies" | "angles" | "houses" | "aspects"> & { warnings?: ChartResult["warnings"] };
export type PrintEvent = Pick<ForecastTimelineEvent, "id" | "source" | "exactAt" | "bodyA" | "bodyB" | "aspectType" | "exactAngle" | "orb">;
export type PrintAssets = { natal: PrintChart | null; forecast: null | {
  id: string; title: string; subjectName: string; generatedAt: string; compatibility: "match" | "different" | "unknown";
  solarReturn: { exactAt: string; validUntil?: string; chart: PrintChart } | null; events: PrintEvent[];
  warnings?: ChartResult["warnings"];
} };
export const printHouseLabels: Record<string, string> = {
  koch: "Кох", placidus: "Плацидус", "whole-sign": "Цілознакова", equal: "Рівнодомна",
  campanus: "Кампанус", regiomontanus: "Регіомонтан", porphyry: "Порфирій"
};
export const printPlanetOrder = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
export const printAspects = (chart: PrintChart) => chart.aspects.filter((aspect) => printPlanetOrder.includes(aspect.bodyA) && printPlanetOrder.includes(aspect.bodyB));
export const printPoints = (chart: PrintChart) => {
  const order = [...printPlanetOrder, "north-node", "south-node", "chiron", "lilith", "asc", "desc", "ic", "mc"];
  return [...chart.bodies, ...chart.angles].sort((a, b) => (order.indexOf(a.key) < 0 ? 100 : order.indexOf(a.key)) - (order.indexOf(b.key) < 0 ? 100 : order.indexOf(b.key)));
};
export const printDegree = (value: number) => {
  const seconds = Math.min(107999, Math.floor(value * 3600 + 0.000001));
  return `${Math.floor(seconds / 3600)}°${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}′${String(seconds % 60).padStart(2, "0")}″`;
};
export const printUtc = (value: string) => new Date(value).toISOString().replace("T", " ").replace("Z", " UTC");
export const printMethodLabels: Record<PrintEvent["source"], string> = {
  transit: "Транзит", "solar-return": "Соляр", "lunar-return": "Лунар", "secondary-progression": "Вторинна прогресія (розрахункова дата)", "solar-arc": "Сонячна дуга (розрахункова дата)"
};
export function printEvents(forecast: NonNullable<PrintAssets["forecast"]>): PrintEvent[] {
  const events = [...forecast.events];
  const solar = forecast.solarReturn;
  if (solar && !events.some((event) => event.source === "solar-return" && new Date(event.exactAt).getTime() === new Date(solar.exactAt).getTime())) {
    events.push({ id: "solar-return", source: "solar-return", exactAt: solar.exactAt });
  }
  return events.sort((a, b) => new Date(a.exactAt).getTime() - new Date(b.exactAt).getTime())
    .map((event, index) => ({ ...event, id: `${index}:${event.id}` }));
}
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function request<T>(token: string, id: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}/consultations/${encodeURIComponent(id)}/${path}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ConsultationError(body?.message ?? "Не вдалося завантажити дані для друку.", response.status);
  }
  return response.json() as Promise<T>;
}
export const getPrintAssets = (token: string, id: string, revision: number, forecastId?: string) => {
  const params = new URLSearchParams({ revision: String(revision) });
  if (forecastId) params.set("forecastId", forecastId);
  return request<PrintAssets>(token, id, `print-assets?${params}`);
};
export const listPrintForecasts = (token: string, id: string, query: string, cursor?: string) => {
  const params = new URLSearchParams({ query });
  if (cursor) params.set("cursor", cursor);
  return request<{ forecasts: Array<{ id: string; title: string; createdAt: string }>; nextCursor: string | null }>(token, id, `print-forecasts?${params}`);
};
