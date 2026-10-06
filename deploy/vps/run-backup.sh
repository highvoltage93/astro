#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec 9>/var/lock/astroprocessor-ops.lock
flock -n 9 || { echo 'Deployment/backup lock is held; inspect the external backup monitor.' >&2; exit 1; }
IMAGE_TAG=$(cat .deployed-tag)
[[ "$IMAGE_TAG" =~ ^sha-[a-f0-9]{40}$ ]] || { echo 'Missing successful deployment tag.' >&2; exit 1; }
export IMAGE_TAG
docker compose --env-file .env -f compose.yaml --profile ops run --rm --no-deps backup
