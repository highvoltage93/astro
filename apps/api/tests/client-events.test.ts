import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { eventInput, registerClientEventRoutes } from "../src/clients/events";

const input = { title: "Event", date: "2024-02-29", approximate: false, category: "relocation", notes: "" };
test("client events validate calendar dates and reject injected ownership", () => {
  assert.equal(eventInput.safeParse(input).success, true);
  for (const date of ["2023-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "28.11.2026", "invalid"]) {
    assert.equal(eventInput.safeParse({ ...input, date }).success, false, date);
  }
  assert.equal(eventInput.safeParse({ ...input, clientId: "foreign" }).success, false);
  assert.equal(eventInput.safeParse({ ...input, category: "unknown" }).success, false);
  assert.equal(eventInput.safeParse({ ...input, title: " " }).success, false);
});

test("updates and deletion require both client ownership and event revision", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientEventRoutes>[1]>;
  const app = Fastify();
  const expected = { id: "event", clientId: "client", client: { ownerUserId: "owner" }, revision: 2 };
  const database = { clientEvent: {
    updateMany: async ({ where, data }: { where: unknown; data: { revision: unknown; date: Date } }) => {
      assert.deepEqual(where, expected);
      assert.deepEqual(data.revision, { increment: 1 });
      assert.equal(data.date.toISOString(), "2024-02-29T00:00:00.000Z");
      return { count: 0 };
    },
    deleteMany: async ({ where }: { where: unknown }) => { assert.deepEqual(where, expected); return { count: 0 }; }
  } } as unknown as Deps["database"];
  await registerClientEventRoutes(app, { database, authenticate: (async () => ({ id: "owner", role: "ADMIN" })) as Deps["authenticate"] });
  try {
    assert.equal((await app.inject({ method: "PUT", url: "/client/events/event", payload: { ...input, revision: 2 } })).statusCode, 409);
    assert.equal((await app.inject({ method: "DELETE", url: "/client/events/event", payload: { revision: 2 } })).statusCode, 409);
  } finally { await app.close(); }
});

test("foreign client prevents event creation and listing", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientEventRoutes>[1]>;
  const app = Fastify();
  await registerClientEventRoutes(app, {
    authenticate: (async () => ({ id: "owner", role: "ADMIN" })) as Deps["authenticate"],
    database: { client: { findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { id: "foreign", ownerUserId: "owner" }); return null;
    } } } as unknown as Deps["database"]
  });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/foreign/events" })).statusCode, 404);
    assert.equal((await app.inject({ method: "POST", url: "/foreign/events", payload: { ...input, id: "5acbb117-4ec4-41a5-b284-31f855222f7e" } })).statusCode, 404);
  } finally { await app.close(); }
});
