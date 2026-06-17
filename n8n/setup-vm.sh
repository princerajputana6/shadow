#!/usr/bin/env bash
# One-command bootstrap for the GCP e2-micro (Ubuntu). Idempotent — safe to re-run.
#   curl -fsSL ... | bash   OR   bash n8n/setup-vm.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/4  swap (1GB RAM is tight)"
if ! sudo swapon --show 2>/dev/null | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "    swap added."
else
  echo "    swap already present."
fi

echo "==> 2/4  Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
  echo "    Docker installed."
else
  echo "    Docker already installed."
fi

echo "==> 3/4  .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "    Created n8n/.env from template."
  echo "    >>> EDIT n8n/.env now (fill secrets + CF_TUNNEL_TOKEN), then re-run this script:"
  echo "        nano n8n/.env   then   bash n8n/setup-vm.sh"
  exit 0
fi

echo "==> 4/4  launch n8n + Cloudflare Tunnel"
sudo docker compose -f docker-compose.tunnel.yml --env-file .env up -d
echo ""
sudo docker compose -f docker-compose.tunnel.yml ps
echo ""
echo "Done. Open https://\$N8N_HOST and create your n8n owner login."
