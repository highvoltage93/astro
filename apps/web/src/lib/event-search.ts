import type { Aspect, NatalPreviewPayload } from "./chart-types";
export const eventKindLabels = { ingress: "Інгресії у знаки", station: "Розвороти планет", "new-moon": "Молодики", "full-moon": "Повні", "solar-eclipse": "Сонячні затемнення", "lunar-eclipse": "Місячні затемнення" } as const;
export type EventKind = keyof typeof eventKindLabels;
export const eventPlanetKeys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
export type SearchEvent = { id: string; kind: EventKind; exactAt: string; pointKey: string; longitude: number; sign: string; signDegree: number;
  fromSign?: string; toSign?: string; motion?: "direct" | "retrograde"; eclipseType?: string; natalAspects: Aspect[] };
export type EventSearchResult = { generatedAt: string; from: string; until: string; zodiac: string; ayanamsa: string | null;
  kinds: EventKind[]; planets: string[]; aspectOrb: number; samplingHours: number; timeToleranceSeconds: number; events: SearchEvent[]; warnings: Array<{ code: string; message: string }> };
export const searchEvents = async (token: string, input: { natal: NatalPreviewPayload; from: string; until: string; kinds: EventKind[]; planets: string[]; aspectOrb: number }, signal: AbortSignal): Promise<EventSearchResult> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/charts/events/search`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(input), signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Пошук подій недоступний.");
  }
  return response.json() as Promise<EventSearchResult>;
};
