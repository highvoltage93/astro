import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getOptionalAuthUser } from "../auth/service";
import { prisma } from "../prisma/client";

export const rankingQuerySchema = z.object({
  search: z.string().trim().max(160).default(""),
  sort: z.enum(["rank", "username", "score", "charts", "forecasts", "consultations", "observations", "publishedObservations"]).default("score"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(100000).default(1)
}).strict();
type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type AstrologerRankingRow = {
  id: string; username: string; rank: number; score: number;
  charts: number; forecasts: number; consultations: number; observations: number; publishedObservations: number;
};
const PAGE_SIZE = 25;
const sortColumns: Record<RankingQuery["sort"], Prisma.Sql> = {
  rank: Prisma.sql`"rank"`, username: Prisma.sql`lower("username")`, score: Prisma.sql`"score"`,
  charts: Prisma.sql`"charts"`, forecasts: Prisma.sql`"forecasts"`, consultations: Prisma.sql`"consultations"`,
  observations: Prisma.sql`"observations"`, publishedObservations: Prisma.sql`"publishedObservations"`
};

export function rankingSql(query: RankingQuery) {
  // Aggregate each relation separately: joining raw rows would multiply counts.
  return Prisma.sql`
    WITH chart_counts AS (
      SELECT "ownerUserId", count(*)::int AS count FROM "birth_profiles" GROUP BY "ownerUserId"
    ), forecast_counts AS (
      SELECT "ownerUserId", count(*)::int AS count FROM "saved_forecasts" GROUP BY "ownerUserId"
    ), consultation_counts AS (
      SELECT "ownerUserId", count(*)::int AS count FROM "consultations" GROUP BY "ownerUserId"
    ), observation_counts AS (
      SELECT "ownerUserId", count(*)::int AS count FROM "knowledge_notes" GROUP BY "ownerUserId"
    ), publication_counts AS (
      SELECT n."ownerUserId", count(*)::int AS count
      FROM "knowledge_publications" p JOIN "knowledge_notes" n ON n.id = p."noteId"
      WHERE p.published = true AND n.archived = false GROUP BY n."ownerUserId"
    ), counts AS (
      SELECT u.id, u.username,
        coalesce(c.count, 0) AS charts, coalesce(f.count, 0) AS forecasts,
        coalesce(k.count, 0) AS consultations, coalesce(n.count, 0) AS observations,
        coalesce(p.count, 0) AS "publishedObservations"
      FROM users u
      LEFT JOIN chart_counts c ON c."ownerUserId" = u.id
      LEFT JOIN forecast_counts f ON f."ownerUserId" = u.id
      LEFT JOIN consultation_counts k ON k."ownerUserId" = u.id
      LEFT JOIN observation_counts n ON n."ownerUserId" = u.id
      LEFT JOIN publication_counts p ON p."ownerUserId" = u.id
      WHERE u.role <> 'ADMIN'
    ), scored AS (
      SELECT *, charts + forecasts + consultations + observations AS score FROM counts
    ), ranked AS (
      SELECT *, rank() OVER (ORDER BY score DESC)::int AS rank FROM scored
    )
    SELECT * FROM ranked
    WHERE strpos(lower(username), lower(${query.search})) > 0
    ORDER BY ${sortColumns[query.sort]} ${query.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`}, lower(username) ASC, id ASC
    LIMIT ${PAGE_SIZE} OFFSET ${(query.page - 1) * PAGE_SIZE}
  `;
}

export async function loadAstrologerRanking(query: RankingQuery) {
  return prisma.$transaction(async (tx) => {
    const [count] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total FROM users
      WHERE role <> 'ADMIN' AND strpos(lower(username), lower(${query.search})) > 0
    `);
    const astrologers = await tx.$queryRaw<AstrologerRankingRow[]>(rankingSql(query));
    return { astrologers, total: count?.total ?? 0, page: query.page, pageSize: PAGE_SIZE };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function registerAstrologerRankingRoutes(app: FastifyInstance, deps: {
  authenticate: (request: FastifyRequest) => Promise<{ id: string; role: string } | null>;
  load: typeof loadAstrologerRanking;
} = { authenticate: getOptionalAuthUser, load: loadAstrologerRanking }) {
  app.get("/admin/astrologers", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const user = await deps.authenticate(request);
    if (!user) return reply.code(401).send({ message: "Увійдіть до акаунта." });
    if (user.role !== "ADMIN") return reply.code(403).send({ message: "Рейтинг поки доступний лише адміністраторам." });
    const query = rankingQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: "Некоректні параметри рейтингу." });
    return deps.load(query.data);
  });
}
