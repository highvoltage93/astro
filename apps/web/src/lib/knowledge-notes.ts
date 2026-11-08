import { AUTH_TOKEN_STORAGE_KEY } from "./auth-storage";
import type { ChartResult } from "./chart-types";
import { aspectLabels, planetLabelsUk, signLabelsUk } from "./astrology-labels";

export type NoteCondition =
  | { kind: "house"; planet: string; house: number }
  | { kind: "sign"; planet: string; sign: string }
  | { kind: "aspect"; planet: string; otherPlanet: string; aspect: string }
  | { kind: "retrograde"; planet: string };
export type KnowledgeDraft = { title: string; body: string; tags: string[]; archived: boolean;
  conditions: { version: 1; scope: "natal"; match: "all"; items: NoteCondition[] } };
export type KnowledgeSummary = { id: string; title: string; tags: string[]; archived: boolean; revision: number; createdAt: string; updatedAt: string };
export type KnowledgeNote = KnowledgeSummary & KnowledgeDraft & { sourceProfileId: string | null; sourceLabel: string | null };
export type KnowledgeHistoryEntry = KnowledgeDraft & { revision: number; savedAt: string };
export type KnowledgeHistory = { history: { revision: number; title: string; savedAt: string }[]; nextBefore: number | null };
export type KnowledgeMatch = KnowledgeSummary & Pick<KnowledgeDraft, "conditions">;
export type KnowledgeMatchesPage = { matches: KnowledgeMatch[]; nextCursor: string | null };
export const knowledgeChartFacts = (chart: ChartResult) => ({
  chartType: chart.chartType,
  birthTimeKnown: chart.subject.birthTimeKnown,
  bodies: chart.bodies.map(({ key, sign, house, speed }) => ({ key, sign,
    ...(house !== undefined ? { house } : {}), ...(speed !== undefined ? { speed } : {}) })),
  aspects: chart.aspects.map(({ bodyA, bodyB, type }) => ({ bodyA, bodyB, type }))
});
export function knowledgeConditionText(item: NoteCondition): string {
  const planet = planetLabelsUk[item.planet] ?? item.planet;
  if (item.kind === "house") return `${planet} у ${item.house} домі`;
  if (item.kind === "sign") return `${planet}: ${signLabelsUk[item.sign] ?? item.sign}`;
  if (item.kind === "aspect") return `${planet} · ${aspectLabels[item.aspect] ?? item.aspect} · ${planetLabelsUk[item.otherPlanet] ?? item.otherPlanet}`;
  return `${planet}: ретроградність`;
}
export const emptyKnowledgeDraft = (): KnowledgeDraft => ({ title: "", body: "", tags: [], archived: false,
  conditions: { version: 1, scope: "natal", match: "all", items: [{ kind: "house", planet: "mercury", house: 5 }] } });
export const noteDraft = (note: KnowledgeDraft): KnowledgeDraft => ({ title: note.title, body: note.body, tags: [...note.tags],
  archived: note.archived, conditions: structuredClone(note.conditions) });
export class KnowledgeError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function knowledgeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) throw new KnowledgeError("Увійдіть до акаунта.", 401);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/knowledge-notes${path}`, {
    ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = await response.json().catch(() => null);
  if (localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) !== token) throw new KnowledgeError("Обліковий запис змінився.", 401);
  if (!response.ok) throw new KnowledgeError(body?.message ?? "Не вдалося виконати запит. Ваш текст залишився у формі.", response.status);
  return body as T;
}
