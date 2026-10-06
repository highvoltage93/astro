#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ $EUID == 0 ]] || { echo 'Run with sudo on the VPS.' >&2; exit 1; }
tag="${1:-}"
[[ "$tag" =~ ^sha-[a-f0-9]{40}$ ]] || { echo 'Usage: sudo bash deploy.sh sha-<40-character-commit>' >&2; exit 1; }
[[ -f .env && -f .env.backup ]] || { echo 'Configure .env and .env.backup first.' >&2; exit 1; }
exec 9>/var/lock/astroprocessor-ops.lock
flock -n 9 || { echo 'A deployment or backup is already running.' >&2; exit 1; }
export IMAGE_TAG="$tag"
compose=(docker compose --env-file .env -f compose.yaml)
trap 'echo "Deployment stopped. Inspect logs; code rollback does not roll back the database. No automatic restore was attempted." >&2' ERR

# Pull and validate configuration before taking the current application offline.
"${compose[@]}" --profile ops pull
"${compose[@]}" up -d --wait --wait-timeout 120 postgres
tables=$("${compose[@]}" exec -T postgres psql -U astro_owner -d astroprocessor -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
[[ "$tables" =~ ^[0-9]+$ ]] || { echo 'Could not determine database initialization state.' >&2; exit 1; }
"${compose[@]}" stop caddy web api
if (( tables > 0 )); then
  # Fail closed: existing data must have a verified off-site copy before migration.
  "${compose[@]}" --profile ops run --rm --no-deps backup
fi
"${compose[@]}" --profile ops run --rm --no-deps migrate
"${compose[@]}" exec -T postgres psql -U astro_owner -d astroprocessor -v ON_ERROR_STOP=1 -c 'REVOKE ALL ON TABLE "_prisma_migrations" FROM astro_app;'
"${compose[@]}" up -d --wait --wait-timeout 180 api web caddy
umask 077
if [[ -f .deployed-tag ]]; then cp .deployed-tag .previous-tag; fi
printf '%s\n' "$tag" > .deployed-tag
echo 'Deployment started successfully. Confirm HTTPS, login and saved data from an allowed client.'
