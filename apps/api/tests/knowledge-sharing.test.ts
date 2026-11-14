import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerKnowledgeSharingRoutes, publicationView, type KnowledgeSharingDependencies } from "../src/knowledge-notes/sharing-routes";
import { libraryQuerySchema, publicationSchema, sharedKnowledgeAccess } from "../src/knowledge-notes/sharing";

const id = randomUUID();
const headers = { authorization: "Bearer reader" };
const conditions = { version: 1, scope: "natal", match: "all", items: [{ kind: "house", planet: "mercury", house: 5 }] };
const chart = { chartType: "natal", birthTimeKnown: true, bodies: [{ key: "mercury", sign: "virgo", house: 5, speed: 1 }], aspects: [] };
const record = { noteId: id, title: "Public title", body: "Public body", tags: [], conditionsJson: conditions,
  revision: 2, sourceRevision: 3, published: true, createdAt: new Date(), updatedAt: new Date(), note: { owner: { username: "author" } } };
const until = () => new Date(Date.now() + 3600000);
const unexpected = () => assert.fail("Unexpected database access");
const createApp = async (t: TestContext, database: unknown = {}) => {
  const app = Fastify();
  await registerKnowledgeSharingRoutes(app, {
    authenticate: async (request) => request.headers.authorization === headers.authorization ? { id: "reader" } : null,
    database: database as KnowledgeSharingDependencies["database"]
  });
  t.after(() => app.close());
  return app;
};
const transaction = (tx: unknown) => async (work: (client: unknown) => Promise<unknown>, options: unknown) => {
  assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return work(tx);
};

test("sharing endpoints require authentication before accessing any data", async (t) => {
  const app = await createApp(t);
  for (const [method, url] of [
    ["GET", "/knowledge-library/access"], ["GET", "/knowledge-library"], ["GET", `/knowledge-library/${id}`],
    ["POST", "/knowledge-library/matches"], ["POST", "/knowledge-library/author-activation"], ["PUT", `/knowledge-library/${id}/activation`], ["DELETE", `/knowledge-library/${id}/activation`],
    ["GET", `/knowledge-notes/${id}/publication`], ["PUT", `/knowledge-notes/${id}/publication`], ["DELETE", `/knowledge-notes/${id}/publication`]
  ] as const) assert.equal((await app.inject({ method, url })).statusCode, 401);
});

test("access expires at the exact boundary and missing access is free", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  for (const date of [null, undefined, now, new Date(now.getTime() - 1)]) assert.equal(sharedKnowledgeAccess(date, now).enabled, false);
  assert.equal(sharedKnowledgeAccess(new Date(now.getTime() + 1), now).enabled, true);
});

test("free users cannot read shared text or activate notes; shared matches stay empty", async (t) => {
  const user = { findUnique: async (args: { where: unknown; select: unknown }) => {
    assert.deepEqual(args.where, { id: "reader" });
    assert.deepEqual(args.select, { sharedKnowledgeUntil: true });
    return { sharedKnowledgeUntil: null };
  } };
  const db = { user, knowledgePublication: { findFirst: unexpected, findMany: unexpected }, knowledgeActivation: { findMany: unexpected, upsert: unexpected } };
  const app = await createApp(t, { ...db, $transaction: transaction(db) });
  for (const url of ["/knowledge-library", `/knowledge-library/${id}`]) assert.equal((await app.inject({ method: "GET", url, headers })).statusCode, 403);
  assert.equal((await app.inject({ method: "PUT", url: `/knowledge-library/${id}/activation`, headers, payload: { revision: 2 } })).statusCode, 403);
  const response = await app.inject({ method: "POST", url: "/knowledge-library/matches", headers, payload: { chart } });
  assert.deepEqual(response.json(), { matches: [], nextCursor: null, access: { enabled: false, expiresAt: null } });
  assert.equal(response.headers["cache-control"], "private, no-store");
});

test("shared DTO contains author attribution but no private source or history", () => {
  const dto = publicationView({ ...record, sourceProfileId: "private", sourceLabel: "Client", history: ["private"], ownerUserId: "secret" } as Parameters<typeof publicationView>[0]);
  assert.equal(dto.authorUsername, "author");
  assert.equal(dto.origin, "shared");
  for (const field of ["sourceProfileId", "sourceLabel", "history", "ownerUserId", "note", "body", "sourceRevision"]) assert.equal(field in dto, false);
});

test("catalog filters unpublished, archived and own notes and returns only the reader's activation", async (t) => {
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgePublication: { findMany: async (args: { where: { AND: unknown[] }; select: Record<string, unknown>; take: number }) => {
      assert.deepEqual(args.where.AND[0], { published: true, note: { archived: false, ownerUserId: { not: "reader" } } });
      assert.ok(args.where.AND.some((item) => JSON.stringify(item) === JSON.stringify({ activations: { some: { userId: "reader" } } })));
      assert.deepEqual(args.select.activations, { where: { userId: "reader" }, select: { acceptedRevision: true } });
      assert.equal(args.select.body, undefined); assert.equal(args.take, 21);
      return [{ ...record, activations: [{ acceptedRevision: 1 }] }];
    } }
  });
  const response = await app.inject({ method: "GET", url: "/knowledge-library?view=active&author=author&query=Public", headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().notes[0].updateAvailable, true);
});

test("direct shared links still enforce availability and never expose the private note", async (t) => {
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgePublication: { findFirst: async (args: { where: unknown; select: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { noteId: id, published: true, note: { archived: false, ownerUserId: { not: "reader" } } });
      assert.deepEqual(args.select.note, { select: { owner: { select: { username: true } } } });
      return null;
    } }
  });
  assert.equal((await app.inject({ method: "GET", url: `/knowledge-library/${id}`, headers })).statusCode, 404);
});

test("ranking author links filter by exact owner ID while preserving publication restrictions", async (t) => {
  const authorId = "cmf8exampleauthor000000001";
  assert.equal(libraryQuerySchema.safeParse({ authorId }).success, true);
  assert.equal(libraryQuerySchema.safeParse({ authorId: "invalid" }).success, false);
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgePublication: { findMany: async (args: { where: { AND: unknown[] } }) => {
      assert.deepEqual(args.where.AND, [
        { published: true, note: { archived: false, ownerUserId: { not: "reader" } } },
        { note: { ownerUserId: authorId } }
      ]);
      return [];
    } }
  });
  assert.equal((await app.inject({ method: "GET", url: `/knowledge-library?authorId=${authorId}`, headers })).statusCode, 200);
});

test("general search also finds author usernames without case sensitivity", async (t) => {
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgePublication: { findMany: async (args: { where: { AND: unknown[] } }) => {
      assert.deepEqual(args.where.AND[1], { OR: [
        { title: { contains: "@Author", mode: "insensitive" } }, { tags: { has: "@Author" } },
        { note: { owner: { username: { contains: "Author", mode: "insensitive" } } } }
      ] });
      return [{ ...record, activations: [] }];
    } }
  });
  const response = await app.inject({ method: "GET", url: "/knowledge-library?query=%40Author", headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().notes[0].authorUsername, "author");
});

test("author activation grants only new available publications and keeps existing revisions", async (t) => {
  const authorId = "cmf8exampleauthor000000001";
  let enabled = false;
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: enabled ? until() : null }) },
    knowledgePublication: { findMany: async (args: { where: unknown; take: number }) => {
      assert.equal(enabled, true);
      assert.deepEqual(args.where, { AND: [
        { published: true, note: { archived: false, ownerUserId: { not: "reader" } } },
        { note: { ownerUserId: authorId } }, { activations: { none: { userId: "reader" } } }
      ] });
      assert.equal(args.take, 500);
      return writes ? [] : [{ noteId: id, revision: 2 }];
    } },
    knowledgeActivation: { createMany: async (args: unknown) => {
      assert.deepEqual(args, { data: [{ userId: "reader", publicationId: id, acceptedRevision: 2 }], skipDuplicates: true });
      writes++;
      return { count: 1 };
    } }
  };
  const app = await createApp(t, { $transaction: transaction(tx) });
  const send = () => app.inject({ method: "POST", url: "/knowledge-library/author-activation", headers, payload: { authorId } });
  assert.equal((await send()).statusCode, 403);
  assert.equal(writes, 0);
  enabled = true;
  const response = await send();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { activated: 1 });
  assert.deepEqual((await send()).json(), { activated: 0 });
  assert.equal(writes, 1);
  assert.equal((await app.inject({ method: "POST", url: "/knowledge-library/author-activation", headers, payload: { authorId: "invalid" } })).statusCode, 400);
});

test("activation checks entitlement and revision inside one transaction", async (t) => {
  let revision = 1;
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgePublication: { findFirst: async () => ({ noteId: id, revision }) },
    knowledgeActivation: { upsert: async (args: { where: unknown; create: unknown; update: unknown }) => {
      assert.deepEqual(args.where, { userId_publicationId: { userId: "reader", publicationId: id } });
      assert.deepEqual(args.create, { userId: "reader", publicationId: id, acceptedRevision: 2 });
      assert.deepEqual(args.update, { acceptedRevision: 2 }); writes++; return {};
    } }
  };
  const app = await createApp(t, { $transaction: transaction(tx) });
  const send = () => app.inject({ method: "PUT", url: `/knowledge-library/${id}/activation`, headers, payload: { revision: 2 } });
  assert.equal((await send()).statusCode, 409); assert.equal(writes, 0);
  revision = 2;
  assert.equal((await send()).statusCode, 200); assert.equal(writes, 1);
});

test("an expired user may still remove their own activation", async (t) => {
  const app = await createApp(t, { knowledgeActivation: { deleteMany: async (args: { where: unknown }) => {
    assert.deepEqual(args.where, { userId: "reader", publicationId: id }); return { count: 1 };
  } } });
  assert.equal((await app.inject({ method: "DELETE", url: `/knowledge-library/${id}/activation`, headers })).statusCode, 200);
});

test("shared matches include only activated, accepted revisions and reuse natal matching", async (t) => {
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgeActivation: { findMany: async (args: { where: unknown; take: number; select: Record<string, unknown> }) => {
      assert.deepEqual(args.where, { userId: "reader", publication: { published: true, note: { archived: false, ownerUserId: { not: "reader" } } } });
      assert.equal(args.take, 501);
      return [
        { publicationId: id, acceptedRevision: 2, publication: record },
        { publicationId: randomUUID(), acceptedRevision: 1, publication: record },
        { publicationId: randomUUID(), acceptedRevision: 2, publication: { ...record, conditionsJson: { ...conditions, items: [{ kind: "house", planet: "mercury", house: 6 }] } } }
      ];
    } }
  });
  const response = await app.inject({ method: "POST", url: "/knowledge-library/matches", headers, payload: { chart } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().matches.length, 1);
  assert.equal(response.json().matches[0].authorUsername, "author");
  assert.equal("body" in response.json().matches[0], false);
});

test("shared matching is bounded and preserves a cursor for sparse libraries", async (t) => {
  const records = Array.from({ length: 501 }, () => ({ publicationId: randomUUID(), acceptedRevision: 1, publication: record }));
  const app = await createApp(t, {
    user: { findUnique: async () => ({ sharedKnowledgeUntil: until() }) },
    knowledgeActivation: { findMany: async () => records }
  });
  const response = await app.inject({ method: "POST", url: "/knowledge-library/matches", headers, payload: { chart } });
  assert.deepEqual(response.json().matches, []);
  assert.equal(response.json().nextCursor, records[499]!.publicationId);
});

const publish = { noteRevision: 3, publicationRevision: null, title: "Public title", body: "Public body", tags: [], consent: true };
test("publication requires explicit consent and rejects source or owner injection", () => {
  assert.equal(publicationSchema.safeParse(publish).success, true);
  for (const payload of [{ ...publish, consent: false }, { ...publish, sourceProfileId: "client" }, { ...publish, ownerUserId: "other" }, { ...publish, conditions: {} }]) {
    assert.equal(publicationSchema.safeParse(payload).success, false);
  }
});

test("publishing uses separately approved text and never edits the private note", async (t) => {
  const tx = {
    knowledgeNote: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { id, ownerUserId: "reader" });
      return { id, revision: 3, archived: false, title: "Client title", body: "Sensitive client details", sourceProfileId: "secret", conditionsJson: conditions };
    }, update: unexpected },
    knowledgePublication: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assert.deepEqual(data, { noteId: id, title: publish.title, body: publish.body, tags: [], conditionsJson: conditions, sourceRevision: 3, published: true });
        return { ...data, revision: 1 };
      }
    }
  };
  const app = await createApp(t, { $transaction: transaction(tx) });
  const response = await app.inject({ method: "PUT", url: `/knowledge-notes/${id}/publication`, headers, payload: publish });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().publication.body, "Public body");
});

test("foreign, archived and stale private notes cannot be published", async (t) => {
  let note: { id: string; archived: boolean; revision: number } | null = null;
  const app = await createApp(t, { $transaction: transaction({ knowledgeNote: { findFirst: async () => note }, knowledgePublication: { findUnique: unexpected } }) });
  const send = () => app.inject({ method: "PUT", url: `/knowledge-notes/${id}/publication`, headers, payload: publish });
  assert.equal((await send()).statusCode, 404);
  note = { id, archived: true, revision: 3 }; assert.equal((await send()).statusCode, 409);
  note = { id, archived: false, revision: 4 }; assert.equal((await send()).statusCode, 409);
});

test("withdrawal is owner/revision scoped and invalidates previously accepted revisions", async (t) => {
  const app = await createApp(t, { knowledgePublication: { updateMany: async (args: { where: unknown; data: unknown }) => {
    assert.deepEqual(args.where, { noteId: id, revision: 2, note: { ownerUserId: "reader" } });
    assert.deepEqual(args.data, { published: false, revision: { increment: 1 } });
    return { count: 1 };
  } } });
  assert.equal((await app.inject({ method: "DELETE", url: `/knowledge-notes/${id}/publication`, headers, payload: { revision: 2 } })).statusCode, 200);
});
