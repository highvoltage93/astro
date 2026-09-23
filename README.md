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

## Authentication

The API exposes a lightweight JWT auth flow for local testing:

- `POST /auth/register` with `email`, `username`, `password`;
- `POST /auth/login` with `username`, `password`;
- `GET /auth/me` with `Authorization: Bearer <token>`.

Passwords are stored as PBKDF2 hashes. The JWT secret is configured with:

```bash
JWT_SECRET=astroprocessor_dev_jwt_secret
```

The web app stores the token in localStorage. API preview endpoints remain available for development calls, while saved birth profiles are scoped to the logged-in user when a token is present.

The main astrology workspace is guarded on the web side. Unauthenticated users are redirected to `/login`; after login or registration they can open the calculation workspace at `/`.

## Consultations

Saved natal charts can have private consultation documents with section-based rich-text editing, separate astrologer notes, autosave, revision conflicts, and tab-local draft recovery. Open **Консультація** in the workspace's right panel or use **Мої консультації** on the dashboard. Formatting uses Tiptap; existing plain-text documents remain supported. **Друк / PDF** opens a client-only document preview with section selection and browser printing / Save as PDF; private notes are excluded by a separate owner-only API response.

The editor's **Прогнози** tab inserts selected events from saved transits and forecast snapshots, including solar/lunar returns, into existing or new sections. Event dates use explicit UTC, with source references and persistent duplicate protection. Calculations are not rerun. Restart the API after updating the shared consultation schema; no database migration or new dependency is needed for forecast insertion.

**Бібліотека** provides private, reusable rich-text templates with categories and title search. Create one from scratch or from a consultation section, save it, then insert an independent copy into any section. Template updates use optimistic revisions; local unsaved drafts can recover within the browser tab. Run `docker compose restart api` to generate Prisma Client and add the `consultation_templates` table through the development startup flow. Template tests are available via `corepack pnpm --filter @astroprocessor/api test:templates`.

**Історія** lists owner-only saved consultation revisions and restores selected text as a new draft revision, optionally including private notes. Document and history writes share a database transaction. Existing consultations begin their history with the next successful save; earlier overwritten revisions cannot be recovered. Restart the API to generate Prisma Client and add `consultation_revisions`. History currently retains every successful save, so database storage grows with autosave activity.

History also supports a section-level comparison against the editor's last acknowledged saved revision: additions, removals, text/formatting changes, reordered sections and forecast source changes. Expand a section to view both formatted versions; private notes remain separate. Unsaved edits do not replace the comparison baseline. Word-level highlighting and merging are not included.

Client printing supports optional natal/solar-return SVG wheels, placement and planetary-aspect tables, and individually selected forecast dates in UTC. Pick a saved forecast for solar/date attachments; mismatched natal snapshots require explicit confirmation. Dedicated owner-only print projections exclude private notes and internal interpretations. The standard text-only export is unchanged; attachments are off by default. No recalculation, new dependency or database migration is needed for print attachments.

After updating, run `docker compose restart api` to generate the Prisma client and add the `consultations` table through the existing development startup flow. See [Консультації: перший етап](docs/CONSULTATIONS_UK.md) for storage, recovery, limits, and test scenarios.

When upgrading from the plain-text editor, install the new container dependencies with `docker compose up -d --build --force-recreate --renew-anon-volumes api web`. The named PostgreSQL data volume is preserved.

## Calculation Profiles

Personal calculation profiles combine rulership rules, house system, zodiac, point orbs, and point visibility. The chart settings drawer includes the unchanged Astroprocessor rulership preset plus traditional and modern primary-ruler presets. Profiles can be saved, revised, deleted, and selected as the user's default for new dashboard calculations.

Charts retain full rule snapshots and the applied profile revision. Changing a live profile does not change saved charts or forecasts. Restart the API container after pulling this update to build the core and apply the additive Prisma schema. See [the Ukrainian calculation-profile documentation](docs/CALCULATION_PROFILES_UK.md) for exact mappings, conditions, versioning, and test commands.

## Forecast Archive

Calculated forecasts, transits, and synastry can be saved with a title and consultation notes. The dashboard and account menu expose a private archive with search, method filters, creation dates, and deletion. `/workspace?forecastId=<id>` restores the owner's saved parameters and result after refresh.

Saving calculates a server-side snapshot using the captured preview inputs. Reading an archived forecast does not recalculate it. Existing natal profile storage is unchanged.

Restart the API container after this schema update (`docker compose restart api`); its existing startup command generates Prisma Client and applies the development schema. See [the Ukrainian archive documentation](docs/FORECAST_ARCHIVE_UK.md) for data contracts, time handling, limitations, and regression scenarios.

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

Professional event search v1: sign ingresses, stations, lunations, global eclipse maxima, and natal aspect filters. Calculation rules, limitations, and deployment notes: [Ukrainian documentation](docs/EVENT_SEARCH_UK.md). New verification scenarios are included but have not been run in this implementation session.

This is the technical skeleton for Phase 0 / Phase 1:

- Dockerized web, API, and database.
- Prisma data model for MVP entities.
- API health routes.
- Birthplace search endpoint backed by Open-Meteo Geocoding.
- Natal chart preview contract backed by the first Swiss Ephemeris adapter.
- Transit preview contract for current-sky positions, Moon phase, transit planets in natal houses, scored transit-to-natal aspects, approximate exact times, active windows, and a 7 day outlook.
- Forecast preview contract for solar return, next lunar return, and exact major transit dates over a selected consultation window.
- Synastry preview contract for two natal charts with planet-to-planet inter-chart aspects, an overlay chart, and a compact relationship aspect summary.
- Per-point orb settings for natal and transit aspect filtering.
- House rulers, planet rulership lists, and house ruler connections for professional "house-to-house" analysis.
- Koch is the default house system for new charts; the workspace selector focuses on Koch and Placidus.
- Essential dignities and dispositor chains for professional planet condition analysis.
- Synthetic signature scoring for sign, element, cross, and polarity dominance.
- Natal interpretation preview endpoint backed by seed content for Sun, Moon, Ascendant, and exact aspects.
- Email, username, password registration and username/password login with JWT-based session tokens.
- Birth profile persistence endpoint backed by Prisma.
- Recent saved birth profiles list with detail loading and deletion, scoped to the current user when authenticated.
- First shadcn/ui product workspace for birth data intake, interactive chart preview, saving, orb tuning, point visibility, professional data tables, direct/retrograde sign-ruler hover details using the configured planet rulership model, ruled-house hover highlights, degree-minute-second position display, synthetic signature, house connections with per-house totals, SOTIS-style aspect matrix, dignities/dispositors, forecast returns, exact transit dates, transit preview, and synastry preview.

## Licensing Note

Swiss Ephemeris and the `sweph` binding have license obligations. Before paid launch or closed-source distribution, confirm the required Swiss Ephemeris/Astrodienst licensing path.
