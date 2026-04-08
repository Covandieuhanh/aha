#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

./scripts/setup-mkcert-https.sh >/dev/null

echo "[data-aha] Starting local HTTPS stack..."
docker compose up -d --build --remove-orphans

echo "[data-aha] Waiting for https://localhost:8443 ..."
for _ in $(seq 1 90); do
  code="$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 5 https://localhost:8443/ || true)"
  if [ "$code" = "200" ]; then
    echo "[data-aha] Ready: https://localhost:8443"
    echo "[data-aha] Optional host alias: https://dataaha.local"
    exit 0
  fi
  sleep 2
done

echo "[data-aha] Service did not become ready in time"
exit 1
