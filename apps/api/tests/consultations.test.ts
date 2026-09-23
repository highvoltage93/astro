import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerConsultationRoutes, type ConsultationDependencies } from "../src/consultations/routes";
import { consultationDraftSchema } from "../src/consultations/schemas";
import { consultationFacts, appendConsultationFacts } from "../../web/src/lib/consultation-facts";
import type { ChartResult } from "../../web/src/lib/chart-types";
import { appendForecastFacts, consultationForecastFacts, importedForecastEvents } from "../../web/src/lib/consultation-forecast-facts";
import type { SavedForecast } from "../../web/src/lib/forecast-archive";
import { plainTextToRich, upgradeContent } from "@astroprocessor/consultation-format";
import { restoreConsultationDraft, type ConsultationDraft } from "../../web/src/lib/consultations";
import { compareConsultationDrafts } from "../../web/src/lib/consultation-comparison";
import { projectPrintAssets } from "../src/consultations/print-assets";
import { printAspects, printDegree, printEvents, printPoints, type PrintChart, type PrintAssets } from "../../web/src/lib/consultation-print-assets";

const transitFixture = () => ({
  id: "cmf8exampleforecast00000001", kind: "transit", title: "Test forecast",
  input: { context: { subject: { displayName: "Test" } }, parameters: {
    transitDateTime: "2026-10-25T03:30:00+03:00", natal: { timezone: "Europe/Kyiv", houseSystem: "koch", zodiac: "tropical" }
  } },
  result: { generatedAt: "2026-09-19T10:00:00.000Z", transitToNatalAspects: [
    { bodyA: "saturn", bodyB: "sun", type: "trine", exactAngle: 120, orb: 0.1234,
      exactAt: "2026-10-25T03:30:00+02:00", activeFrom: null, activeUntil: null },
    { bodyA: "jupiter", bodyB: "moon", type: "square", exactAngle: 90, orb: 1,
      exactAt: null, activeFrom: null, activeUntil: null }
  ] }
}) as unknown as SavedForecast;

test("forecast facts retain instants across DST and distinguish missing exact dates", () => {
  const forecast = transitFixture();
  const before = JSON.stringify(forecast);
  const facts = consultationForecastFacts(forecast);
  assert.match(facts[0]!.text, /2026-10-25 00:30:00.000 UTC/);
  assert.match(facts[0]!.text, /2026-10-25 01:30:00.000 UTC/);
  assert.match(facts[0]!.text, /кут аспекту 120°; орбіс 0.1234°/);
  assert.match(facts[1]!.text, /Точну дату не визначено/);
  assert.equal(JSON.stringify(forecast), before);
});

test("forecast insertion preserves text and provenance through serialization and edits", () => {
  const forecast = transitFixture();
  const ids = consultationForecastFacts(forecast).map((fact) => fact.id);
  const sectionId = randomUUID();
  const original = { version: 1 as const, sections: [{ id: sectionId, title: "Notes", body: "Existing text" }] };
  const inserted = appendForecastFacts(original, sectionId, forecast, [ids[0]!], randomUUID());
  const restored = upgradeContent(JSON.parse(JSON.stringify(inserted)));
  assert.match(JSON.stringify(restored), /Existing text/);
  assert.equal(importedForecastEvents(restored, forecast.id).has(ids[0]!), true);
  assert.throws(() => appendForecastFacts(restored, "new", forecast, [ids[0]!], randomUUID()));
  const mixed = appendForecastFacts(restored, sectionId, forecast, ids, randomUUID());
  assert.equal(mixed.sections[0]!.forecastSources!.length, 2);
  const natalAdded = appendConsultationFacts(mixed, sectionId, ["Natal fact"], randomUUID());
  assert.equal(importedForecastEvents(natalAdded, forecast.id).size, 2);
  assert.equal(original.sections[0]!.body, "Existing text");
  assert.throws(() => appendForecastFacts(original, "deleted", forecast, ids, randomUUID()));
  const newSection = appendForecastFacts(original, "new", forecast, ids, randomUUID());
  assert.equal(newSection.sections[1]!.title, "Прогнозні події");
  assert.equal(newSection.sections[1]!.forecastSources![0]!.timezone, "UTC");
});

test("forecast picker includes returns and preserves estimated timeline dates", () => {
  const forecast = {
    id: randomUUID(), kind: "forecast", result: {
      solarReturn: { kind: "solar", exactAt: "2026-07-01T00:00:00Z",
        chart: { bodies: [], angles: [], aspects: [] }, returnToNatalAspects: [] },
      lunarReturn: null, timelineEvents: [
        { id: "return", source: "solar-return", exactAt: "2026-07-01T00:00:00Z" },
        { id: "progression", source: "secondary-progression", exactAt: "2026-08-01T00:00:00Z",
          bodyA: "sun", bodyB: "moon", aspectType: "trine", exactAngle: 120, orb: 0 }
      ]
    }
  } as unknown as SavedForecast;
  const facts = consultationForecastFacts(forecast);
  assert.equal(facts.length, 2);
  assert.match(facts[0]!.text, /Соляр: повернення/);
  assert.match(facts[1]!.text, /Вторинна прогресія. Розрахункова дата/);
});

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
  const txDatabase = { consultationRevision: { upsert: async () => ({}) }, ...(database as object) };
  await registerConsultationRoutes(app, {
    authenticate: async (request) => request.headers.authorization === headers.authorization ? { id: "owner" } : null,
    database: { $transaction: async (action: (tx: unknown) => Promise<unknown>) => action(txDatabase), ...txDatabase } as unknown as ConsultationDependencies["database"]
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
    { method: "GET" as const, url: `/consultations/${id}/history` },
    { method: "GET" as const, url: `/consultations/${id}/history/1` },
    { method: "GET" as const, url: `/consultations/${id}/print-assets?revision=2` },
    { method: "GET" as const, url: `/consultations/${id}/print-forecasts` },
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
  const app = await createApp(t, { consultation: { findFirst: async () => ({ ...record, revision: 1 }), update: async (args: { where: unknown; data: Record<string, unknown> }) => {
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
  const app = await createApp(t, { consultation: { findFirst: async () => record, update: async (args: { where: unknown; data: Record<string, unknown> }) => {
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
    return { ...record, sourceSnapshotJson: source, contentJson: {
      ...draft.content, sections: draft.content.sections.map((section) => ({ ...section, forecastSources: [{
        forecastId: randomUUID(), eventId: "transit:0", generatedAt: "2026-09-19T10:00:00Z", timezone: "UTC"
      }] }))
    } };
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

test("saving a legacy consultation snapshots both previous and new revisions inside the transaction", async (t) => {
  let active = false;
  const captured: Array<{ revision: number; title: string; savedAt: Date }> = [];
  const previous = { ...record, revision: 7, title: "Previous", updatedAt: new Date("2026-09-19T10:00:00Z") };
  const updated = { ...record, revision: 8, title: "Updated", updatedAt: new Date("2026-09-20T10:00:00Z") };
  const transaction = {
    consultation: {
      findFirst: async () => { assert.equal(active, true); return previous; },
      update: async (args: { where: unknown }) => { assert.equal(active, true); assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 7 }); return updated; }
    },
    consultationRevision: { upsert: async (args: { where: unknown; update: unknown; create: typeof captured[number] }) => {
      assert.equal(active, true);
      assert.deepEqual(args.update, {});
      assert.deepEqual(args.where, { consultationId_revision: { consultationId: id, revision: args.create.revision } });
      captured.push(args.create);
      return args.create;
    } }
  };
  const app = await createApp(t, { $transaction: async (action: (tx: unknown) => Promise<unknown>) => {
    active = true;
    try { return await action(transaction); } finally { active = false; }
  } });
  const result = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, title: "Updated", revision: 7, mutationId } });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(captured.map((item) => item.revision), [7, 8]);
  assert.equal(captured[0]!.title, "Previous");
  assert.equal(captured[0]!.savedAt.toISOString(), previous.updatedAt.toISOString());
});

test("snapshot failure rejects the transaction before its document write can commit", async (t) => {
  let committedRevision = 2;
  let attemptedSnapshots = 0;
  const app = await createApp(t, { $transaction: async (action: (tx: unknown) => Promise<unknown>) => {
    let stagedRevision = committedRevision;
    const result = await action({
      consultation: { findFirst: async () => record, update: async () => { stagedRevision++; return { ...record, revision: stagedRevision }; } },
      consultationRevision: { upsert: async () => { if (++attemptedSnapshots === 2) throw new Error("Storage unavailable"); return {}; } }
    });
    committedRevision = stagedRevision;
    return result;
  } });
  const result = await app.inject({ method: "PUT", url: `/consultations/${id}`, headers, payload: { ...draft, revision: 2, mutationId } });
  assert.equal(result.statusCode, 500);
  assert.equal(attemptedSnapshots, 2);
  assert.equal(committedRevision, 2);
});

test("history lists only metadata, uses revision pagination and scopes the owner twice", async (t) => {
  const app = await createApp(t, {
    consultation: { findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return { revision: 9 }; } },
    consultationRevision: { findMany: async (args: { where: unknown; select: Record<string, unknown>; orderBy: unknown; take: number }) => {
      assert.deepEqual(args.where, { consultationId: id, consultation: { ownerUserId: "owner" }, revision: { lt: 9 } });
      assert.equal(args.select.contentJson, undefined);
      assert.equal(args.select.privateNotes, undefined);
      assert.deepEqual(args.orderBy, { revision: "desc" });
      assert.equal(args.take, 3);
      return [8, 7, 6].map((revision) => ({ revision, title: "Version", status: "DRAFT", savedAt: new Date() }));
    } }
  });
  const result = await app.inject({ method: "GET", url: `/consultations/${id}/history?before=9&limit=2`, headers });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["cache-control"], "private, no-store");
  assert.deepEqual(result.json().versions.map((item: { revision: number }) => item.revision), [8, 7]);
  assert.equal(result.json().nextBefore, 7);
  assert.equal(result.json().currentRevision, 9);
});

test("foreign and absent history never returns document or private notes", async (t) => {
  const app = await createApp(t, {
    consultation: { findFirst: async () => null },
    consultationRevision: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { consultationId: id, revision: 2, consultation: { ownerUserId: "owner" } }); return null;
    } }
  });
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/history`, headers })).statusCode, 404);
  const response = await app.inject({ method: "GET", url: `/consultations/${id}/history/2`, headers });
  assert.equal(response.statusCode, 404);
  assert.equal("version" in response.json(), false);
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/history/zero`, headers })).statusCode, 400);
});

test("history detail returns validated rich or legacy content but no birth snapshot", async (t) => {
  const app = await createApp(t, { consultationRevision: { findFirst: async () => ({
    ...record, savedAt: record.updatedAt
  }) } });
  const result = await app.inject({ method: "GET", url: `/consultations/${id}/history/2`, headers });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json().version.content, draft.content);
  assert.equal(result.json().version.privateNotes, draft.privateNotes);
  assert.equal("sourceSnapshotJson" in result.json().version, false);
  assert.equal("ownerUserId" in result.json().version, false);
});

test("restoration creates a detached draft and keeps current private notes unless explicitly selected", () => {
  const current = { ...draft, status: "READY" } as ConsultationDraft;
  const previous = { ...current, title: "Previous title", privateNotes: "Older private notes", content: {
    version: 2, sections: [{ id: randomUUID(), title: "Old section", body: "Old text", forecastSources: [{
      forecastId: "cmf8exampleforecast00000001", eventId: "transit:0", generatedAt: "2026-09-19T00:00:00Z", timezone: "UTC"
    }] }]
  } } as ConsultationDraft;
  const restored = restoreConsultationDraft(current, previous, false);
  assert.equal(restored.status, "DRAFT");
  assert.equal(restored.title, previous.title);
  assert.equal(restored.privateNotes, current.privateNotes);
  assert.equal(restored.content.sections[0]!.forecastSources![0]!.forecastId, "cmf8exampleforecast00000001");
  assert.equal(restoreConsultationDraft(current, previous, true).privateNotes, previous.privateNotes);
  previous.content.sections[0]!.body = "Changed later";
  assert.equal(restored.content.sections[0]!.body, "Old text");
  assert.equal(current.status, "READY");
});

test("comparison treats legacy plain text and equivalent rich text as unchanged", () => {
  const sectionId = randomUUID();
  const before: ConsultationDraft = { title: "Document", status: "DRAFT", privateNotes: "", content: {
    version: 1, sections: [{ id: sectionId, title: "Section", body: "First\n\nSecond" }]
  } };
  const after: ConsultationDraft = { ...before, content: { version: 2, sections: [{ ...before.content.sections[0]!, body: plainTextToRich("First\n\nSecond") }] } };
  const original = JSON.stringify(before);
  assert.deepEqual(compareConsultationDrafts(before, after).counts, { added: 0, removed: 0, changed: 0, unchanged: 1 });
  assert.equal(JSON.stringify(before), original);
});

test("comparison separates formatting-only changes from edited text", () => {
  const sectionId = randomUUID();
  const before: ConsultationDraft = { title: "Document", status: "DRAFT", privateNotes: "", content: {
    version: 1, sections: [{ id: sectionId, title: "Section", body: "Text" }]
  } };
  const formatted = plainTextToRich("Text");
  formatted.content[0]!.content![0]!.marks = [{ type: "bold" }];
  const after: ConsultationDraft = { ...before, content: { version: 2, sections: [{ ...before.content.sections[0]!, body: formatted }] } };
  const formatting = compareConsultationDrafts(before, after).sections[0]!;
  assert.equal(formatting.kind, "changed");
  assert.equal(formatting.textChanged, false);
  assert.equal(formatting.formattingOnly, true);
  formatted.content[0]!.content![0]!.text = "Different text";
  assert.equal(compareConsultationDrafts(before, after).sections[0]!.textChanged, true);
});

test("comparison detects section additions and deletions without false movement", () => {
  const first = { id: randomUUID(), title: "Same title", body: "First" };
  const second = { id: randomUUID(), title: "Same title", body: "Second" };
  const added = { id: randomUUID(), title: "Added", body: "New" };
  const before: ConsultationDraft = { title: "Document", status: "DRAFT", privateNotes: "", content: { version: 1, sections: [first, second] } };
  const after: ConsultationDraft = { ...before, content: { version: 1, sections: [added, second] } };
  const result = compareConsultationDrafts(before, after);
  assert.deepEqual(result.counts, { added: 1, removed: 1, changed: 0, unchanged: 1 });
  assert.equal(result.sections.find((item) => item.id === second.id)!.moved, false);
  const swapped = compareConsultationDrafts(before, { ...before, content: { version: 1, sections: [second, first] } });
  assert.equal(swapped.sections.every((item) => item.moved), true);
});

test("comparison detects renaming, metadata and notes independently of body text", () => {
  const before: ConsultationDraft = { title: "Old", status: "DRAFT", privateNotes: "Private before", content: {
    version: 2, sections: [{ id: randomUUID(), title: "Old section", body: "Same text" }]
  } };
  const after: ConsultationDraft = { ...before, title: "New", status: "READY", privateNotes: "Private after", content: { version: 2, sections: [{
    ...before.content.sections[0]!, title: "Renamed", forecastSources: [{ forecastId: "cmf8exampleforecast00000001", eventId: "event:0", generatedAt: "2026-09-20T00:00:00Z", timezone: "UTC" }]
  }] } };
  const result = compareConsultationDrafts(before, after);
  assert.equal(result.titleChanged, true);
  assert.equal(result.statusChanged, true);
  assert.equal(result.notesChanged, true);
  assert.equal(result.sections[0]!.titleChanged, true);
  assert.equal(result.sections[0]!.sourcesChanged, true);
  assert.equal(result.sections[0]!.textChanged, false);
});

test("comparison ignores JSON key order, mark order and explicit default list attributes", () => {
  const sectionId = randomUUID();
  const before: ConsultationDraft = { title: "Document", status: "DRAFT", privateNotes: "", content: { version: 2, sections: [{
    id: sectionId, title: "Section", body: { type: "doc", content: [{ type: "orderedList", content: [{ type: "listItem", content: [{
      type: "paragraph", content: [{ type: "text", text: "Text", marks: [{ type: "bold" }, { type: "italic" }] }]
    }] }] }] }
  }] } };
  const after = structuredClone(before);
  const body = after.content.sections[0]!.body;
  assert.notEqual(typeof body, "string");
  if (typeof body === "string") return;
  body.content[0]!.attrs = { type: "1", start: 1 };
  body.content[0]!.content![0]!.content![0]!.content![0] = { marks: [{ type: "italic" }, { type: "bold" }], text: "Text", type: "text" };
  assert.equal(compareConsultationDrafts(before, after).sections[0]!.kind, "unchanged");
});

const printChartFixture = () => ({
  settings: { houseSystem: "koch", zodiac: "tropical", privateNotes: "SECRET" },
  subject: { utcDateTime: "1990-01-01T10:00:00Z", birthTimeKnown: true, latitude: 50.45, longitude: 30.52 },
  bodies: [
    { key: "moon", label: "Moon", kind: "planet", longitude: 21, sign: "aries", signDegree: 21, house: 2, speed: 12, privateNotes: "SECRET" },
    { key: "sun", label: "Sun", kind: "planet", longitude: 12.5, sign: "aries", signDegree: 12.5, house: 1, speed: 1 }
  ], angles: [], houses: [],
  aspects: [{ bodyA: "sun", bodyB: "moon", type: "conjunction", exactAngle: 0, orb: 8.5, privateNotes: "SECRET" },
    { bodyA: "sun", bodyB: "asc", type: "square", exactAngle: 90, orb: 1 }],
  interpretation: "SECRET", privateNotes: "SECRET"
});

test("print projection strips nested secrets and preserves stored positions without recalculation", () => {
  const chart = printChartFixture();
  const forecast = { id: "cmf8exampleforecast00000001", title: "Solar", inputJson: { notes: "SECRET", context: { subject: { displayName: "Client", privateNotes: "SECRET" } } }, resultJson: {
    natal: chart, generatedAt: "2026-09-20T10:00:00Z", privateNotes: "SECRET",
    solarReturn: { exactAt: "2026-01-01T10:30:00Z", chart, interpretation: "SECRET" },
    timelineEvents: [{ id: "one", source: "transit", exactAt: "2026-10-01T12:00:00+03:00", bodyA: "sun", bodyB: "moon", privateNotes: "SECRET" }]
  } };
  const before = JSON.stringify(forecast);
  const result = projectPrintAssets({ chart, privateNotes: "SECRET" }, forecast);
  assert.equal(result.forecast!.compatibility, "match");
  assert.equal(JSON.stringify(result).includes("SECRET"), false);
  assert.equal(result.natal!.bodies[1]!.longitude, 12.5);
  assert.equal(result.forecast!.solarReturn!.exactAt, "2026-01-01T10:30:00Z");
  assert.equal(JSON.stringify(forecast), before);
  const changed = structuredClone(chart);
  changed.subject.utcDateTime = "1990-01-02T10:00:00Z";
  assert.equal(projectPrintAssets({ chart: changed }, forecast).forecast!.compatibility, "different");
  assert.equal(projectPrintAssets({ chart: { settings: chart.settings } }).natal, null);
});

test("print assets require the expected consultation revision before reading any archive", async (t) => {
  const app = await createApp(t, { consultation: { findFirst: async (args: { where: unknown; select: Record<string, unknown> }) => {
    assert.deepEqual(args.where, { id, ownerUserId: "owner" });
    assert.equal(args.select.privateNotes, undefined);
    return { revision: 3, sourceSnapshotJson: { chart: printChartFixture() } };
  } } });
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/print-assets?revision=2&forecastId=other`, headers })).statusCode, 409);
});

test("print assets reject foreign forecasts and select no archive notes", async (t) => {
  const app = await createApp(t, {
    consultation: { findFirst: async () => ({ revision: 2, sourceSnapshotJson: { chart: printChartFixture() } }) },
    savedForecast: { findFirst: async (args: { where: unknown; select: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { id: "foreign", ownerUserId: "owner", kind: "forecast" });
      assert.equal(args.select.notes, undefined);
      assert.equal(args.select.interpretationJson, undefined);
      return null;
    } }
  });
  assert.equal((await app.inject({ method: "GET", url: `/consultations/${id}/print-assets?revision=2&forecastId=foreign`, headers })).statusCode, 404);
});

test("print archive returns metadata only and requires the consultation owner", async (t) => {
  const app = await createApp(t, {
    consultation: { findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return { id }; } },
    savedForecast: { findMany: async (args: { where: unknown; select: unknown }) => {
      assert.deepEqual(args.where, { ownerUserId: "owner", kind: "forecast" });
      assert.deepEqual(args.select, { id: true, title: true, createdAt: true });
      return [];
    } }
  });
  const result = await app.inject({ method: "GET", url: `/consultations/${id}/print-forecasts`, headers });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["cache-control"], "private, no-store");
});

test("print tables retain precision, order planets and omit cusp aspects without mutating snapshots", () => {
  const chart: PrintChart = printChartFixture();
  const before = JSON.stringify(chart);
  assert.equal(printPoints(chart)[0]!.key, "sun");
  assert.equal(printAspects(chart).length, 1);
  assert.equal(printDegree(12.5), "12°30′00″");
  assert.equal(printDegree(29.99999999999), "29°59′59″");
  assert.equal(JSON.stringify(chart), before);
  const forecast: NonNullable<PrintAssets["forecast"]> = {
    id: "one", title: "Solar", subjectName: "Client", generatedAt: "2026-09-20T10:00:00Z", compatibility: "match",
    solarReturn: { exactAt: "2026-10-01T09:00:00Z", chart }, events: [
      { id: "same", source: "transit", exactAt: "2026-10-02T09:00:00Z" },
      { id: "same", source: "solar-return", exactAt: "2026-10-01T12:00:00+03:00" }
    ]
  };
  const events = printEvents(forecast);
  assert.equal(events.length, 2);
  assert.equal(events[0]!.source, "solar-return");
  assert.equal(new Set(events.map((event) => event.id)).size, 2);
});
