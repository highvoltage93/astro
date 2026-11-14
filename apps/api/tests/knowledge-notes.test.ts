import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerKnowledgeNoteRoutes, type KnowledgeDependencies } from "../src/knowledge-notes/routes";
import { createNoteSchema, matchNotesSchema, noteDraftSchema, updateNoteSchema } from "../src/knowledge-notes/schemas";
import { matchingConditions, type KnowledgeChartFacts } from "../src/knowledge-notes/matching";

const id = randomUUID();
const sourceId = "cmf8exampleprofile00000001";
const headers = { authorization: "Bearer owner" };
const draft = { title: "Mercury observation", body: "Observed result", tags: ["work"], archived: false,
  conditions: { version: 1, scope: "natal", match: "all", items: [{ kind: "house", planet: "mercury", house: 5 }] } };
const record = { id, ownerUserId: "owner", ...draft, conditionsJson: draft.conditions,
  sourceProfileId: null, sourceLabel: null, revision: 1, createdAt: new Date(), updatedAt: new Date() };
const missing = () => new Prisma.PrismaClientKnownRequestError("Missing revision", { code: "P2025", clientVersion: "5.18.0" });
const transaction = (tx: unknown) => async (work: (client: unknown) => Promise<unknown>) => work(tx);
const createApp = async (t: TestContext, database: unknown = {}) => {
  const app = Fastify();
  await registerKnowledgeNoteRoutes(app, {
    authenticate: async (request) => request.headers.authorization === headers.authorization ? { id: "owner" } : null,
    database: database as KnowledgeDependencies["database"]
  });
  t.after(() => app.close());
  return app;
};

test("every knowledge operation requires authentication before database access", async (t) => {
  const app = await createApp(t);
  for (const request of [
    { method: "GET" as const, url: "/knowledge-notes/" },
    { method: "GET" as const, url: `/knowledge-notes/${id}` },
    { method: "POST" as const, url: "/knowledge-notes/", payload: {} },
    { method: "POST" as const, url: "/knowledge-notes/matches", payload: {} },
    { method: "PUT" as const, url: `/knowledge-notes/${id}`, payload: {} },
    { method: "DELETE" as const, url: `/knowledge-notes/${id}?revision=1` },
    { method: "GET" as const, url: `/knowledge-notes/${id}/history` },
    { method: "GET" as const, url: `/knowledge-notes/${id}/history/1` }
  ]) assert.equal((await app.inject(request)).statusCode, 401);
});

test("list is owner scoped, searchable, archived-filtered, and excludes note bodies", async (t) => {
  const app = await createApp(t, { knowledgeNote: { findMany: async (args: { where: Record<string, unknown>; select: Record<string, unknown>; take: number }) => {
    assert.equal(args.where.ownerUserId, "owner");
    assert.equal(args.where.archived, true);
    assert.deepEqual(args.where.AND, [{ OR: [
      { title: { contains: "work", mode: "insensitive" } },
      { body: { contains: "work", mode: "insensitive" } }, { tags: { has: "work" } }
    ] }]);
    assert.equal(args.select.body, undefined);
    assert.equal(args.select.ownerUserId, undefined);
    assert.equal(args.take, 21);
    return [];
  } } });
  const response = await app.inject({ method: "GET", url: "/knowledge-notes/?status=archived&query=work", headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
});

test("foreign notes, history, and cursors never reveal private data", async (t) => {
  const app = await createApp(t, {
    knowledgeNote: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return null;
    } },
    knowledgeNoteRevision: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { noteId: id, revision: 1, note: { ownerUserId: "owner" } }); return null;
    } }
  });
  for (const path of [id, `${id}/history`, `${id}/history/1`]) {
    assert.equal((await app.inject({ method: "GET", url: `/knowledge-notes/${path}`, headers })).statusCode, 404);
  }
  assert.equal((await app.inject({ method: "GET", url: `/knowledge-notes/?cursor=${id}`, headers })).statusCode, 400);
});

test("creation writes both the note and first revision in one transaction", async (t) => {
  let savedHistory = false;
  const tx = {
    birthProfile: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id: sourceId, ownerUserId: "owner" }); return { id: sourceId, displayName: "Source" };
    } },
    knowledgeNote: { findUnique: async () => null, create: async (args: { data: Record<string, unknown> }) => {
      assert.equal(args.data.ownerUserId, "owner");
      assert.equal(args.data.sourceProfileId, sourceId);
      assert.deepEqual(args.data.conditionsJson, draft.conditions);
      return { ...record, sourceProfileId: sourceId, sourceLabel: "Source" };
    } },
    knowledgeNoteRevision: { create: async (args: { data: Record<string, unknown> }) => {
      assert.equal(args.data.noteId, id); assert.equal(args.data.revision, 1);
      assert.equal(args.data.body, draft.body); savedHistory = true;
    } }
  };
  const app = await createApp(t, { $transaction: transaction(tx) });
  const response = await app.inject({ method: "POST", url: "/knowledge-notes/", headers, payload: { id, draft, sourceProfileId: sourceId } });
  assert.equal(response.statusCode, 201);
  assert.equal(savedHistory, true);
  assert.equal(response.json().note.sourceLabel, "Source");
  assert.equal("ownerUserId" in response.json().note, false);
});

test("a foreign source cannot be attached even if its ID is known", async (t) => {
  const app = await createApp(t, { $transaction: transaction({
    knowledgeNote: { findUnique: async () => null },
    birthProfile: { findFirst: async () => null }
  }) });
  const response = await app.inject({ method: "POST", url: "/knowledge-notes/", headers, payload: { id, draft, sourceProfileId: sourceId } });
  assert.equal(response.statusCode, 404);
});

test("creation retry is idempotent and rejects changed drafts and foreign ownership", async (t) => {
  let stored = record;
  const app = await createApp(t, { $transaction: transaction({ knowledgeNote: { findUnique: async () => stored } }) });
  const send = (body = draft) => app.inject({ method: "POST", url: "/knowledge-notes/", headers, payload: { id, draft: body } });
  assert.equal((await send()).statusCode, 201);
  assert.equal((await send({ ...draft, body: "Different content" })).statusCode, 409);
  stored = { ...record, ownerUserId: "other" };
  assert.equal((await send()).statusCode, 409);
});

test("update is owner and revision scoped and snapshots the new content", async (t) => {
  let historyCount = 0;
  const app = await createApp(t, { $transaction: transaction({
    knowledgeNote: { update: async (args: { where: unknown; data: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 1 });
      assert.deepEqual(args.data.revision, { increment: 1 });
      return { ...record, body: "Updated", revision: 2 };
    } },
    knowledgeNoteRevision: { create: async (args: { data: Record<string, unknown> }) => {
      assert.equal(args.data.revision, 2); assert.equal(args.data.body, "Updated"); historyCount++;
    } }
  }) });
  const response = await app.inject({ method: "PUT", url: `/knowledge-notes/${id}`, headers, payload: { revision: 1, draft: { ...draft, body: "Updated" } } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().note.revision, 2);
  assert.equal(historyCount, 1);
});

test("stale edits and deletions conflict; foreign edits return not found", async (t) => {
  let owned = true;
  const app = await createApp(t, {
    $transaction: transaction({ knowledgeNote: { update: async () => { throw missing(); } } }),
    knowledgeNote: {
      findFirst: async (args: { where: unknown }) => {
        assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return owned ? { id } : null;
      },
      deleteMany: async (args: { where: unknown }) => {
        assert.deepEqual(args.where, { id, ownerUserId: "owner", revision: 1 }); return { count: 0 };
      }
    }
  });
  const update = () => app.inject({ method: "PUT", url: `/knowledge-notes/${id}`, headers, payload: { revision: 1, draft } });
  assert.equal((await update()).statusCode, 409);
  assert.equal((await app.inject({ method: "DELETE", url: `/knowledge-notes/${id}?revision=1`, headers })).statusCode, 409);
  owned = false;
  assert.equal((await update()).statusCode, 404);
});

test("archiving a private note withdraws its public snapshot in the same transaction", async (t) => {
  let withdrawn = false;
  const app = await createApp(t, { $transaction: transaction({
    knowledgeNote: { update: async () => ({ ...record, archived: true, revision: 2 }) },
    knowledgeNoteRevision: { create: async () => ({}) },
    knowledgePublication: { updateMany: async (args: { where: unknown; data: unknown }) => {
      assert.deepEqual(args.where, { noteId: id, published: true });
      assert.deepEqual(args.data, { published: false, revision: { increment: 1 } });
      withdrawn = true; return { count: 1 };
    } }
  }) });
  const response = await app.inject({ method: "PUT", url: `/knowledge-notes/${id}`, headers, payload: { revision: 1, draft: { ...draft, archived: true } } });
  assert.equal(response.statusCode, 200); assert.equal(withdrawn, true);
});

test("history pages keep owner scope, revision ordering, and bounded page sizes", async (t) => {
  const app = await createApp(t, {
    knowledgeNote: { findFirst: async () => ({ id }) },
    knowledgeNoteRevision: { findMany: async (args: { where: unknown; orderBy: unknown; take: number; select: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { noteId: id, note: { ownerUserId: "owner" }, revision: { lt: 30 } });
      assert.deepEqual(args.orderBy, { revision: "desc" });
      assert.equal(args.take, 21);
      assert.equal(args.select.body, undefined);
      return Array.from({ length: 21 }, (_, index) => ({ revision: 29 - index, title: "Title", savedAt: new Date() }));
    } }
  });
  const response = await app.inject({ method: "GET", url: `/knowledge-notes/${id}/history?before=30`, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().history.length, 20);
  assert.equal(response.json().nextBefore, 10);
});

test("schema validates structured conditions and rejects ownership injection", () => {
  assert.equal(noteDraftSchema.safeParse(draft).success, true);
  for (const invalid of [
    { ...draft, title: " " }, { ...draft, body: "x".repeat(20001) },
    { ...draft, ownerUserId: "other" },
    { ...draft, tags: Array.from({ length: 11 }, (_, i) => String(i)) },
    { ...draft, conditions: { ...draft.conditions, items: [] } },
    { ...draft, conditions: { ...draft.conditions, items: [{ kind: "house", planet: "mercury", house: 13 }] } },
    { ...draft, conditions: { ...draft.conditions, items: [{ kind: "aspect", planet: "sun", otherPlanet: "sun", aspect: "trine" }] } },
    { ...draft, conditions: { ...draft.conditions, scope: "transit" } }
  ]) assert.equal(noteDraftSchema.safeParse(invalid).success, false);
  assert.equal(createNoteSchema.safeParse({ id, draft, ownerUserId: "other" }).success, false);
  assert.equal(updateNoteSchema.safeParse({ revision: 0, draft }).success, false);
  assert.deepEqual(noteDraftSchema.parse({ ...draft, tags: ["work", " work "] }).tags, ["work"]);
});

const chart: KnowledgeChartFacts = {
  chartType: "natal", birthTimeKnown: true,
  bodies: [{ key: "mercury", sign: "virgo", house: 5, speed: -0.5 }, { key: "saturn", sign: "pisces", house: 11, speed: 0.03 }],
  aspects: [{ bodyA: "saturn", bodyB: "mercury", type: "opposition" }]
};
const combined = { version: 1, scope: "natal", match: "all", items: [
  { kind: "house", planet: "mercury", house: 5 },
  { kind: "sign", planet: "mercury", sign: "virgo" },
  { kind: "retrograde", planet: "mercury" },
  { kind: "aspect", planet: "mercury", otherPlanet: "saturn", aspect: "opposition" }
] };

test("matching requires every condition and accepts either aspect endpoint order", () => {
  assert.deepEqual(matchingConditions(combined, chart), combined);
  assert.deepEqual(matchingConditions(combined, { ...chart, aspects: [{ bodyA: "mercury", bodyB: "saturn", type: "opposition" }] }), combined);
  assert.equal(matchingConditions(combined, { ...chart, aspects: [] }), null);
  assert.equal(matchingConditions(combined, { ...chart, aspects: [{ bodyA: "mercury", bodyB: "saturn", type: "trine" }] }), null);
  assert.equal(matchingConditions(combined, { ...chart, bodies: chart.bodies.map((body) => ({ ...body, house: 6 })) }), null);
  assert.equal(matchingConditions(combined, { ...chart, bodies: chart.bodies.map((body) => ({ ...body, sign: "aries" })) }), null);
});

test("unknown birth time cannot match houses, but can match an available sign", () => {
  const unknownTime = { ...chart, birthTimeKnown: false };
  assert.equal(matchingConditions(combined, unknownTime), null);
  assert.notEqual(matchingConditions({ ...combined, items: [{ kind: "sign", planet: "mercury", sign: "virgo" }] }, unknownTime), null);
});

test("missing bodies, unsupported conditions, stationary or missing speed fail closed", () => {
  assert.equal(matchingConditions(combined, { ...chart, bodies: [chart.bodies[0]!] }), null);
  assert.equal(matchingConditions({ ...combined, version: 2 }, chart), null);
  assert.equal(matchingConditions({ ...combined, items: [] }, chart), null);
  assert.equal(matchingConditions({ ...combined, items: [{ kind: "unknown", planet: "mercury" }] }, chart), null);
  assert.equal(matchingConditions({ ...combined, items: [{ kind: "aspect", planet: "mercury", otherPlanet: "mercury", aspect: "conjunction" }] }, chart), null);
  for (const speed of [0, -0.00001, -0.0001, 0.5, undefined]) {
    assert.equal(matchingConditions(combined, { ...chart, bodies: chart.bodies.map((body) => ({ ...body, speed })) }), null);
  }
});

test("matches endpoint is owner scoped, excludes archives, and returns no note text", async (t) => {
  const app = await createApp(t, { knowledgeNote: { findMany: async (args: { where: unknown; select: Record<string, unknown>; take: number }) => {
    assert.deepEqual(args.where, { ownerUserId: "owner", archived: false });
    assert.equal(args.select.body, undefined); assert.equal(args.select.ownerUserId, undefined);
    assert.equal(args.take, 501);
    return [{ id, title: draft.title, tags: [], archived: false, revision: 1, createdAt: record.createdAt, updatedAt: record.updatedAt, conditionsJson: combined }];
  } } });
  const response = await app.inject({ method: "POST", url: "/knowledge-notes/matches", headers, payload: { chart } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(response.json().matches[0].id, id);
  assert.deepEqual(response.json().matches[0].conditions, combined);
  assert.equal("body" in response.json().matches[0], false);
  assert.equal(response.json().nextCursor, null);
});

test("match results stop at 20 with a cursor at the last processed note", async (t) => {
  const records = Array.from({ length: 22 }, () => ({ id: randomUUID(), conditionsJson: combined }));
  const app = await createApp(t, { knowledgeNote: { findMany: async () => records } });
  const response = await app.inject({ method: "POST", url: "/knowledge-notes/matches", headers, payload: { chart } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().matches.length, 20);
  assert.equal(response.json().nextCursor, records[19]!.id);
});

test("a sparse library is scanned in bounded pages, not reported as complete", async (t) => {
  const records = Array.from({ length: 501 }, () => ({ id: randomUUID(), conditionsJson: { ...combined, version: 2 } }));
  const app = await createApp(t, { knowledgeNote: { findMany: async () => records } });
  const response = await app.inject({ method: "POST", url: "/knowledge-notes/matches", headers, payload: { chart } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().matches, []);
  assert.equal(response.json().nextCursor, records[499]!.id);
});

test("match pagination checks cursor ownership and uses stable keyset boundaries", async (t) => {
  let owned = false;
  const app = await createApp(t, { knowledgeNote: {
    findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id, ownerUserId: "owner" }); return owned ? { id, createdAt: record.createdAt } : null;
    },
    findMany: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { ownerUserId: "owner", archived: false, OR: [
        { createdAt: { lt: record.createdAt } }, { createdAt: record.createdAt, id: { lt: id } }
      ] }); return [];
    }
  } });
  const send = () => app.inject({ method: "POST", url: "/knowledge-notes/matches", headers, payload: { chart, cursor: id } });
  assert.equal((await send()).statusCode, 400);
  owned = true;
  assert.equal((await send()).statusCode, 200);
});

test("matching request rejects unsupported chart types, duplicates, and owner injection", () => {
  assert.equal(matchNotesSchema.safeParse({ chart }).success, true);
  assert.equal(matchNotesSchema.safeParse({ chart, ownerUserId: "other" }).success, false);
  assert.equal(matchNotesSchema.safeParse({ chart: { ...chart, chartType: "progression" } }).success, false);
  assert.equal(matchNotesSchema.safeParse({ chart: { ...chart, bodies: [chart.bodies[0], chart.bodies[0]] } }).success, false);
  assert.equal(matchNotesSchema.safeParse({ chart: { ...chart, bodies: Array(33).fill(chart.bodies[0]) } }).success, false);
});
