import { consultationContentSchema, richBody, richDocumentSchema } from "@astroprocessor/consultation-format";
import type { ConsultationContent, RichDocument } from "@astroprocessor/consultation-format";

export const templateCategories = {
  general: "Загальне", natal: "Натальна карта", transit: "Транзити", solar: "Соляр", lunar: "Лунар", synastry: "Синастрія"
} as const;
export type TemplateCategory = keyof typeof templateCategories;
export type TemplateDraft = { title: string; category: TemplateCategory; body: string | RichDocument };
export type TemplateSummary = { id: string; title: string; category: TemplateCategory; revision: number; createdAt: string; updatedAt: string };
export type ConsultationTextTemplate = TemplateSummary & TemplateDraft;
export type TemplateMutation = { id: string; revision: number | null; mutationId: string; draft: TemplateDraft };
export class TemplateError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function request<T>(token: string, path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}/consultation-templates${path}`, {
    method, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new TemplateError(body?.message ?? "Не вдалося відкрити або зберегти шаблон.", response.status);
  }
  return response.json() as Promise<T>;
}
export const listTextTemplates = (token: string, query: string, category: TemplateCategory | "all", cursor?: string) => {
  const params = new URLSearchParams({ query, limit: "10" });
  if (category !== "all") params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  return request<{ templates: TemplateSummary[]; nextCursor: string | null }>(token, `?${params}`);
};
export const getTextTemplate = (token: string, id: string) => request<{ template: ConsultationTextTemplate }>(token, `/${encodeURIComponent(id)}`);
export const saveTextTemplate = (token: string, mutation: TemplateMutation) => mutation.revision === null
  ? request<{ template: ConsultationTextTemplate }>(token, "", "POST", { id: mutation.id, draft: mutation.draft })
  : request<{ template: ConsultationTextTemplate }>(token, `/${encodeURIComponent(mutation.id)}`, "PUT", {
    revision: mutation.revision, mutationId: mutation.mutationId, draft: mutation.draft
  });
export const deleteTextTemplate = (token: string, id: string, revision: number) =>
  request<{ deletedTemplateId: string }>(token, `/${encodeURIComponent(id)}?revision=${revision}`, "DELETE");

export function validTemplateDraft(value: unknown): value is TemplateDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as TemplateDraft;
  return typeof draft.title === "string" && draft.title.length <= 120 &&
    Object.hasOwn(templateCategories, draft.category) &&
    (typeof draft.body === "string" ? draft.body.length <= 20000 : richDocumentSchema.safeParse(draft.body).success) &&
    JSON.stringify(draft).length <= 100000;
}

export function appendTextTemplate(content: ConsultationContent, target: string, template: TemplateDraft, newId: string): ConsultationContent {
  if (!validTemplateDraft(template)) throw new Error("Непідтримуваний або завеликий шаблон.");
  // A template is a detached copy: no client details, import markers, or live references are attached.
  const body = structuredClone(richBody(template.body));
  const sections = content.sections.map((section) => ({ ...section }));
  if (target === "new") sections.push({ id: newId, title: template.title, body });
  else {
    const index = sections.findIndex((section) => section.id === target);
    const section = sections[index];
    if (!section) throw new Error("Розділ більше не існує. Вибери інший.");
    sections[index] = { ...section, body: { type: "doc", content: [...richBody(section.body).content, ...body.content] } };
  }
  const parsed = consultationContentSchema.safeParse({ version: 2, sections });
  if (!parsed.success) throw new Error("Шаблон не вставлено: перевищено ліміт документа або розділів.");
  return parsed.data;
}
