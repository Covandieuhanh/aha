#!/usr/bin/env bash
set -euo pipefail

CLIENT_IP="${1:-}"
DB_NAME="${2:-ahashine_data}"
DB_USER="${3:-ahashine}"
DB_PASSWORD="${4:-}"

if [ -z "$CLIENT_IP" ] || [ -z "$DB_PASSWORD" ]; then
  cat <<'USAGE'
Usage:
  sudo bash server-enable-postgres-remote.sh <CLIENT_IP> [DB_NAME] [DB_USER] <DB_PASSWORD>

Example:
  sudo bash server-enable-postgres-remote.sh 1.2.3.4 ahashine_data ahashine '<DB_PASSWORD>'
USAGE
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[ERROR] psql is not installed on this server."
  exit 1
fi

CONF_FILE="$(sudo -u postgres psql -Atqc "SHOW config_file;")"
HBA_FILE="$(sudo -u postgres psql -Atqc "SHOW hba_file;")"

if [ -z "$CONF_FILE" ] || [ -z "$HBA_FILE" ]; then
  echo "[ERROR] Cannot detect PostgreSQL config paths."
  exit 1
fi

echo "[INFO] PostgreSQL config: $CONF_FILE"
echo "[INFO] PostgreSQL hba:    $HBA_FILE"

sudo cp "$CONF_FILE" "${CONF_FILE}.bak.$(date +%Y%m%d%H%M%S)"
sudo cp "$HBA_FILE" "${HBA_FILE}.bak.$(date +%Y%m%d%H%M%S)"

# Ensure PostgreSQL listens on external interfaces
if sudo grep -Eq "^[[:space:]]*#?[[:space:]]*listen_addresses[[:space:]]*=" "$CONF_FILE"; then
  sudo sed -E -i "s|^[[:space:]]*#?[[:space:]]*listen_addresses[[:space:]]*=.*|listen_addresses = '*'|g" "$CONF_FILE"
else
  echo "listen_addresses = '*'" | sudo tee -a "$CONF_FILE" >/dev/null
fi

HBA_LINE="host    ${DB_NAME}    ${DB_USER}    ${CLIENT_IP}/32    scram-sha-256"
if ! sudo grep -Fq "$HBA_LINE" "$HBA_FILE"; then
  echo "$HBA_LINE" | sudo tee -a "$HBA_FILE" >/dev/null
  echo "[INFO] Added pg_hba rule: $HBA_LINE"
else
  echo "[INFO] pg_hba rule already exists."
fi

# Align password encryption and rotate role password for SCRAM auth
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE "${DB_USER}" LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE "${DB_USER}" WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT pg_reload_conf();
SQL

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files | grep -q "^postgresql.service"; then
    sudo systemctl restart postgresql
  fi
fi

# Open firewall if UFW exists
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow from "$CLIENT_IP" to any port 5432 proto tcp || true
fi

echo "[DONE] PostgreSQL remote access configured."
echo "[NEXT] Test from app machine:"
echo "  nc -zv -G 5 112.78.4.40 5432"
