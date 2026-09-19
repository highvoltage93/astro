import type { ZodType } from "zod";

export type RichMark = { type: "bold" | "italic" | "strike" | "underline" };
export type RichNode = {
  type: "doc" | "text" | "hardBreak" | "paragraph" | "heading" | "blockquote" | "bulletList" | "orderedList" | "listItem";
  text?: string;
  marks?: RichMark[];
  attrs?: { level?: 2 | 3; start?: number; type?: "1" | "a" | "A" | "i" | "I" | null };
  content?: RichNode[];
};
export type RichDocument = RichNode & { type: "doc"; content: RichNode[] };
export type ConsultationContent = {
  version: 1 | 2;
  sections: Array<{ id: string; title: string; body: string | RichDocument }>;
};
export const richDocumentSchema: ZodType<RichDocument>;
export const consultationContentSchema: ZodType<ConsultationContent>;
export function plainTextToRich(text: string): RichDocument;
export function richBody(body: string | RichDocument): RichDocument;
export function upgradeContent(content: ConsultationContent): ConsultationContent;
