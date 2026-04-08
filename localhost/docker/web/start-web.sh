#!/usr/bin/env bash
set -euo pipefail

if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/${TZ}" ]; then
  ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime
  echo "${TZ}" >/etc/timezone
fi

# Build default PostgreSQL connection string for app when DATAAHA_CONNECTION_STRING is not explicitly provided.
if [ -z "${DATAAHA_CONNECTION_STRING:-}" ]; then
  export DATAAHA_CONNECTION_STRING="Host=${POSTGRES_HOST:-db};Port=${POSTGRES_PORT:-5432};Database=${POSTGRES_DB:-data_aha_local};Username=${POSTGRES_USER:-postgres};Password=${POSTGRES_PASSWORD:-DataAhaLocal!2026};SSL Mode=Disable;Trust Server Certificate=true;Pooling=true"
fi

mkdir -p /run/mono
chown www-data:www-data /run/mono
rm -f /run/mono/fastcgi.sock

su -s /bin/bash -c "fastcgi-mono-server4 /applications=/:/app /socket=unix:/run/mono/fastcgi.sock /printlog=True /loglevels=Standard >/tmp/mono-fastcgi.log 2>&1" www-data &

exec nginx -g "daemon off;"
