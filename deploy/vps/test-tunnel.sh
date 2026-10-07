#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ $EUID == 0 ]] || { echo 'Run with sudo on the VPS.' >&2; exit 1; }
action="${1:-}"
[[ "$action" == start || "$action" == stop ]] || { echo 'Usage: sudo bash test-tunnel.sh start|stop' >&2; exit 1; }
exec 9>/var/lock/astroprocessor-ops.lock
flock -n 9 || { echo 'Another deployment or backup is running.' >&2; exit 1; }

# Preserve the running release even if .env references an older image tag.
if [[ -f .deployed-tag ]]; then
  IMAGE_TAG=$(<.deployed-tag)
  [[ "$IMAGE_TAG" =~ ^sha-[a-f0-9]{40}$ ]] || { echo 'Invalid .deployed-tag' >&2; exit 1; }
  export IMAGE_TAG
fi
base=(docker compose --env-file .env -f compose.yaml)
tunnel=(docker compose --env-file .env -f compose.yaml -f compose.tunnel.yaml)

if [[ "$action" == stop ]]; then
  "${tunnel[@]}" stop test-tunnel test-gateway
  "${base[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 180 api
  echo 'Public tunnel stopped. API origin restored to SITE_HOST. Data unchanged.'
  exit 0
fi

echo 'Starting PUBLIC test access. Use only test accounts and test data.'
echo 'The API will restart briefly; no migrations or database changes are performed.'
"${tunnel[@]}" pull test-gateway test-tunnel
cleanup_failure() {
  echo 'Tunnel setup failed; closing public test access.' >&2
  "${tunnel[@]}" stop test-tunnel test-gateway || true
  "${base[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 180 api || true
}
trap cleanup_failure ERR
"${tunnel[@]}" up -d --no-deps --force-recreate test-gateway test-tunnel

TUNNEL_ORIGIN=''
for ((attempt=0; attempt<60; attempt++)); do
  logs=$("${tunnel[@]}" logs --no-color test-tunnel 2>&1)
  if [[ "$logs" =~ https://[a-z0-9-]+\.trycloudflare\.com ]]; then
    TUNNEL_ORIGIN="${BASH_REMATCH[0]}"
    break
  fi
  sleep 2
done
if [[ -z "$TUNNEL_ORIGIN" ]]; then
  echo 'No temporary URL received. Inspect test-tunnel logs.' >&2
  false
fi
export TUNNEL_ORIGIN
"${tunnel[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 180 api
trap - ERR
printf '\nTest URL: %s\n' "$TUNNEL_ORIGIN"
echo 'Confirm login and a test calculation in your browser before sharing.'
echo 'To close access: sudo bash test-tunnel.sh stop'
echo 'After a server/tunnel restart, run start again and share the NEW URL.'
