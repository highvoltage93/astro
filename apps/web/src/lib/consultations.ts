import type { ChartResult } from "./chart-types";
import { consultationContentSchema } from "@astroprocessor/consultation-format";
import type { ConsultationContent } from "@astroprocessor/consultation-format";
export type { ConsultationContent } from "@astroprocessor/consultation-format";

export type ConsultationDraft = { title: string; status: "DRAFT" | "READY"; content: ConsultationContent; privateNotes: string };
export type ConsultationSummary = {
  id: string; title: string; status: "DRAFT" | "READY"; revision: number;
  sourceProfileId: string; sourceCalculationId: string; createdAt: string; updatedAt: string;
};
export type Consultation = ConsultationSummary & ConsultationDraft & {
  source: { displayName: string; birthplaceName: string; birthDate: string; birthTime: string | null;
    birthTimeKnown: boolean; timezone: string; calculatedAt: string; chart: ChartResult };
};
export type ConsultationMutation = ConsultationDraft & { revision: number; mutationId: string };
export type ConsultationVersionSummary = { revision: number; title: string; status: "DRAFT" | "READY"; savedAt: string };
export type ConsultationVersion = ConsultationVersionSummary & ConsultationDraft;
export type ConsultationClientDocument = Pick<Consultation, "id" | "title" | "status" | "revision" | "updatedAt" | "content"> & {
  source: { displayName: string; birthplaceName: string; birthDate: string; birthTime: string | null;
    birthTimeKnown: boolean; timezone: string; calculatedAt: string; houseSystem: string; zodiac: string };
};
export const consultationDraft = (record: Consultation): ConsultationDraft => ({
  title: record.title, status: record.status, content: record.content, privateNotes: record.privateNotes
});
export const consultationTemplate = (name: string): ConsultationDraft => ({
  title: `Консультація: ${name}`.slice(0, 120), status: "DRAFT", privateNotes: "",
  content: { version: 1, sections: ["Запит клієнта", "Основні теми", "Важливі періоди", "Висновки та рекомендації"]
    .map((title) => ({ id: crypto.randomUUID(), title, body: "" })) }
});
export class ConsultationError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function request<T>(token: string, path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}/consultations${path}`, {
    method, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ConsultationError(body?.message ?? "Не вдалося зберегти або відкрити консультацію.", response.status);
  }
  return response.json() as Promise<T>;
}
export const listConsultations = (token: string, sourceProfileId?: string, cursor?: string) => {
  const params = new URLSearchParams();
  if (sourceProfileId) params.set("sourceProfileId", sourceProfileId);
  if (cursor) params.set("cursor", cursor);
  return request<{ consultations: ConsultationSummary[]; nextCursor: string | null }>(token, `?${params}`);
};
export const getConsultation = (token: string, id: string) => request<{ consultation: Consultation }>(token, `/${encodeURIComponent(id)}`);
export const getConsultationClientDocument = (token: string, id: string, revision?: string) => {
  const params = new URLSearchParams();
  if (revision) params.set("revision", revision);
  return request<{ document: ConsultationClientDocument }>(token, `/${encodeURIComponent(id)}/client-document?${params}`);
};
export const createConsultation = (token: string, input: ConsultationDraft & { id: string; sourceProfileId: string }) =>
  request<{ consultation: Consultation }>(token, "", "POST", input);
export const updateConsultation = (token: string, id: string, input: ConsultationMutation) =>
  request<{ consultation: Consultation }>(token, `/${encodeURIComponent(id)}`, "PUT", input);

export const listConsultationHistory = (token: string, id: string, before?: number) =>
  request<{ versions: ConsultationVersionSummary[]; nextBefore: number | null; currentRevision: number }>(token,
    `/${encodeURIComponent(id)}/history${before ? `?before=${before}` : ""}`);
export const getConsultationVersion = (token: string, id: string, revision: number) =>
  request<{ version: ConsultationVersion }>(token, `/${encodeURIComponent(id)}/history/${revision}`);

export function restoreConsultationDraft(current: ConsultationDraft, version: ConsultationDraft, includePrivateNotes: boolean): ConsultationDraft {
  if (!isConsultationDraft(version)) throw new Error("Формат версії не підтримується.");
  return { title: version.title, status: "DRAFT", content: structuredClone(version.content),
    privateNotes: includePrivateNotes ? version.privateNotes : current.privateNotes };
}

export function isConsultationDraft(value: unknown): value is ConsultationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as ConsultationDraft;
  return typeof draft.title === "string" && draft.title.length <= 120 &&
    (draft.status === "DRAFT" || draft.status === "READY") && typeof draft.privateNotes === "string" && draft.privateNotes.length <= 10000 &&
    consultationContentSchema.safeParse(draft.content).success;
}
