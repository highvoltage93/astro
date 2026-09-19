const { z } = require("zod");

const MAX_DEPTH = 12;
const MAX_NODES = 5000;
const MAX_TEXT = 20000;
const mark = z.object({ type: z.enum(["bold", "italic", "strike", "underline"]) }).strict();
const marks = z.array(mark).max(4).refine((items) => new Set(items.map((item) => item.type)).size === items.length,
  "Marks must be unique").optional();
const inline = z.union([
  z.object({ type: z.literal("text"), text: z.string().min(1), marks }).strict(),
  z.object({ type: z.literal("hardBreak"), marks }).strict()
]);
const paragraph = z.object({ type: z.literal("paragraph"), content: z.array(inline).optional() }).strict();
const block = z.lazy(() => z.union([
  paragraph,
  z.object({ type: z.literal("heading"), attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).strict(), content: z.array(inline).optional() }).strict(),
  z.object({ type: z.literal("blockquote"), content: z.array(block).min(1) }).strict(),
  z.object({ type: z.literal("bulletList"), content: z.array(listItem).min(1) }).strict(),
  z.object({ type: z.literal("orderedList"), attrs: z.object({
    start: z.number().int().min(1).max(1000000).optional(),
    type: z.enum(["1", "a", "A", "i", "I"]).nullable().optional()
  }).strict().optional(), content: z.array(listItem).min(1) }).strict()
]));
const listItem = z.lazy(() => z.object({
  type: z.literal("listItem"), content: z.tuple([paragraph]).rest(block)
}).strict());

// Bound the tree before invoking recursive validation, including untrusted API input.
const boundedTree = z.unknown().superRefine((value, context) => {
  const stack = [{ node: value, depth: 0 }];
  const seen = new Set();
  let nodes = 0;
  let textLength = 0;
  while (stack.length) {
    const { node, depth } = stack.pop();
    nodes++;
    if (nodes > MAX_NODES || depth > MAX_DEPTH || !node || typeof node !== "object" || seen.has(node)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid or oversized document tree", fatal: true });
      return z.NEVER;
    }
    seen.add(node);
    if (typeof node.text === "string") textLength += node.text.length;
    if (textLength > MAX_TEXT || (Array.isArray(node.content) && node.content.length > MAX_NODES)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Section text is too long", fatal: true });
      return z.NEVER;
    }
    if (Array.isArray(node.content)) for (const child of node.content) stack.push({ node: child, depth: depth + 1 });
  }
});
const richDocumentSchema = boundedTree.pipe(z.object({ type: z.literal("doc"), content: z.array(block).min(1) }).strict());
const section = { id: z.string().uuid(), title: z.string().max(200) };
const consultationContentSchema = z.discriminatedUnion("version", [
  z.object({ version: z.literal(1), sections: z.array(z.object({ ...section, body: z.string().max(MAX_TEXT) }).strict()).min(1).max(30) }).strict(),
  z.object({ version: z.literal(2), sections: z.array(z.object({ ...section, body: z.union([z.string().max(MAX_TEXT), richDocumentSchema]) }).strict()).min(1).max(30) }).strict()
]).refine((value) => new Set(value.sections.map((item) => item.id)).size === value.sections.length, "Section IDs must be unique")
  .refine((value) => JSON.stringify(value).length <= 200000, "Document is too large");

const plainTextToRich = (text) => ({ type: "doc", content: text.split(/\r\n|\r|\n/).map((line) => ({
  type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {})
})) });
const richBody = (body) => typeof body === "string" ? plainTextToRich(body) : body;
// Unedited legacy sections remain strings; conversion never expands an entire old document at once.
const upgradeContent = (content) => ({ version: 2, sections: content.sections.map((item) => ({ ...item })) });

module.exports = { richDocumentSchema, consultationContentSchema, plainTextToRich, richBody, upgradeContent };
