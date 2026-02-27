# Aha CRM - Quản trị khách hàng

Ứng dụng Aha CRM hiện có 2 chế độ:

- `Local mode` (mở trực tiếp file `index.html`): chỉ phù hợp demo 1 máy.
- `Server mode` (chạy qua `server.js`): dùng dữ liệu tập trung cho nhiều người, phù hợp phạm vi nội bộ 20 người.

Để vận hành nội bộ nhiều người, luôn dùng `Server mode`.

## Tài khoản và phân quyền

- Tài khoản admin mặc định lần khởi tạo đầu tiên:
  - `username`: lấy từ `AHA_ADMIN_USERNAME` (mặc định `admin`)
  - `password`: lấy từ `AHA_ADMIN_PASSWORD` (mặc định `admin123`)
- Admin có toàn quyền và có thể:
  - Quản lý khách hàng.
  - Xoá khách hàng.
  - Quản lý sản phẩm/dịch vụ.
  - Ghi nhận tích điểm voucher.
  - Ghi nhận hoa hồng giới thiệu.
  - Tạo tài khoản nhân viên.
  - Bật/tắt quyền theo từng tính năng cho từng nhân viên (`Khách hàng`, `Sửa KH`, `Sản phẩm`, `Voucher`, `Hoa hồng`, `Báo cáo`) và bấm `Lưu` để áp dụng ngay.
- Tài khoản nhân viên:
  - Mặc định khi tạo mới: chỉ có quyền tab `Báo cáo chi tiết`.
  - Chỉ thấy các tab được admin cấp.
  - Quyền `Sửa thông tin khách hàng` là quyền riêng; có thể bật/tắt độc lập với quyền vào tab `Khách hàng`.
  - Khi xem tab `Báo cáo chi tiết`, chỉ thấy lịch sử hoa hồng của chính tài khoản đó.

## Các tab chức năng

1. `Thông tin khách hàng`: nhập, sửa hồ sơ khách hàng (nếu có quyền) và xoá khách hàng (admin).
2. `Sản phẩm dịch vụ`: nhập và lưu danh mục sản phẩm/dịch vụ.
3. `Tích điểm voucher`: ghi nhận lượt khách tới Aha và tự tính voucher theo số lần trong tháng.
4. `Hoa hồng giới thiệu`: ghi nhận giao dịch giới thiệu và tự tính hoa hồng theo số lần trong tháng.
5. `Báo cáo chi tiết`: xem lịch sử hoa hồng.
6. `Tài khoản thành viên`: chỉ admin thấy và thao tác.

## Nhập / Xuất dữ liệu khách hàng

- Trong tab `Thông tin khách hàng` đã có sẵn:
  - `Tải file mẫu CSV`
  - `Nhập dữ liệu từ file`
  - `Xuất dữ liệu khách hàng CSV`
- Mẫu cột CSV hỗ trợ:
  - `name` (bắt buộc)
  - `phone`
  - `email`
  - `note`
- File mẫu có sẵn trong source:
  - `samples/customers-template.csv`
- Khi chạy server mode, có thể tải trực tiếp:
  - `http://IP_MAY_CHU:8080/samples/customers-template.csv`

## Chính sách tính tự động

- Lần 1 trong tháng: `5%`
- Lần 2: `10%`
- Lần 3: `15%`
- Lần 4: `20%`
- Lần 5: `25%`
- Lần 6: `30%`
- Lần 7: `35%`
- Lần 8: `40%`
- Lần 9: `45%`
- Từ lần 10 trở lên: `50%`

Áp dụng tương tự cho tích điểm voucher và hoa hồng giới thiệu (khi có chọn người giới thiệu).

## Quy tắc người giới thiệu và khách được giới thiệu

- Trong tab hoa hồng:
  - `Người giới thiệu` chỉ chọn từ tài khoản nhân viên do admin tạo, có thể để trống.
  - `Khách được giới thiệu` bắt buộc chọn từ danh sách khách hàng đã có.
  - `Sản phẩm / dịch vụ` bắt buộc chọn từ danh sách sản phẩm/dịch vụ.
- Nếu để trống người giới thiệu, giao dịch vẫn ghi nhận nhưng hoa hồng mặc định `0`.

## Triển khai nội bộ đơn giản nhất (khuyến nghị)

Dùng `Docker Compose` trên 1 máy chủ nội bộ (mini PC/NAS/server công ty).

### 1) Chuẩn bị

- Cài Docker + Docker Compose trên máy chủ.
- Đặt IP tĩnh cho máy chủ trong LAN (ví dụ `192.168.1.20`).

### 2) Cấu hình

```bash
cp .env.example .env
```

Sửa file `.env`:

- `SESSION_SECRET`: đặt chuỗi mạnh, dài, ngẫu nhiên.
  - Gợi ý tạo nhanh: `openssl rand -hex 32`
- `COOKIE_SECURE`: để `false` khi chạy HTTP nội bộ LAN, chỉ đặt `true` nếu bạn có HTTPS.
- `AHA_ADMIN_PASSWORD`: đổi mật khẩu admin ngay từ đầu.

### 3) Chạy hệ thống

```bash
docker compose up -d --build
```

Hoặc dùng lệnh tắt:

```bash
make up
```

### 4) Truy cập

- Trong mạng nội bộ mở: `http://IP_MAY_CHU:8080`
- Ví dụ: `http://192.168.1.20:8080`

### 5) Kiểm tra nhanh

- Health check: `http://IP_MAY_CHU:8080/health`
- Đăng nhập admin, tạo 1 tài khoản nhân viên, thử cấp quyền và lưu.

## Cập nhật phiên bản

```bash
docker compose down
docker compose up -d --build
```

Hoặc:

```bash
make restart
```

## Sao lưu dữ liệu

Dữ liệu server được lưu tại:

- `data/store.json`

Sao lưu định kỳ file này (hoặc cả thư mục `data/`).

Bạn có thể tạo bản sao lưu nhanh:

```bash
make backup
```

## Chạy không dùng Docker (phương án phụ)

Yêu cầu Node.js LTS.

```bash
cp .env.example .env
npm install
npm start
```

## Lưu ý vận hành quan trọng

- Nếu bạn mở bằng `file://.../index.html` thì là `Local mode`, dữ liệu không dùng chung cho 20 người.
- Để chạy `Server mode`, luôn truy cập qua `http://IP_MAY_CHU:PORT`.
- Khi chạy qua `server.js`/Docker, frontend tự dùng `Server mode` (kể cả `localhost`).
- Tuỳ chọn kỹ thuật: có thể thêm `?mode=server` hoặc `?mode=local` để ép chế độ nếu cần debug.
- Nên giới hạn truy cập cổng `8080` trong LAN/VPN nội bộ, không public Internet trực tiếp.

## Thiết lập test tự động

### Yêu cầu

- Node.js LTS (đã có `.nvmrc`).
- Git (để dùng hook `pre-commit`, `pre-push`).

### Lệnh chạy

```bash
nvm use
npm test
npm run test:watch
npm run test:coverage
npm run test:auto
```

### Tự động hóa đã bật

- `pre-commit`: tự chạy `npm test`.
- `pre-push`: tự chạy `npm run test:coverage`.
- CI workflow: khi `push` hoặc `pull_request`, GitHub Actions chạy `npm run test:strict`.
- Watch mode full-suite: `npm run test:auto` tự chạy lại toàn bộ test + coverage khi có file thay đổi.

### Mức độ an toàn

- Bộ test giúp giảm rủi ro mạnh, nhưng không thể đảm bảo rủi ro `0%`.
- Để an toàn cao: giữ `pre-commit`, `pre-push`, CI và `test:auto`.

### Bộ test hiện có

- `tests/auth-permissions.test.js`
- `tests/business-rules.test.js`
- `tests/customer-management.test.js`
- `tests/report-visibility.test.js`
- Hướng dẫn mở rộng test: `tests/TESTING.md`
