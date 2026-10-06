#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

for name in BACKUP_DATABASE_URL BACKUP_BUCKET BACKUP_PREFIX BACKUP_AGE_RECIPIENT BACKUP_HEALTHCHECK_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing backup variable: %s\n' "$name" >&2
    exit 1
  fi
done
[[ "$BACKUP_HEALTHCHECK_URL" == https://* ]] || { echo 'Healthcheck URL must use HTTPS' >&2; exit 1; }
[[ "$BACKUP_PREFIX" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Use a simple environment prefix, e.g. astro-production' >&2; exit 1; }
[[ "$BACKUP_AGE_RECIPIENT" == age1* ]] || { echo 'An age public recipient is required, not a private identity' >&2; exit 1; }
ssl_mode=$(python3 /opt/backup/database-ssl.py)
export PGDATABASE="$BACKUP_DATABASE_URL" PGSSLMODE="$ssl_mode" PGCONNECT_TIMEOUT=30
export AWS_PAGER="" AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=5
workspace=$(mktemp -d)
finish() {
  result=$?
  trap - EXIT
  rm -rf -- "$workspace"
  if (( result != 0 )); then
    echo 'Backup failed; check this job and the independent dead-man monitor.' >&2
    curl --fail --silent --show-error --max-time 20 --retry 2 "${BACKUP_HEALTHCHECK_URL%/}/fail" >/dev/null 2>&1 || true
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

curl --fail --silent --show-error --max-time 20 --retry 2 "${BACKUP_HEALTHCHECK_URL%/}/start" >/dev/null
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
month_day=$(date -u +%d)
id=$(cat /proc/sys/kernel/random/uuid)
file="$stamp-$id.dump.age"
archive="$workspace/$file"

# PGDATABASE keeps credentials out of the process argument list. Only encrypted data is written to disk.
pg_dump --format=custom --no-owner --no-acl --lock-wait-timeout=60000 | age -r "$BACKUP_AGE_RECIPIENT" -o "$archive"
test -s "$archive"
digest=$(sha256sum "$archive" | cut -d ' ' -f 1)
printf '%s  %s\n' "$digest" "$file" > "$archive.sha256"
s3=(aws)
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  [[ "$BACKUP_S3_ENDPOINT" == https://* ]] || { echo 'S3 endpoint must use HTTPS' >&2; exit 1; }
  s3+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
fi

upload() {
  local tier="$1" destination="s3://$BACKUP_BUCKET/$BACKUP_PREFIX/$1/$file" remote_digest
  "${s3[@]}" s3 cp "$archive" "$destination" --only-show-errors
  # Read back the encrypted object: do not treat an upload acknowledgement as integrity verification.
  remote_digest=$("${s3[@]}" s3 cp "$destination" - --only-show-errors | sha256sum | cut -d ' ' -f 1)
  [[ "$remote_digest" == "$digest" ]] || { echo 'Remote backup checksum mismatch' >&2; return 1; }
  "${s3[@]}" s3 cp "$archive.sha256" "$destination.sha256" --only-show-errors
  printf 'Verified encrypted backup: %s/%s\n' "$tier" "$file"
}
upload daily
if [[ "$month_day" == 01 || "${BACKUP_MONTHLY:-0}" == 1 ]]; then upload monthly; fi
curl --fail --silent --show-error --max-time 20 --retry 2 "${BACKUP_HEALTHCHECK_URL%/}" >/dev/null
echo 'Backup completed. Decryption and database restore drills remain a separate procedure.'
