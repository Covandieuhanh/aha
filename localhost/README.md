# Data Aha Production Track

Codebase này là production track mới theo hướng host-compatible:
- ASP.NET WebForms
- PostgreSQL
- local HTTPS qua Docker + nginx + mono-fastcgi

## Chạy local

1. `cd "/Users/duccuongtran/Documents/data aha/localhost"`
2. `./start-localhost.sh`
3. Mở:
   - `https://localhost:8443`

Tài khoản admin seed mặc định:
- `đăng_nhập`: `admin`
- `mật_khẩu`: `admin123`

## Dừng stack

- `./stop-localhost.sh`

## Smoke test nhanh

- Chạy end-to-end (auth + an toàn user + create/edit/delete giao dịch):
  - `bash ./scripts/smoke-e2e.sh`

## Gắn DB thật (khuyến nghị)

App ưu tiên đọc chuỗi kết nối từ biến môi trường:
- `DATAAHA_CONNECTION_STRING` (ưu tiên cao nhất)
- fallback về `DataAhaConnectionString` trong `Web.config` nếu để trống

Các bước:
1. Tạo file `.env` trong thư mục `localhost/` (có thể copy từ `.env.example`).
2. Khai báo:
   - `DATAAHA_CONNECTION_STRING=Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true`
3. Chạy lại:
   - `./start-localhost.sh`

Ghi chú:
- Nếu đã gắn `DATAAHA_CONNECTION_STRING`, app web sẽ dùng DB thật.
- DB local Docker PostgreSQL vẫn có thể chạy song song để dự phòng/test.
- Driver PostgreSQL của app đã nâng lên `Npgsql 4.0.17` để hỗ trợ `scram-sha-256`.

Ví dụ PostgreSQL thật:
- `DATAAHA_CONNECTION_STRING=Host=112.78.4.40;Port=5432;Database=<TEN_DB>;Username=ahashine;Password=<MAT_KHAU>;SSL Mode=Require;Trust Server Certificate=true`

Điều kiện để kết nối được:
- server PostgreSQL mở cổng `5432` cho IP máy chạy app
- có đúng tên database (`<TEN_DB>`)

Script hỗ trợ:
- Trên server PostgreSQL: `localhost/scripts/server-enable-postgres-remote.sh`
- Trên máy app để test port: `localhost/scripts/check-remote-postgres.sh`
- Tài liệu cấu hình SCRAM chi tiết: `docs/POSTGRES_SCRAM_SETUP.md`

## Cài đặt OTP bảo mật

App đã có tab `OTP` trong màn hình admin để cấu hình:
- Endpoint, API Key, Sender, Template, HTTP Method.
- Danh sách tham số API dạng key/value với biến động (`{OTP}`, `{phoneNumber}`, `{message}`, `{brandName}`, `{apiKey}`, `{timestamp}`, `{now}`).
- Bật/tắt chế độ DEV (không gửi SMS thật).

Các appSettings vẫn còn hiệu lực như fallback:
- `OtpCooldownSeconds`: khoảng nghỉ giữa 2 lần xin OTP cho cùng phone/purpose.
- `OtpMaxPerDay`: giới hạn tổng lần xin OTP mỗi ngày.
- `OtpMaxVerifyAttempts`: giới hạn số lần nhập sai OTP trước khi khóa mã.
- `AppAuthSecret`: secret ký cookie đăng nhập, cần đổi secret riêng khi lên production.
