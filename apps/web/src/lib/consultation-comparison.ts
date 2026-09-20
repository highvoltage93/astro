import { richBody, richDocumentSchema } from "@astroprocessor/consultation-format";
import type { ConsultationContent, RichNode } from "@astroprocessor/consultation-format";
import type { ConsultationDraft } from "./consultations";

type Section = ConsultationContent["sections"][number];
export type SectionComparison = {
  id: string; before?: Section; after?: Section; beforePosition?: number; afterPosition?: number;
  kind: "added" | "removed" | "changed" | "unchanged";
  titleChanged: boolean; textChanged: boolean; formattingOnly: boolean; sourcesChanged: boolean; moved: boolean;
};

// Compare validated document structure, not JSON key order or legacy storage format.
function normalizeNode(node: RichNode): unknown {
  return {
    type: node.type,
    ...(node.type === "text" ? { text: node.text } : {}),
    ...(node.type === "heading" ? { level: node.attrs?.level } : {}),
    ...(node.type === "orderedList" ? { start: node.attrs?.start ?? 1, listType: node.attrs?.type ?? "1" } : {}),
    marks: (node.marks ?? []).map((mark) => mark.type).sort(),
    content: (node.content ?? []).map(normalizeNode)
  };
}
function textOf(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const children = (node.content ?? []).map(textOf);
  return children.join(node.type === "paragraph" || node.type === "heading" ? "" : "\n");
}
function bodyComparison(before: Section["body"], after: Section["body"]) {
  const left = richDocumentSchema.parse(richBody(before));
  const right = richDocumentSchema.parse(richBody(after));
  const changed = JSON.stringify(normalizeNode(left)) !== JSON.stringify(normalizeNode(right));
  const textChanged = textOf(left) !== textOf(right);
  return { textChanged, formattingOnly: changed && !textChanged };
}
const sourceKey = (section: Section) => JSON.stringify((section.forecastSources ?? []).map((source) =>
  JSON.stringify([source.forecastId, source.eventId, source.generatedAt, source.timezone])).sort());

export function compareConsultationDrafts(before: ConsultationDraft, after: ConsultationDraft) {
  const left = new Map(before.content.sections.map((section, index) => [section.id, { section, index }]));
  const right = new Map(after.content.sections.map((section, index) => [section.id, { section, index }]));
  const leftOrder = before.content.sections.filter((section) => right.has(section.id)).map((section) => section.id);
  const rightOrder = after.content.sections.filter((section) => left.has(section.id)).map((section) => section.id);
  const ids = [...after.content.sections.map((section) => section.id), ...before.content.sections.filter((section) => !right.has(section.id)).map((section) => section.id)];
  const sections = ids.map<SectionComparison>((id) => {
    const previous = left.get(id);
    const current = right.get(id);
    if (!previous || !current) return {
      id, before: previous?.section, after: current?.section,
      beforePosition: previous ? previous.index + 1 : undefined, afterPosition: current ? current.index + 1 : undefined,
      kind: previous ? "removed" : "added", titleChanged: false, textChanged: false, formattingOnly: false, sourcesChanged: false, moved: false
    };
    const body = bodyComparison(previous.section.body, current.section.body);
    const titleChanged = previous.section.title !== current.section.title;
    const sourcesChanged = sourceKey(previous.section) !== sourceKey(current.section);
    // Insertions and removals alone do not mean the remaining sections were reordered.
    const moved = leftOrder.indexOf(id) !== rightOrder.indexOf(id);
    return { id, before: previous?.section, after: current?.section,
      beforePosition: previous ? previous.index + 1 : undefined, afterPosition: current ? current.index + 1 : undefined,
      kind: titleChanged || body.textChanged || body.formattingOnly || sourcesChanged || moved ? "changed" : "unchanged",
      titleChanged, ...body, sourcesChanged, moved };
  });
  return {
    titleChanged: before.title !== after.title,
    statusChanged: before.status !== after.status,
    notesChanged: before.privateNotes !== after.privateNotes,
    sections,
    counts: {
      added: sections.filter((section) => section.kind === "added").length,
      removed: sections.filter((section) => section.kind === "removed").length,
      changed: sections.filter((section) => section.kind === "changed").length,
      unchanged: sections.filter((section) => section.kind === "unchanged").length
    }
  };
}
