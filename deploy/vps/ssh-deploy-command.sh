#!/usr/bin/env bash
set -Eeuo pipefail
# Installed root-owned. Used as an authorized_keys forced command, never eval.
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ (sha-[a-f0-9]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/astro-deploy "${BASH_REMATCH[1]}"
fi
echo 'Only deploy sha-<40-character-commit> is allowed.' >&2
exit 1
