#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo on the VPS.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'This bootstrap targets Ubuntu 24.04 only.' >&2; exit 1; }
[[ "$(dpkg --print-architecture)" == amd64 ]] || { echo 'Published application images target amd64.' >&2; exit 1; }
if command -v docker >/dev/null; then
  echo 'Docker already exists. Review the installation manually; nothing changed.'
  exit 0
fi
apt-get update
apt-get install -y ca-certificates curl git openssl ufw unattended-upgrades
install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
echo 'Docker installed. SSH hardening, firewall and unattended-upgrade policy still require operator setup.'
echo 'No SSH settings, firewall rules, application containers or database volumes were changed.'
