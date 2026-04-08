#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="$STACK_DIR/certs"
CERT_FILE="$CERT_DIR/dataaha.local.pem"
KEY_FILE="$CERT_DIR/dataaha.local-key.pem"

mkdir -p "$CERT_DIR"

if command -v mkcert >/dev/null 2>&1; then
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" dataaha.local localhost 127.0.0.1 ::1
  echo "[data-aha-https] mkcert certificate generated."
  exit 0
fi

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:dataaha.local,IP:127.0.0.1"

echo "[data-aha-https] self-signed certificate generated."
