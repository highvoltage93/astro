import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import { registerAdminKnowledgeRoutes } from "../src/admin/knowledge";

test("private observations require a current administrator role on every request", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  let actor: { id: string; role: string } | null = null;
  await registerAdminKnowledgeRoutes(app, {
    authenticate: async () => actor,
    database: {} as NonNullable<Parameters<typeof registerAdminKnowledgeRoutes>[1]>["database"]
  });
  for (const role of [null, "USER", "CONSULTANT"]) {
    actor = role ? { id: "reader", role } : null;
    for (const url of ["/admin/knowledge-notes/", `/admin/knowledge-notes/${randomUUID()}`]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, role ? 403 : 401);
      assert.equal(response.headers["cache-control"], "private, no-store");
    }
  }
});

test("admin reads archived private notes with an audit entry and no publication mutation", async (t) => {
  const id = randomUUID();
  const app = Fastify();
  t.after(() => app.close());
  const note = { id, title: "Private", body: "Private text", archived: true, publication: null };
  let audits = 0;
  const db = {
    knowledgeNote: {
      findMany: async (args: { where: Record<string, unknown>; select: Record<string, unknown>; take: number }) => {
        assert.equal(args.where.ownerUserId, "cmf8exampleauthor000000001");
        assert.equal(args.where.archived, undefined);
        assert.equal(args.where.publication, undefined);
        assert.equal(args.select.body, undefined);
        assert.equal(args.take, 26);
        return [{ id, title: "Private", archived: true }];
      },
      findUnique: async (args: { where: unknown }) => {
        assert.deepEqual(args.where, { id });
        return note;
      }
    },
    auditEvent: { create: async (args: unknown) => {
      assert.deepEqual(args, { data: { userId: "admin", action: "admin.knowledge.read", entity: "KnowledgeNote", entityId: id } });
      audits++; return {};
    } }
  };
  await registerAdminKnowledgeRoutes(app, {
    authenticate: async () => ({ id: "admin", role: "ADMIN" }),
    database: db as unknown as NonNullable<Parameters<typeof registerAdminKnowledgeRoutes>[1]>["database"]
  });
  const list = await app.inject({ method: "GET", url: "/admin/knowledge-notes/?authorId=cmf8exampleauthor000000001" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().notes[0].archived, true);
  const response = await app.inject({ method: "GET", url: `/admin/knowledge-notes/${id}` });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { note });
  assert.equal(audits, 1);
  assert.equal((await app.inject({ method: "GET", url: "/admin/knowledge-notes/?status=invalid" })).statusCode, 400);
});
