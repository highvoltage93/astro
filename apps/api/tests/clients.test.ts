import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { clientInput, clientUpdate } from "../src/clients/schema";
import { registerClientRoutes } from "../src/clients/routes";

test("client data validates limits, deduplicates tags and rejects owner injection", () => {
  const input = { name: " Test ", email: "", phone: "", tags: ["work", "work"], notes: "" };
  assert.deepEqual(clientInput.parse(input).tags, ["work"]);
  assert.equal(clientInput.parse(input).name, "Test");
  assert.equal(clientInput.safeParse({ ...input, name: " " }).success, false);
  assert.equal(clientInput.safeParse({ ...input, ownerUserId: "another" }).success, false);
  assert.equal(clientInput.safeParse({ ...input, email: "invalid" }).success, false);
  assert.equal(clientInput.safeParse({ ...input, notes: "x".repeat(20001) }).success, false);
  assert.equal(clientUpdate.safeParse({ ...input, revision: 0 }).success, false);
});

test("clients pilot denies anonymous and ordinary users before accessing data", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientRoutes>[1]>;
  for (const role of [null, "USER", "CONSULTANT"] as const) {
    const app = Fastify();
    await registerClientRoutes(app, { database: {} as Deps["database"], authenticate: (async () => role ? { id: "user", role } : null) as Deps["authenticate"] });
    try {
      for (const method of ["GET", "POST", "PUT"] as const) {
        const response = await app.inject({ method, url: method === "PUT" ? "/clients/other" : "/clients/", ...(method !== "GET" ? { payload: {} } : {}) });
        assert.equal(response.statusCode, role ? 403 : 401);
      }
    } finally { await app.close(); }
  }
});

test("client reads and writes are scoped to the owner and updates check revision", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientRoutes>[1]>;
  const app = Fastify();
  const previous = process.env.CLIENTS_PILOT_ENABLED;
  process.env.CLIENTS_PILOT_ENABLED = "true";
  const database = { client: {
    findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { id: "other", ownerUserId: "owner" });
      return null;
    },
    updateMany: async ({ where, data }: { where: unknown; data: { revision: unknown } }) => {
      assert.deepEqual(where, { id: "other", ownerUserId: "owner", revision: 2 });
      assert.deepEqual(data.revision, { increment: 1 });
      return { count: 0 };
    }
  } } as unknown as Deps["database"];
  await registerClientRoutes(app, { database, authenticate: (async () => ({ id: "owner", role: "ADMIN" })) as Deps["authenticate"] });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/clients/other" })).statusCode, 404);
    assert.equal((await app.inject({ method: "PUT", url: "/clients/other", payload: {
      name: "Test", email: "", phone: "", tags: [], notes: "", revision: 2
    } })).statusCode, 409);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.CLIENTS_PILOT_ENABLED;
    else process.env.CLIENTS_PILOT_ENABLED = previous;
  }
});
