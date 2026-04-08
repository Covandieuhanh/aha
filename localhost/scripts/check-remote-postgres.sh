#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-112.78.4.40}"
PORT="${2:-5432}"

echo "[CHECK] Testing TCP to ${HOST}:${PORT} ..."
if nc -zv -G 5 "$HOST" "$PORT"; then
  echo "[OK] Port ${PORT} is reachable on ${HOST}."
  exit 0
fi

echo "[FAIL] Cannot reach ${HOST}:${PORT}."
echo "Please verify firewall/security-group and pg_hba/postgresql config on server."
exit 1
