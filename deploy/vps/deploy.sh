#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/astro/deploy/vps
[[ $EUID == 0 ]] || { echo 'Run with sudo on the VPS.' >&2; exit 1; }
tag="${1:-}"
[[ "$tag" =~ ^sha-[a-f0-9]{40}$ ]] || { echo 'Usage: sudo bash deploy.sh sha-<40-character-commit>' >&2; exit 1; }
[[ -f .env && -f .env.backup ]] || { echo 'Configure .env and .env.backup first.' >&2; exit 1; }
exec 9>/var/lock/astroprocessor-ops.lock
flock -n 9 || { echo 'A deployment or backup is already running.' >&2; exit 1; }
export IMAGE_TAG="$tag"
compose=(docker compose --env-file .env -f compose.yaml)
trap 'echo "Deployment stopped. Inspect logs; code rollback does not roll back the database. No automatic restore was attempted." >&2' ERR
umask 077
printf '%s\n' "$tag" > .attempted-tag

# Pull and validate configuration before taking the current application offline.
"${compose[@]}" config --quiet
"${compose[@]}" --profile ops pull api web migrate backup
[[ -n $("${compose[@]}" ps --status running -q postgres) ]] || { echo 'Postgres must already be running. Bootstrap is a manual operation.' >&2; exit 1; }
tables=$("${compose[@]}" exec -T postgres psql -U astro_owner -d astroprocessor -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
[[ "$tables" =~ ^[0-9]+$ ]] || { echo 'Could not determine database initialization state.' >&2; exit 1; }
if (( tables > 0 )); then
  # Fail closed: existing data must have a verified off-site copy before migration.
  "${compose[@]}" --profile ops run --rm --no-deps backup
fi
# Keep the existing app serving during image download and backup. Stop writes
# before migrations; do not automatically restart old code after schema changes.
"${compose[@]}" stop web api
"${compose[@]}" --profile ops run --rm --no-deps migrate
"${compose[@]}" exec -T postgres psql -U astro_owner -d astroprocessor -v ON_ERROR_STOP=1 -c 'REVOKE ALL ON TABLE "_prisma_migrations" FROM astro_app;'
"${compose[@]}" up -d --no-deps --pull never --wait --wait-timeout 180 api web
# Persist the tag only after both application containers are healthy.
env_tmp=$(mktemp .env.deploy.XXXXXX)
awk -v tag="$tag" '
  /^IMAGE_TAG=/ { print "IMAGE_TAG=" tag; found=1; next }
  { print }
  END { if (!found) print "IMAGE_TAG=" tag }
' .env > "$env_tmp"
chmod 600 "$env_tmp"
mv "$env_tmp" .env
if [[ -f .deployed-tag ]]; then cp .deployed-tag .previous-tag; fi
printf '%s\n' "$tag" > .deployed-tag.next
mv .deployed-tag.next .deployed-tag
echo 'API and web are healthy. Deployment completed; database and Caddy were not recreated.'
