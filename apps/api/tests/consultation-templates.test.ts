import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerConsultationTemplateRoutes, type TemplateDependencies } from "../src/consultation-templates/routes";
import { templateDraftSchema } from "../src/consultation-templates/schemas";
import { appendTextTemplate, validTemplateDraft } from "../../web/src/lib/consultation-templates";
import { plainTextToRich, type ConsultationContent } from "@astroprocessor/consultation-format";

const id = randomUUID();
const mutationId = randomUUID();
const draft = { title: "Transit template", category: "transit" as const, body: plainTextToRich("First paragraph\nSecond paragraph") };
const headers = { authorization: "Bearer owner" };
const record = { id, ownerUserId: "owner", title: draft.title, category: draft.category, bodyJson: draft.body,
  revision: 2, lastMutationId: mutationId, createdAt: new Date(), updatedAt: new Date() };
const missing = () => new Prisma.PrismaClientKnownRequestError("Not found", { code: "P2025", clientVersion: "5.18.0" });
const createApp = async (t: TestContext, database: unknown = {}) => {
  const app = Fastify();
  await registerConsultationTemplateRoutes(app, {
    authenticate: async (request) => request.headers.authorization === headers.authorization ? { id: "owner" } : null,
    database: database as TemplateDependencies["database"]
  });
  t.after(() => app.close());
  return app;
};

test("all template operations require authentication before database access", async (t) => {
  const app = await createApp(t);
  for (const request of [
    { method: "GET" as const, url: "/consultation-templates" },
    { method: "GET" as const, url: `/consultation-templates/${id}` },
    { method: "POST" as const, url: "/consultation-templates", payload: {} },
    { method: "PUT" as const, url: `/consultation-templates/${id}`, payload: {} },
    { method: "DELETE" as const, url: `/consultation-templates/${id}?revision=2` }
  ]) assert.equal((await app.inject(request)).statusCode, 401);
});

test("template list scopes ownership, filters category and title, and excludes bodies", async (t) => {
  const app = await createApp(t, { consultationTemplate: { findMany: async (args: { where: unknown; select: Record<string, unknown>; orderBy: unknown }) => {
    assert.deepEqual(args.where, { ownerUserId: "owner", category: "transit", title: { contains: "Saturn", mode: "insensitive" } });
    assert.equal(args.select.bodyJson, undefined);
    assert.equal(args.select.ownerUserId, undefined);
    assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    return [];
  } } });
  const result = await app.inject({ method: "GET", url: "/consultation-templates?category=transit&query=Saturn", headers });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["cache-control"], "private, no-store");
});

test("foreign details and cursors never return templates", async (t) => {
  const app = await createApp(t, { consultationTemplate: { findFirst: async (args: { where: unknown }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return null;
  } } });
  assert.equal((await app.inject({ method: "GET", url: `/consultation-templates/${id}`, headers })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/consultation-templates?cursor=${id}`, headers })).statusCode, 400);
});

test("creation retries use an immutable UUID and never update the stored template", async (t) => {
  const app = await createApp(t, { consultationTemplate: { upsert: async (args: { where: unknown; create: Record<string, unknown>; update: unknown }) => {
    assert.deepEqual(args.where, { id });
    assert.deepEqual(args.update, {});
    assert.equal(args.create.ownerUserId, "owner");
    assert.deepEqual(args.create.bodyJson, draft.body);
    return record;
  } } });
  for (let retry = 0; retry < 2; retry++) {
    const result = await app.inject({ method: "POST", url: "/consultation-templates", headers, payload: { id, draft } });
    assert.equal(result.statusCode, 201);
    assert.equal(result.json().template.id, id);
    assert.equal("ownerUserId" in result.json().template, false);
  }
});

test("a creation ID belonging to another owner is rejected without disclosing content", async (t) => {
  const app = await createApp(t, { consultationTemplate: { upsert: async () => ({ ...record, ownerUserId: "other" }) } });
  const result = await app.inject({ method: "POST", url: "/consultation-templates", headers, payload: { id, draft } });
  assert.equal(result.statusCode, 409);
  assert.equal("template" in result.json(), false);
});

test("updates atomically require the owner and expected revision", async (t) => {
  const app = await createApp(t, { consultationTemplate: { update: async (args: { where: unknown; data: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 2 });
    assert.deepEqual(args.data.revision, { increment: 1 });
    assert.equal(args.data.lastMutationId, mutationId);
    return { ...record, revision: 3 };
  } } });
  const result = await app.inject({ method: "PUT", url: `/consultation-templates/${id}`, headers, payload: { revision: 2, mutationId, draft } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().template.revision, 3);
});

test("lost update responses are idempotent but unrelated stale updates conflict", async (t) => {
  const app = await createApp(t, { consultationTemplate: {
    update: async () => { throw missing(); },
    findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return record; }
  } });
  assert.equal((await app.inject({ method: "PUT", url: `/consultation-templates/${id}`, headers, payload: { revision: 1, mutationId, draft } })).statusCode, 200);
  assert.equal((await app.inject({ method: "PUT", url: `/consultation-templates/${id}`, headers, payload: { revision: 1, mutationId: randomUUID(), draft } })).statusCode, 409);
});

test("deletion cannot remove a newer revision and only addresses the owner's template", async (t) => {
  const app = await createApp(t, { consultationTemplate: {
    deleteMany: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 1 }); return { count: 0 }; },
    findFirst: async () => ({ id })
  } });
  assert.equal((await app.inject({ method: "DELETE", url: `/consultation-templates/${id}?revision=1`, headers })).statusCode, 409);
});

test("schemas reject unsupported formatting, metadata and oversized titles", () => {
  assert.equal(templateDraftSchema.safeParse(draft).success, true);
  assert.equal(templateDraftSchema.safeParse({ ...draft, title: " " }).success, false);
  assert.equal(templateDraftSchema.safeParse({ ...draft, title: "x".repeat(121) }).success, false);
  assert.equal(templateDraftSchema.safeParse({ ...draft, privateNotes: "secret" }).success, false);
  assert.equal(templateDraftSchema.safeParse({ ...draft, body: { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] } }).success, false);
  assert.equal(validTemplateDraft({ ...draft, category: "toString" }), false);
});

test("insertion copies rich text, preserves existing sources and leaves the template detached", () => {
  const sectionId = randomUUID();
  const content: ConsultationContent = { version: 2, sections: [{ id: sectionId, title: "Notes", body: "Existing text",
    forecastSources: [{ forecastId: "cmf8exampleforecast00000001", eventId: "transit:0", generatedAt: "2026-09-19T00:00:00Z", timezone: "UTC" }] }] };
  const template = { ...draft, body: plainTextToRich("Template text") };
  const inserted = appendTextTemplate(content, sectionId, template, randomUUID());
  assert.match(JSON.stringify(inserted), /Existing text/);
  assert.match(JSON.stringify(inserted), /Template text/);
  assert.equal(inserted.sections[0]!.forecastSources![0]!.forecastId, "cmf8exampleforecast00000001");
  template.body.content[0]!.content![0]!.text = "Edited template";
  assert.equal(JSON.stringify(inserted).includes("Edited template"), false);
  assert.equal(content.sections[0]!.body, "Existing text");
  const newSection = appendTextTemplate(content, "new", template, randomUUID()).sections[1]!;
  assert.equal(newSection.title, draft.title);
  assert.equal(newSection.forecastSources, undefined);
  assert.throws(() => appendTextTemplate(content, "deleted", template, randomUUID()));
  const full: ConsultationContent = { version: 1, sections: Array.from({ length: 30 }, () => ({ id: randomUUID(), title: "Section", body: "" })) };
  assert.throws(() => appendTextTemplate(full, "new", template, randomUUID()));
});
