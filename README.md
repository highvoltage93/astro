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

The API container downloads the required Swiss Ephemeris files, then runs Prisma generate and `prisma db push` on startup for the development database.

## Birthplace Search

The API exposes `GET /places/search?query=Kyiv` as a backend proxy for birthplace lookup. The MVP provider is the Open-Meteo Geocoding API, configured with:

```bash
GEOCODING_API_URL=https://geocoding-api.open-meteo.com/v1
```

Search results include display name, country, latitude, longitude, and timezone. The web form uses this to fill birthplace coordinates before calculating a chart.

Birth time supports seconds in `HH:mm:ss` format for higher-precision charts.

If birth time is unknown, the app calculates planets for `12:00:00` local time and omits Ascendant, Midheaven, houses, and house placements from the result.

## Swiss Ephemeris Files

The calculation adapter uses the `sweph` Node binding. For high precision calculations, download the Swiss Ephemeris files before running the app:

```bash
corepack pnpm ephemeris:download
```

The files are saved to `ephemeris/` and ignored by Git. Docker downloads them automatically on API startup and uses this path through `SWISSEPH_EPHE_PATH=/app/ephemeris`.

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
- Birthplace search endpoint backed by Open-Meteo Geocoding.
- Natal chart preview contract backed by the first Swiss Ephemeris adapter.
- Transit preview contract for current-sky positions, Moon phase, transit planets in natal houses, scored transit-to-natal aspects, approximate exact times, active windows, and a 7 day outlook.
- Synastry preview contract for two natal charts with inter-chart aspects and a compact relationship aspect summary.
- Per-point orb settings for natal and transit aspect filtering.
- Natal interpretation preview endpoint backed by seed content for Sun, Moon, Ascendant, and exact aspects.
- Birth profile persistence endpoint backed by Prisma.
- Recent saved birth profiles list with detail loading and deletion for the MVP workspace.
- First shadcn/ui product workspace for birth data intake, interactive chart preview, saving, orb tuning, point visibility, professional data tables, transit preview, and synastry preview.

## Licensing Note

Swiss Ephemeris and the `sweph` binding have license obligations. Before paid launch or closed-source distribution, confirm the required Swiss Ephemeris/Astrodienst licensing path.
