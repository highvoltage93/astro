# Astroprocessor

Web-only astrology platform scaffolded from the product roadmap in `docs/`.

## Stack

- Next.js + React + TypeScript for the web app.
- shadcn/ui + Tailwind CSS for the UI system.
- Fastify + TypeScript for the API.
- PostgreSQL + Prisma for persistence.
- Docker Compose for the full local environment.
- `packages/astrology-core` as the calculation boundary with the first Swiss Ephemeris adapter.

## Run With Docker

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Web: http://localhost:3000
- API: http://localhost:4000
- PostgreSQL: localhost:5432

The API container runs Prisma generate and `prisma db push` on startup for the development database.

## Swiss Ephemeris Files

The calculation adapter uses the `sweph` Node binding. For high precision calculations, download the Swiss Ephemeris files before running the app:

```bash
corepack pnpm ephemeris:download
```

The files are saved to `ephemeris/` and ignored by Git. Docker uses this path through `SWISSEPH_EPHE_PATH=/app/ephemeris`.

Without these files, the API can still run, but some bodies may use lower-precision fallback data and Chiron may be unavailable. Responses include warnings when this happens.

## Local Development Without Docker

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm prisma:generate
pnpm dev
```

For local API development outside Docker, set `DATABASE_URL` to a reachable PostgreSQL instance.

Smoke-test the calculation adapter:

```bash
SWISSEPH_EPHE_PATH="$PWD/ephemeris" corepack pnpm smoke:natal
```

## Current Scope

This is the technical skeleton for Phase 0 / Phase 1:

- Dockerized web, API, and database.
- Prisma data model for MVP entities.
- API health routes.
- Natal chart preview contract backed by the first Swiss Ephemeris adapter.
- Birth profile persistence endpoint backed by Prisma.
- First shadcn/ui product workspace for birth data intake, chart preview, and saving.

## Licensing Note

Swiss Ephemeris and the `sweph` binding have license obligations. Before paid launch or closed-source distribution, confirm the required Swiss Ephemeris/Astrodienst licensing path.
