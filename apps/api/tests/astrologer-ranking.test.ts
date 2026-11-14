import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import Fastify from "fastify";
import { rankingQuerySchema, rankingSql, registerAstrologerRankingRoutes } from "../src/admin/astrologer-ranking";

const createApp = async (t: TestContext, role: string | null, load: NonNullable<Parameters<typeof registerAstrologerRankingRoutes>[1]>["load"]) => {
  const app = Fastify();
  await registerAstrologerRankingRoutes(app, { authenticate: async () => role ? { id: "actor", role } : null, load });
  t.after(() => app.close());
  return app;
};

test("ranking denies anonymous, regular and consultant accounts before querying metrics", async (t) => {
  for (const role of [null, "USER", "CONSULTANT"]) {
    const app = await createApp(t, role, async () => assert.fail("Metrics must stay admin-only"));
    const response = await app.inject({ method: "GET", url: "/admin/astrologers" });
    assert.equal(response.statusCode, role ? 403 : 401);
    assert.equal(response.headers["cache-control"], "private, no-store");
  }
});

test("admin ranking defaults to total activity descending with bounded pages", async (t) => {
  const app = await createApp(t, "ADMIN", async (query) => {
    assert.deepEqual(query, { search: "", sort: "score", direction: "desc", page: 1 });
    return { astrologers: [], total: 0, page: 1, pageSize: 25 };
  });
  const response = await app.inject({ method: "GET", url: "/admin/astrologers" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { astrologers: [], total: 0, page: 1, pageSize: 25 });
});

test("every displayed ranking parameter supports both sort directions", () => {
  for (const sort of ["rank", "username", "score", "charts", "forecasts", "consultations", "observations", "publishedObservations"]) {
    for (const direction of ["asc", "desc"]) {
      const query = rankingQuerySchema.parse({ sort, direction, page: 2 });
      const sql = rankingSql(query);
      const column = sort === "username" ? 'lower("username")' : `"${sort}"`;
      assert.ok(sql.text.includes(`ORDER BY ${column} ${direction.toUpperCase()}, lower(username) ASC, id ASC`));
      assert.deepEqual(sql.values.slice(-2), [25, 25]);
    }
  }
});

test("rank excludes admins, independently aggregates relations, and remains global after filtering", () => {
  const sql = rankingSql(rankingQuerySchema.parse({ search: "user" })).text;
  for (const table of ["birth_profiles", "saved_forecasts", "consultations", "knowledge_notes"]) {
    assert.ok(sql.includes(`count(*)::int AS count FROM "${table}" GROUP BY "ownerUserId"`));
  }
  assert.ok(sql.includes("WHERE u.role <> 'ADMIN'"));
  assert.ok(sql.includes("charts + forecasts + consultations + observations AS score"));
  assert.ok(sql.includes("WHERE p.published = true AND n.archived = false"));
  assert.ok(sql.indexOf("rank() OVER (ORDER BY score DESC)") < sql.indexOf("WHERE strpos(lower(username)"));
  assert.equal(sql.includes("passwordHash"), false);
  assert.equal(sql.includes("email"), false);
  assert.equal(sql.includes("knowledge_activations"), false);
});

test("search is parameterized and untrusted sort keys and pagination are rejected", () => {
  const search = "%' OR 1=1 --";
  const sql = rankingSql(rankingQuerySchema.parse({ search }));
  assert.equal(sql.text.includes(search), false);
  assert.equal(sql.values[0], search);
  for (const invalid of [{ sort: "email" }, { sort: "score; DROP TABLE users" }, { direction: "sideways" }, { page: 0 }, { page: 1.5 }, { page: 100001 }, { role: "ADMIN" }]) {
    assert.equal(rankingQuerySchema.safeParse(invalid).success, false);
  }
});

test("invalid ranking requests do not reach the database", async (t) => {
  const app = await createApp(t, "ADMIN", async () => assert.fail("Invalid request"));
  assert.equal((await app.inject({ method: "GET", url: "/admin/astrologers?sort=private" })).statusCode, 400);
});
