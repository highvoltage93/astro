import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerClientMaterialRoutes } from "../src/clients/materials";

test("all material types require ownership and unlink only deletes the link", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientMaterialRoutes>[1]>;
  for (const kind of ["chart", "forecast", "consultation"] as const) {
    for (const owned of [false, true]) {
      let created = 0, unlinked = 0;
      const target = kind === "chart" ? { birthProfileId: "material" } : kind === "forecast" ? { forecastId: "material" } : { consultationId: "material" };
      const material = { findFirst: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { id: "material", ownerUserId: "owner" });
        return owned ? { id: "material" } : null;
      } };
      const tx = {
        client: { findFirst: async ({ where }: { where: unknown }) => {
          assert.deepEqual(where, { id: "client", ownerUserId: "owner" });
          return { id: "client" };
        } },
        birthProfile: material, savedForecast: material, consultation: material,
        clientMaterial: {
          createMany: async (input: unknown) => {
            assert.deepEqual(input, { data: [{ clientId: "client", ...target }], skipDuplicates: true });
            created++; return { count: 1 };
          },
          deleteMany: async (input: unknown) => {
            assert.deepEqual(input, { where: { clientId: "client", ...target } });
            unlinked++; return { count: 1 };
          }
        }
      };
      const app = Fastify();
      await registerClientMaterialRoutes(app, {
        authenticate: (async () => ({ id: "owner", role: "ADMIN" })) as Deps["authenticate"],
        database: { $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as Deps["database"]
      });
      try {
        for (const method of ["PUT", "DELETE"] as const) {
          const response = await app.inject({ method, url: `/client/materials/${kind}/material`, payload: {} });
          assert.equal(response.statusCode, owned ? 200 : 404);
        }
        assert.equal(created, owned ? 1 : 0);
        assert.equal(unlinked, owned ? 1 : 0);
      } finally { await app.close(); }
    }
  }
});

test("missing or foreign client prevents any material lookup or mutation", async () => {
  type Deps = NonNullable<Parameters<typeof registerClientMaterialRoutes>[1]>;
  const app = Fastify();
  const tx = { client: { findFirst: async () => null } };
  await registerClientMaterialRoutes(app, {
    authenticate: (async () => ({ id: "owner", role: "ADMIN" })) as Deps["authenticate"],
    database: { ...tx, $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as Deps["database"]
  });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/foreign/materials?kind=chart" })).statusCode, 404);
    assert.equal((await app.inject({ method: "PUT", url: "/foreign/materials/chart/material", payload: {} })).statusCode, 404);
  } finally { await app.close(); }
});
