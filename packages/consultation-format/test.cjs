const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { consultationContentSchema, richDocumentSchema, plainTextToRich, upgradeContent } = require("./index.js");
const text = { type: "text", text: "Прогноз <script>не HTML</script>", marks: [{ type: "bold" }, { type: "italic" }] };
const paragraph = { type: "paragraph", content: [text] };
const document = { type: "doc", content: [
  { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Основні теми" }] },
  paragraph,
  { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Цитата" }] }] },
  { type: "orderedList", attrs: { start: 3, type: null }, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
  { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }] }] }
] };

test("supported formatting round-trips without dropping attributes", () => {
  assert.deepEqual(richDocumentSchema.parse(document), document);
});

test("legacy documents and local drafts remain readable without automatic conversion", () => {
  const old = { version: 1, sections: [{ id: randomUUID(), title: "Тема", body: "Рядок 1\r\n\nРядок 3 <b>текст</b>" }] };
  assert.deepEqual(consultationContentSchema.parse(old), old);
  const upgraded = upgradeContent(old);
  assert.equal(upgraded.version, 2);
  assert.equal(upgraded.sections[0].body, old.sections[0].body);
  assert.equal(old.version, 1);
  const rich = plainTextToRich(old.sections[0].body);
  assert.equal(rich.content.length, 3);
  assert.deepEqual(rich.content[1], { type: "paragraph" });
  assert.equal(rich.content[2].content[0].text, "Рядок 3 <b>текст</b>");
  assert.equal(consultationContentSchema.safeParse({ ...upgraded, sections: [{ ...upgraded.sections[0], body: rich }] }).success, true);
  assert.equal(consultationContentSchema.safeParse({ ...old, sections: [{ ...old.sections[0], body: rich }] }).success, false);
});

test("executable HTML, external media, links and unsupported styles are rejected", () => {
  for (const node of [
    { type: "image", attrs: { src: "https://example.com/tracking.png" } },
    { type: "paragraph", attrs: { onclick: "alert(1)" } },
    { type: "heading", attrs: { level: 1 }, content: [] },
    { type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    { type: "paragraph", content: [{ type: "text", text: "styled", marks: [{ type: "bold", attrs: { style: "color:red" } }] }] },
    { type: "orderedList", attrs: { start: -1 }, content: [] }
  ]) assert.equal(richDocumentSchema.safeParse({ type: "doc", content: [node] }).success, false);
});

test("malformed nesting, excessive depth and large text are rejected", () => {
  assert.equal(richDocumentSchema.safeParse({ type: "doc", content: [{ type: "text", text: "invalid root" }] }).success, false);
  assert.equal(richDocumentSchema.safeParse({ type: "doc", content: [{ type: "bulletList", content: [paragraph] }] }).success, false);
  let deep = { type: "paragraph" };
  for (let i = 0; i < 20; i++) deep = { type: "blockquote", content: [deep] };
  assert.equal(richDocumentSchema.safeParse({ type: "doc", content: [deep] }).success, false);
  assert.equal(richDocumentSchema.safeParse(plainTextToRich("x".repeat(20001))).success, false);
  assert.equal(richDocumentSchema.safeParse({ type: "doc", content: Array.from({ length: 5001 }, () => ({ type: "paragraph" })) }).success, false);
});

test("a rich section can coexist with unedited plain sections", () => {
  const content = { version: 2, sections: [
    { id: randomUUID(), title: "Форматований", body: document },
    { id: randomUUID(), title: "Попередній", body: "Без змін" }
  ] };
  assert.deepEqual(consultationContentSchema.parse(content), content);
});
