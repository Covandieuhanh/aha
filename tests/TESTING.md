# Testing Workflow

## 1) Chuẩn bị môi trường

```bash
nvm use
```

Nếu chưa có Node, chạy:

```bash
nvm install --lts
nvm alias default 'lts/*'
```

## 2) Chạy test

```bash
npm test
npm run test:watch
npm run test:coverage
```

## 3) Cấu trúc test hiện tại

- `tests/auth-permissions.test.js`: kiểm tra đăng nhập + phân quyền admin/nhân viên.
- `tests/business-rules.test.js`: kiểm tra quy tắc tính % voucher và % hoa hồng theo số lần trong tháng.
- `tests/customer-management.test.js`: kiểm tra quyền sửa/xoá khách hàng.
- `tests/report-visibility.test.js`: kiểm tra nhân viên chỉ xem được lịch sử hoa hồng của chính mình.
- `tests/helpers/appHarness.js`: helper chung để boot app, thao tác form, chọn tab, đọc bảng dữ liệu.

## 4) Cách thêm test khi có tính năng mới

1. Tạo file test mới trong `tests/` theo tên tính năng, ví dụ: `tests/products-filter.test.js`.
2. Tái sử dụng helper trong `tests/helpers/appHarness.js`.
3. Mỗi test nên có 3 phần rõ ràng:
   - Setup dữ liệu.
   - Thao tác UI.
   - Assert kết quả (bảng dữ liệu, summary, phân quyền).
4. Mỗi lỗi mới phải có test tái hiện trước khi sửa.

## 5) Quy tắc chất lượng đề xuất

- Không merge khi `npm test` fail.
- Ưu tiên test theo hành vi người dùng (integration) thay vì chỉ test hàm nhỏ.
- Với mỗi chính sách nghiệp vụ mới, thêm ít nhất:
  - 1 test luồng thành công.
  - 1 test luồng quyền truy cập sai/thiếu dữ liệu.
