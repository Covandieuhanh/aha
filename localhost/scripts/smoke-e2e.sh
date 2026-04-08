#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://127.0.0.1:8443}"
AUTH_COOKIE="${AUTH_COOKIE:-}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
TMP_DIR="${TMP_DIR:-/tmp/dataaha-smoke}"

mkdir -p "$TMP_DIR"

fetch_bootstrap() {
  curl_retry -k -s --cookie "dataaha_auth=${AUTH_COOKIE}" "${BASE_URL}/api/bootstrap.ashx"
}

post_json() {
  local path="$1"
  local body="$2"
  curl_retry -k -s --cookie "dataaha_auth=${AUTH_COOKIE}" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "${BASE_URL}${path}"
}

curl_retry() {
  local attempts=0
  local max_attempts=6
  while true; do
    if curl "$@"; then
      return 0
    fi
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      return 1
    fi
    sleep 1
  done
}

if [ -z "$AUTH_COOKIE" ]; then
  GET_HEADERS="$TMP_DIR/get-headers.txt"
  LOGIN_HEADERS="$TMP_DIR/login-headers.txt"
  LOGIN_BODY="$TMP_DIR/login-body.json"

  curl_retry -k -s -D "$GET_HEADERS" -o /dev/null "${BASE_URL}/" >/dev/null
  SESSION_COOKIE="$(sed -n 's/^Set-Cookie: \(ASP.NET_SessionId=[^;]*\).*/\1/p' "$GET_HEADERS" | head -n 1)"

  if [ -n "$SESSION_COOKIE" ]; then
    curl_retry -k -s -D "$LOGIN_HEADERS" -o "$LOGIN_BODY" \
      -H "Cookie: ${SESSION_COOKIE}" \
      -H 'Content-Type: application/json' \
      -d "{\"action\":\"login\",\"identity\":\"${ADMIN_IDENTITY}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
      "${BASE_URL}/api/auth.ashx" >/dev/null
  else
    curl_retry -k -s -D "$LOGIN_HEADERS" -o "$LOGIN_BODY" \
      -H 'Content-Type: application/json' \
      -d "{\"action\":\"login\",\"identity\":\"${ADMIN_IDENTITY}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
      "${BASE_URL}/api/auth.ashx" >/dev/null
  fi

  AUTH_COOKIE="$(sed -n 's/^Set-Cookie: \(dataaha_auth=[^;]*\).*/\1/p' "$LOGIN_HEADERS" | head -n 1 | sed 's/^dataaha_auth=//')"
  if [ -z "$AUTH_COOKIE" ]; then
    echo "[FAIL] Login cannot issue dataaha_auth cookie."
    if [ -f "$LOGIN_BODY" ]; then
      echo "[INFO] login body: $(cat "$LOGIN_BODY")"
    fi
    exit 1
  fi
fi

BOOTSTRAP_1="$TMP_DIR/bootstrap-1.json"
fetch_bootstrap > "$BOOTSTRAP_1"

CURRENT_USER_ID="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_1','utf8'));if(!p.ok||!p.currentUser||!p.currentUser.UserId){process.exit(7)};process.stdout.write(String(p.currentUser.UserId));")" || {
  echo "[FAIL] Cannot load current user from bootstrap."
  exit 1
}

PRODUCT_ID="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_1','utf8'));if(!p.ok||!Array.isArray(p.products)||p.products.length===0){process.exit(2)};process.stdout.write(String(p.products[0].ProductId||''));")" || {
  echo "[FAIL] Cannot load product from bootstrap."
  exit 1
}

if [ -z "$PRODUCT_ID" ]; then
  echo "[FAIL] ProductId empty."
  exit 1
fi

SELF_ROLE_RES="$(post_json "/api/users.ashx" "{\"action\":\"update\",\"userId\":\"${CURRENT_USER_ID}\",\"roleKey\":\"member\",\"isActive\":true}")"
echo "$SELF_ROLE_RES" | rg -q '"ok":false' || {
  echo "[FAIL] Self role downgrade should be blocked: $SELF_ROLE_RES"
  exit 1
}

SELF_LOCK_RES="$(post_json "/api/users.ashx" "{\"action\":\"update\",\"userId\":\"${CURRENT_USER_ID}\",\"roleKey\":\"admin\",\"isActive\":false}")"
echo "$SELF_LOCK_RES" | rg -q '"ok":false' || {
  echo "[FAIL] Self lock should be blocked: $SELF_LOCK_RES"
  exit 1
}

MARKER="E2E-$(date +%s)"
PHONE="09$(date +%s | tail -c 9)"
EMAIL_MARKER="$(printf '%s' "$MARKER" | tr '[:upper:]' '[:lower:]')"

CUSTOMER_RES="$(post_json "/api/customers.ashx" "{\"action\":\"save\",\"name\":\"Khach ${MARKER}\",\"phone\":\"${PHONE}\",\"email\":\"${EMAIL_MARKER}@example.com\",\"note\":\"${MARKER}\"}")"
echo "$CUSTOMER_RES" | rg -q '"ok":true' || {
  echo "[FAIL] Customer save failed: $CUSTOMER_RES"
  exit 1
}

BOOTSTRAP_2="$TMP_DIR/bootstrap-2.json"
fetch_bootstrap > "$BOOTSTRAP_2"
CUSTOMER_ID="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_2','utf8'));const row=(p.customers||[]).find(x=>x.Note==='${MARKER}');if(!row){process.exit(3)};process.stdout.write(String(row.CustomerId||''));")" || {
  echo "[FAIL] Cannot find created customer."
  exit 1
}

VISIT_A_RES="$(post_json "/api/visits.ashx" "{\"action\":\"save\",\"customerId\":\"${CUSTOMER_ID}\",\"productId\":\"${PRODUCT_ID}\",\"visitDate\":\"2026-04-20\",\"revenue\":\"1000000\",\"note\":\"${MARKER}-A\"}")"
echo "$VISIT_A_RES" | rg -q '"ok":true' || {
  echo "[FAIL] Visit A save failed: $VISIT_A_RES"
  exit 1
}

VISIT_B_RES="$(post_json "/api/visits.ashx" "{\"action\":\"save\",\"customerId\":\"${CUSTOMER_ID}\",\"productId\":\"${PRODUCT_ID}\",\"visitDate\":\"2026-04-02\",\"revenue\":\"1500000\",\"note\":\"${MARKER}-B\"}")"
echo "$VISIT_B_RES" | rg -q '"ok":true' || {
  echo "[FAIL] Visit B save failed: $VISIT_B_RES"
  exit 1
}

BOOTSTRAP_3="$TMP_DIR/bootstrap-3.json"
fetch_bootstrap > "$BOOTSTRAP_3"

VISIT_A_ID="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_3','utf8'));const rows=(p.visits||[]).filter(x=>x.CustomerId==='${CUSTOMER_ID}');const a=rows.find(x=>x.Note==='${MARKER}-A');const b=rows.find(x=>x.Note==='${MARKER}-B');if(!a||!b||Number(a.OccurrenceInMonth)!==2||Number(b.OccurrenceInMonth)!==1){process.exit(4)};process.stdout.write(String(a.VisitId||''));")" || {
  echo "[FAIL] Occurrence after create not correct."
  exit 1
}

VISIT_EDIT_RES="$(post_json "/api/visits.ashx" "{\"action\":\"save\",\"visitId\":\"${VISIT_A_ID}\",\"customerId\":\"${CUSTOMER_ID}\",\"productId\":\"${PRODUCT_ID}\",\"visitDate\":\"2026-04-25\",\"revenue\":\"1100000\",\"note\":\"${MARKER}-A2\"}")"
echo "$VISIT_EDIT_RES" | rg -q '"ok":true' || {
  echo "[FAIL] Visit edit failed: $VISIT_EDIT_RES"
  exit 1
}

BOOTSTRAP_4="$TMP_DIR/bootstrap-4.json"
fetch_bootstrap > "$BOOTSTRAP_4"
VISIT_B_ID="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_4','utf8'));const rows=(p.visits||[]).filter(x=>x.CustomerId==='${CUSTOMER_ID}');const a=rows.find(x=>x.Note==='${MARKER}-A2');const b=rows.find(x=>x.Note==='${MARKER}-B');if(!a||!b||Number(a.OccurrenceInMonth)!==2||Number(b.OccurrenceInMonth)!==1){process.exit(5)};process.stdout.write(String(b.VisitId||''));")" || {
  echo "[FAIL] Occurrence after edit not correct."
  exit 1
}

VISIT_DELETE_RES="$(post_json "/api/visits.ashx" "{\"action\":\"delete\",\"visitId\":\"${VISIT_B_ID}\"}")"
echo "$VISIT_DELETE_RES" | rg -q '"ok":true' || {
  echo "[FAIL] Visit delete failed: $VISIT_DELETE_RES"
  exit 1
}

BOOTSTRAP_5="$TMP_DIR/bootstrap-5.json"
fetch_bootstrap > "$BOOTSTRAP_5"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$BOOTSTRAP_5','utf8'));const rows=(p.visits||[]).filter(x=>x.CustomerId==='${CUSTOMER_ID}');if(rows.length!==1||Number(rows[0].OccurrenceInMonth)!==1){process.exit(6)}" || {
  echo "[FAIL] Occurrence after delete not correct."
  exit 1
}

echo "[PASS] E2E logic OK via curl: auth + user safety guard + create/edit/delete visit reorder."
