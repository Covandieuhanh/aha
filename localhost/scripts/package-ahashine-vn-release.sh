#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${APP_DIR}/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${1:-${ROOT_DIR}/release/ahashine.vn-${STAMP}}"

APP_OUT="${OUT_DIR}/app"
DOC_OUT="${OUT_DIR}/docs"
SQL_OUT="${OUT_DIR}/sql"

mkdir -p "${APP_OUT}" "${DOC_OUT}" "${SQL_OUT}"

cp -R "${APP_DIR}/App_Code" "${APP_OUT}/App_Code"
cp -R "${APP_DIR}/api" "${APP_OUT}/api"
cp -R "${APP_DIR}/assets" "${APP_OUT}/assets"
cp -R "${APP_DIR}/bin" "${APP_OUT}/bin"
cp "${APP_DIR}/Default.aspx" "${APP_OUT}/Default.aspx"
cp "${APP_DIR}/Default.aspx.cs" "${APP_OUT}/Default.aspx.cs"
cp "${APP_DIR}/Web.config" "${APP_OUT}/Web.config"

cp "${APP_DIR}/docker/sql/init-schema.pgsql" "${SQL_OUT}/init-schema.pgsql"
cp "${ROOT_DIR}/docs/POSTGRES_SCRAM_SETUP.md" "${DOC_OUT}/POSTGRES_SCRAM_SETUP.md"
cp "${ROOT_DIR}/docs/HOST_TECH_BASELINE.md" "${DOC_OUT}/HOST_TECH_BASELINE.md"

cat > "${OUT_DIR}/README-DEPLOY-AHASHINE-VN.md" <<'EOF'
# Release Ahashine.vn

## Mục tiêu
- Upload thư mục `app/` lên host ASP.NET WebForms.
- Dùng PostgreSQL SCRAM cho DB thật.

## Cấu trúc
- `app/`: source runtime upload lên host.
- `sql/init-schema.pgsql`: schema DB PostgreSQL.
- `docs/`: tài liệu host + SCRAM.

## Triển khai nhanh
1. Trên host, trỏ web root tới nội dung trong `app/`.
2. Đảm bảo host chạy ASP.NET WebForms / .NET Framework 4.7.2.
3. Sửa `app/Web.config`:
   - `DataAhaConnectionString` thành chuỗi DB production.
   - `AppAuthSecret` thành secret riêng.
4. Đảm bảo PostgreSQL đã mở quyền truy cập cho IP host web trong `pg_hba.conf` với `scram-sha-256`.
5. Nếu DB mới, chạy `sql/init-schema.pgsql`.

## Ghi chú
- Tab OTP đã có sẵn trong giao diện admin để cấu hình nhà cung cấp OTP thật.
- Khi chưa sẵn sàng OTP thật, bật DEV trong tab OTP để test nội bộ.
EOF

echo "[DONE] Packaged release at: ${OUT_DIR}"
