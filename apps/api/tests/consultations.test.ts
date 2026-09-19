import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerConsultationRoutes, type ConsultationDependencies } from "../src/consultations/routes";
import { consultationDraftSchema } from "../src/consultations/schemas";
import { consultationFacts, appendConsultationFacts } from "../../web/src/lib/consultation-facts";
import type { ChartResult } from "../../web/src/lib/chart-types";

test("facts use stored values and exclude angles from planetary aspects", () => {
  const chart = {
    bodies: [{ key: "sun", sign: "leo", signDegree: 12.5, house: 2, speed: 1 },
      { key: "mars", sign: "scorpio", signDegree: 29.99999999999, house: 6, speed: -0.2 }],
    angles: [{ key: "asc", sign: "virgo", signDegree: 1.25, speed: 0 }],
    aspects: [{ bodyA: "sun", bodyB: "mars", type: "trine", exactAngle: 120, orb: 0.1234 },
      { bodyA: "sun", bodyB: "asc", type: "square", exactAngle: 90, orb: 2 }],
    planetRulerships: [{ pointKey: "sun", houses: [12, 2, 12] }]
  } as unknown as ChartResult;
  const before = JSON.stringify(chart);
  const facts = consultationFacts(chart);
  assert.match(facts[0]!.text, /Лев 12°30′00″/);
  assert.match(facts[0]!.text, /править домами: 2, 12/);
  assert.match(facts.find((fact) => fact.id === "point:mars")!.text, /29°59′59″/);
  assert.match(facts.find((fact) => fact.id === "point:mars")!.text, /рух ретроградний/);
  assert.equal(facts.find((fact) => fact.id === "point:asc")!.text.includes("рух"), false);
  assert.equal(facts.filter((fact) => fact.category === "aspects").length, 1);
  assert.match(facts.find((fact) => fact.category === "aspects")!.text, /кут аспекту 120°; орбіс 0.1234°/);
  assert.equal(JSON.stringify(chart), before);
});

test("fact insertion preserves text and rejects missing destinations", () => {
  const sectionId = randomUUID();
  const content = { version: 1 as const, sections: [{ id: sectionId, title: "Notes", body: "Existing text" }] };
  const appended = appendConsultationFacts(content, sectionId, ["Sun placement"], randomUUID());
  assert.equal(appended.version, 2);
  assert.equal(appended.sections.length, 1);
  assert.match(JSON.stringify(appended), /Existing text/);
  assert.match(JSON.stringify(appended), /Sun placement/);
  assert.equal(content.sections[0]!.body, "Existing text");
  assert.equal(appendConsultationFacts(content, "new", ["Fact"], randomUUID()).sections.length, 2);
  assert.throws(() => appendConsultationFacts(content, "deleted", ["Fact"], randomUUID()));
  assert.throws(() => appendConsultationFacts(content, "new", [], randomUUID()));
});

const id = randomUUID();
const mutationId = randomUUID();
const headers = { authorization: "Bearer owner" };
const draft = {
  title: "Consultation", status: "DRAFT", privateNotes: "Private hypothesis",
  content: { version: 1, sections: [{ id: randomUUID(), title: "Client request", body: "Plain text, not HTML" }] }
};
const record = {
  id, ownerUserId: "owner", sourceProfileId: "chart", sourceCalculationId: "calculation",
  sourceSnapshotJson: { chart: { engine: "fixture" } }, ...draft, contentJson: draft.content,
  revision: 2, lastMutationId: mutationId, createdAt: new Date(), updatedAt: new Date()
};
const missing = () => new Prisma.PrismaClientKnownRequestError("Not found", { code: "P2025", clientVersion: "5.18.0" });
const createApp = async (t: TestContext, database: unknown = {}) => {
  const app = Fastify();
  await registerConsultationRoutes(app, {
    authenticate: async (request) => request.headers.authorization === headers.authorization ? { id: "owner" } : null,
    database: database as ConsultationDependencies["database"]
  });
  t.after(() => app.close());
  return app;
};

test("all consultation endpoints authenticate before storage access", async (t) => {
  const app = await createApp(t);
  for (const request of [
    { method: "GET" as const, url: "/consultations" },
    { method: "GET" as const, url: `/consultations/${id}` },
    { method: "GET" as const, url: `/consultations/${id}/client-document` },
    { method: "POST" as const, url: "/consultations", payload: {} },
    { method: "PUT" as const, url: `/consultations/${id}`, payload: {} }
  ]) assert.equal((await app.inject(request)).statusCode, 401);
});

test("list excludes document bodies and private notes and scopes ownership", async (t) => {
  const app = await createApp(t, { consultation: { findMany: async (args: { where: unknown; select: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { ownerUserId: "owner", sourceProfileId: "chart" });
    assert.equal(args.select.contentJson, undefined);
    assert.equal(args.select.privateNotes, undefined);
    assert.equal(args.select.sourceSnapshotJson, undefined);
    return [];
  } } });
  const response = await app.inject({ method: "GET", url: "/consultations?sourceProfileId=chart", headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
});

test("shared or foreign charts cannot be used to create private consultations", async (t) => {
  const app = await createApp(t, {
    consultation: { findUnique: async () => null },
    birthProfile: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: "chart", ownerUserId: "owner" }); return null;
    } }
  });
  const response = await app.inject({ method: "POST", url: "/consultations", headers, payload: { ...draft, id, sourceProfileId: "chart" } });
  assert.equal(response.statusCode, 404);
});

test("creation copies the stored calculation, not client data", async (t) => {
  const chart = { bodies: [{ key: "sun", longitude: 123.45 }], settings: { houseSystem: "koch" } };
  const app = await createApp(t, {
    consultation: {
      findUnique: async () => null,
      upsert: async (args: { create: Record<string, unknown>; update: unknown }) => {
        assert.deepEqual(args.update, {});
        assert.equal(args.create.ownerUserId, "owner");
        assert.equal(args.create.sourceCalculationId, "calculation");
        assert.deepEqual((args.create.sourceSnapshotJson as { chart: unknown }).chart, chart);
        return { ...record, ...args.create, revision: 1 };
      }
    },
    birthProfile: { findFirst: async () => ({
      displayName: "Subject", birthplaceName: "Kyiv", birthDate: new Date("1995-04-12"), birthTime: "14:30:27",
      birthTimeKnown: true, timezone: "Europe/Kyiv",
      calculations: [{ id: "calculation", calculatedAt: new Date(), resultJson: chart }]
    }) }
  });
  const response = await app.inject({ method: "POST", url: "/consultations", headers, payload: { ...draft, id, sourceProfileId: "chart" } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json().consultation.source.chart, chart);
  assert.equal("ownerUserId" in response.json().consultation, false);
});

test("creation retries return the same document even if its source was deleted", async (t) => {
  const app = await createApp(t, { consultation: { findUnique: async () => record } });
  const response = await app.inject({ method: "POST", url: "/consultations", headers, payload: { ...draft, id, sourceProfileId: "chart" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().consultation.id, id);
});

test("editing atomically compares revisions and leaves the source snapshot unchanged", async (t) => {
  const app = await createApp(t, { consultation: { update: async (args: { where: unknown; data: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 1 });
    assert.deepEqual(args.data.revision, { increment: 1 });
    assert.equal(args.data.sourceSnapshotJson, undefined);
    assert.equal(args.data.ownerUserId, undefined);
    return record;
  } } });
  const response = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, revision: 1, mutationId } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().consultation.revision, 2);
});

test("lost-response retries succeed but other-tab edits conflict", async (t) => {
  const app = await createApp(t, { consultation: {
    update: async () => { throw missing(); },
    findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return record; }
  } });
  const retry = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, revision: 1, mutationId } });
  assert.equal(retry.statusCode, 200);
  const conflict = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, revision: 1, mutationId: randomUUID() } });
  assert.equal(conflict.statusCode, 409);
});

test("reading or editing another user's document returns 404", async (t) => {
  const app = await createApp(t, { consultation: {
    update: async () => { throw missing(); },
    findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return null; }
  } });
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}`, headers })).statusCode, 404);
  assert.equal((await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, revision: 1, mutationId } })).statusCode, 404);
});

test("document shape is versioned and bounded", () => {
  assert.equal(consultationDraftSchema.safeParse(draft).success, true);
  for (const content of [
    { version: 3, sections: draft.content.sections },
    { version: 1, sections: [] },
    { version: 1, sections: [draft.content.sections[0], draft.content.sections[0]] },
    { version: 1, sections: [{ ...draft.content.sections[0], body: "x".repeat(20001) }] }
  ]) assert.equal(consultationDraftSchema.safeParse({ ...draft, content }).success, false);
});

test("rich-text saves preserve formatting and still require the expected revision", async (t) => {
  const content = { version: 2, sections: [{ id: randomUUID(), title: "Forecast", body: {
    type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Important", marks: [{ type: "bold" }] }] }]
  } }] };
  const app = await createApp(t, { consultation: { update: async (args: { where: unknown; data: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 2 });
    assert.deepEqual(args.data.contentJson, content);
    assert.equal(args.data.sourceSnapshotJson, undefined);
    return { ...record, revision: 3, contentJson: args.data.contentJson };
  } } });
  const response = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers,
    payload: { ...draft, content, revision: 2, mutationId: randomUUID() } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().consultation.content, content);
});

test("client document omits private notes and full chart data", async (t) => {
  const source = {
    displayName: "Client", birthplaceName: "Kyiv", birthDate: "1995-04-12", birthTime: "12:00:00",
    birthTimeKnown: false, timezone: "Europe/Kyiv", calculatedAt: "2026-09-17T12:00:00Z",
    privateNotes: "Nested secret", chart: { settings: { houseSystem: "koch", zodiac: "tropical" }, bodies: ["Internal data"] }
  };
  const app = await createApp(t, { consultation: { findFirst: async (args: { where: unknown; select: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner" });
    assert.equal(args.select.privateNotes, undefined);
    return { ...record, sourceSnapshotJson: source };
  } } });
  const response = await app.inject({ method: "GET", url: `/consultations/${id}/client-document?revision=2`, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  const document = response.json().document;
  assert.deepEqual(document.content, draft.content);
  assert.equal("privateNotes" in document, false);
  assert.equal("ownerUserId" in document, false);
  assert.equal("privateNotes" in document.source, false);
  assert.equal("chart" in document.source, false);
  assert.equal(document.source.birthTime, null);
});

test("printing rejects a different revision rather than substituting current text", async (t) => {
  const app = await createApp(t, { consultation: { findFirst: async () => record } });
  const response = await app.inject({ method: "GET", url: `/consultations/${id}/client-document?revision=1`, headers });
  assert.equal(response.statusCode, 409);
  assert.equal("document" in response.json(), false);
});

test("print access remains owner-only and malformed revisions are rejected", async (t) => {
  const app = await createApp(t, { consultation: { findFirst: async (args: { where: unknown }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return null;
  } } });
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/client-document`, headers })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/client-document?revision=zero`, headers })).statusCode, 400);
});
