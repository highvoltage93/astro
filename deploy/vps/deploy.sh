#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/astro/deploy/vps
[[ $EUID == 0 ]] || { echo 'Run with sudo on the VPS.' >&2; exit 1; }
tag="${1:-}"
[[ "$tag" =~ ^sha-[a-f0-9]{40}$ ]] || { echo 'Usage: sudo bash deploy.sh sha-<40-character-commit>' >&2; exit 1; }
[[ -f .env ]] || { echo 'Configure .env first.' >&2; exit 1; }
# Read only this literal option; never execute the dotenv file as shell code.
backup_mode=$(awk -F= '$1 == "BACKUP_MODE" { if (found++) exit 2; print substr($0, index($0, "=") + 1) }' .env)
backup_mode=${backup_mode:-offsite}
case "$backup_mode" in
  local) export BACKUP_ENV_FILE=/dev/null ;;
  offsite)
    [[ -f .env.backup ]] || { echo 'Configure .env.backup for offsite backups.' >&2; exit 1; }
    export BACKUP_ENV_FILE=/opt/astro/deploy/vps/.env.backup
    ;;
  *) echo 'BACKUP_MODE must be exactly local or offsite (without quotes).' >&2; exit 1 ;;
esac
exec 9>/var/lock/astroprocessor-ops.lock
flock -n 9 || { echo 'A deployment or backup is already running.' >&2; exit 1; }
export IMAGE_TAG="$tag"
compose=(docker compose --env-file .env -f compose.yaml)
trap 'echo "Deployment stopped. Inspect logs; code rollback does not roll back the database. No automatic restore was attempted." >&2' ERR
umask 077
printf '%s\n' "$tag" > .attempted-tag

# Pull and validate configuration before taking the current application offline.
"${compose[@]}" config --quiet
"${compose[@]}" --profile ops pull api web migrate
if [[ "$backup_mode" == offsite ]]; then
  "${compose[@]}" --profile ops pull backup
fi
[[ -n $("${compose[@]}" ps --status running -q postgres) ]] || { echo 'Postgres must already be running. Bootstrap is a manual operation.' >&2; exit 1; }
tables=$("${compose[@]}" exec -T postgres psql -U astro_owner -d astroprocessor -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
[[ "$tables" =~ ^[0-9]+$ ]] || { echo 'Could not determine database initialization state.' >&2; exit 1; }
if (( tables > 0 )); then
  if [[ "$backup_mode" == local ]]; then
    install -d -o root -g root -m 700 /var/backups/astro
    archive=$(mktemp "/var/backups/astro/pre-update-$(date -u +%Y%m%dT%H%M%SZ)-${tag:4:12}.XXXXXX.partial")
    "${compose[@]}" exec -T postgres pg_dump -U astro_owner -d astroprocessor -Fc > "$archive"
    test -s "$archive"
    "${compose[@]}" exec -T postgres pg_restore --list < "$archive" > /dev/null
    # Decode all archive contents without connecting to or changing a database.
    "${compose[@]}" exec -T postgres pg_restore --file=/dev/null < "$archive"
    mv "$archive" "${archive%.partial}.dump"
    printf 'Verified local dump: %s\n' "${archive%.partial}.dump"
    echo 'WARNING: local backups do not protect against loss of this VPS or disk.'
  else
    "${compose[@]}" --profile ops run --rm --no-deps backup
  fi
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
