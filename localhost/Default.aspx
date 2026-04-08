<%@ Page Language="C#" AutoEventWireup="true" CodeFile="Default.aspx.cs" Inherits="_Default" %>
<!doctype html>
<html lang="vi">
  <head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#11795f" />
    <title>Data Aha</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <form id="form1" runat="server">
      <div class="page-shell">
        <section id="auth-view" class="auth-view">
          <div class="auth-card">
            <p class="eyebrow">DATA AHA</p>
            <h1>Quản lý voucher, hoa hồng và điểm thành viên</h1>
            <p class="lead">Bản production mới theo host ASP.NET WebForms + PostgreSQL.</p>

            <div class="auth-switcher">
              <button type="button" class="auth-switch active" data-auth-panel="login-panel">Đăng nhập</button>
              <button type="button" class="auth-switch" data-auth-panel="register-panel">Đăng ký</button>
              <button type="button" class="auth-switch" data-auth-panel="reset-panel">Quên mật khẩu</button>
            </div>

            <section id="login-panel" class="auth-panel">
              <label>
                Tài khoản hoặc số điện thoại
                <input type="text" id="login-identity" autocomplete="username" />
              </label>
              <label>
                Mật khẩu
                <input type="password" id="login-password" autocomplete="current-password" />
              </label>
              <button type="button" id="login-btn" class="primary-btn">Đăng nhập</button>
            </section>

            <section id="register-panel" class="auth-panel hidden">
              <label>
                Họ tên
                <input type="text" id="register-name" autocomplete="name" />
              </label>
              <label>
                Số điện thoại
                <input type="tel" id="register-phone" inputmode="tel" autocomplete="tel" />
              </label>
              <label>
                Mã OTP
                <input type="text" id="register-otp" inputmode="numeric" autocomplete="one-time-code" />
              </label>
              <label>
                Mật khẩu mới
                <input type="password" id="register-password" autocomplete="new-password" />
              </label>
              <div class="row-actions">
                <button type="button" id="register-request-otp-btn" class="secondary-btn">Lấy OTP</button>
                <button type="button" id="register-btn" class="primary-btn">Tạo tài khoản</button>
              </div>
            </section>

            <section id="reset-panel" class="auth-panel hidden">
              <label>
                Số điện thoại
                <input type="tel" id="reset-phone" inputmode="tel" autocomplete="tel" />
              </label>
              <label>
                Mã OTP
                <input type="text" id="reset-otp" inputmode="numeric" autocomplete="one-time-code" />
              </label>
              <label>
                Mật khẩu mới
                <input type="password" id="reset-password" autocomplete="new-password" />
              </label>
              <div class="row-actions">
                <button type="button" id="reset-request-otp-btn" class="secondary-btn">Lấy OTP</button>
                <button type="button" id="reset-btn" class="primary-btn">Đặt lại mật khẩu</button>
              </div>
            </section>

            <div id="auth-message" class="message-box"></div>
          </div>
        </section>

        <section id="app-view" class="app-view hidden">
          <header class="topbar">
            <div class="topbar-copy">
              <p class="eyebrow">DATA AHA</p>
              <h2>Hệ thống vận hành mới</h2>
              <p class="topbar-note">Tối ưu cho vận hành trên điện thoại, tập trung ghi nhận nhanh và xem số liệu rõ ràng.</p>
            </div>
            <div class="topbar-meta">
              <p id="session-user"></p>
              <button type="button" id="logout-btn" class="secondary-btn">Đăng xuất</button>
            </div>
          </header>

          <nav id="app-nav" class="app-nav"></nav>
          <section id="quick-launch" class="quick-launch hidden">
            <button type="button" id="quick-go-visit" class="quick-chip">+ Giao dịch</button>
            <button type="button" id="quick-go-customer" class="quick-chip">+ Khách mới</button>
            <button type="button" id="quick-go-point" class="quick-chip">+ Cộng điểm</button>
          </section>

          <section id="dashboard-panel" class="panel">
            <div class="panel-title-block">
              <h3>Tổng quan</h3>
              <p>Nhìn nhanh tình hình tháng này trên một màn hình.</p>
            </div>
            <div id="dashboard-cards" class="card-grid"></div>
          </section>

          <section id="customers-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Khách hàng</h3>
              <p>Nhập nhanh, tra cứu nhanh, dễ thao tác trên điện thoại.</p>
            </div>
            <div class="panel-grid">
              <div class="card">
                <h4>Nhập khách hàng</h4>
                <input type="hidden" id="customer-id" />
                <label>Họ tên<input type="text" id="customer-name" /></label>
                <label>Số điện thoại<input type="tel" id="customer-phone" inputmode="tel" /></label>
                <label>Email<input type="email" id="customer-email" autocomplete="email" /></label>
                <label>Ghi chú<textarea id="customer-note" rows="3"></textarea></label>
                <div class="row-actions">
                  <button type="button" id="customer-save-btn" class="primary-btn">Lưu</button>
                  <button type="button" id="customer-reset-btn" class="secondary-btn">Làm mới</button>
                </div>
                <div id="customer-message" class="message-box"></div>
              </div>
              <div class="card">
                <h4>Danh sách</h4>
                <label>Tìm kiếm<input type="search" id="customer-search" placeholder="Tên, số điện thoại, email..." /></label>
                <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Số điện thoại</th><th>Email</th><th>Ghi chú</th><th></th></tr></thead><tbody id="customer-table"></tbody></table></div>
              </div>
            </div>
          </section>

          <section id="products-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Sản phẩm / dịch vụ</h3>
              <p>Danh mục gọn, nhập giá và ghi chú rõ ràng cho vận hành hằng ngày.</p>
            </div>
            <div class="panel-grid">
              <div class="card">
                <h4>Sản phẩm / dịch vụ</h4>
                <input type="hidden" id="product-id" />
                <label>Tên<input type="text" id="product-name" /></label>
                <label>Mã<input type="text" id="product-code" /></label>
                <label>Giá gợi ý<input type="number" id="product-price" inputmode="decimal" /></label>
                <label>Ghi chú<textarea id="product-note" rows="3"></textarea></label>
                <div class="row-actions">
                  <button type="button" id="product-save-btn" class="primary-btn">Lưu</button>
                  <button type="button" id="product-reset-btn" class="secondary-btn">Làm mới</button>
                </div>
                <div id="product-message" class="message-box"></div>
              </div>
              <div class="card">
                <h4>Danh sách sản phẩm</h4>
                <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Mã</th><th>Giá</th><th>Ghi chú</th><th></th></tr></thead><tbody id="product-table"></tbody></table></div>
              </div>
            </div>
          </section>

          <section id="visits-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Giao dịch / voucher</h3>
              <p>Ghi nhận lượt đến và tính voucher theo lần phát sinh trong tháng.</p>
            </div>
            <div class="panel-grid">
              <div class="card">
                <h4>Ghi nhận lượt khách đến</h4>
                <input type="hidden" id="visit-id" />
                <label>Khách hàng<select id="visit-customer"></select></label>
                <button type="button" id="visit-quick-customer-toggle" class="secondary-btn quick-toggle-btn">Không thấy khách? Thêm nhanh</button>
                <div id="visit-quick-customer-box" class="quick-inline-box hidden">
                  <label>Tên khách mới<input type="text" id="visit-quick-customer-name" placeholder="Ví dụ: Nguyễn Thị A" /></label>
                  <label>Số điện thoại<input type="tel" id="visit-quick-customer-phone" inputmode="tel" placeholder="Có thể để trống" /></label>
                </div>
                <label>Sản phẩm / dịch vụ<select id="visit-product"></select></label>
                <button type="button" id="visit-quick-product-toggle" class="secondary-btn quick-toggle-btn">Không thấy dịch vụ? Thêm nhanh</button>
                <div id="visit-quick-product-box" class="quick-inline-box hidden">
                  <label>Tên dịch vụ mới<input type="text" id="visit-quick-product-name" placeholder="Ví dụ: Gói chăm sóc da" /></label>
                  <label>Giá gợi ý<input type="number" id="visit-quick-product-price" inputmode="decimal" placeholder="0" /></label>
                </div>
                <label>Người giới thiệu<select id="visit-referrer"></select></label>
                <label>Ngày giao dịch<input type="date" id="visit-date" /></label>
                <label>Doanh thu<input type="number" id="visit-revenue" inputmode="decimal" /></label>
                <label>Ghi chú<textarea id="visit-note" rows="3"></textarea></label>
                <div class="row-actions">
                  <button type="button" id="visit-save-btn" class="primary-btn">Lưu giao dịch</button>
                  <button type="button" id="visit-reset-btn" class="secondary-btn">Làm mới</button>
                </div>
                <div id="visit-message" class="message-box"></div>
              </div>
              <div class="card">
                <h4>Lịch sử giao dịch / voucher</h4>
                <label>Tháng<input type="month" id="visit-month" /></label>
                <label>Lọc nhanh<input type="search" id="visit-search" placeholder="Khách, dịch vụ, người giới thiệu..." /></label>
                <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Khách</th><th>Dịch vụ</th><th>Lần</th><th>Voucher</th><th>Người giới thiệu</th><th></th></tr></thead><tbody id="visit-table"></tbody></table></div>
              </div>
            </div>
          </section>

          <section id="referrals-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Hoa hồng giới thiệu</h3>
              <p>Theo dõi hoa hồng theo tháng, tối ưu để xem trên điện thoại.</p>
            </div>
            <div class="card">
              <h4>Lịch sử hoa hồng giới thiệu</h4>
              <label>Tháng<input type="month" id="referral-month" /></label>
              <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Người giới thiệu</th><th>Khách</th><th>Lần</th><th>Tỷ lệ</th><th>Hoa hồng</th></tr></thead><tbody id="referral-table"></tbody></table></div>
            </div>
          </section>

          <section id="points-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Điểm thành viên</h3>
              <p>Cộng điểm có lý do chi tiết và công khai minh bạch trong tháng.</p>
            </div>
            <div class="panel-grid">
              <div class="card" id="points-form-card">
                <h4>Cộng điểm thành viên</h4>
                <label>Thành viên<select id="point-member"></select></label>
                <label>Số điểm<input type="number" id="point-value" inputmode="numeric" /></label>
                <label>Lý do<textarea id="point-reason" rows="4"></textarea></label>
                <div class="quick-reasons">
                  <button type="button" class="secondary-btn quick-reason-btn" data-reason="Hỗ trợ vận hành đúng quy trình">Hỗ trợ vận hành</button>
                  <button type="button" class="secondary-btn quick-reason-btn" data-reason="Hoàn thành KPI tháng">Hoàn thành KPI</button>
                  <button type="button" class="secondary-btn quick-reason-btn" data-reason="Hỗ trợ team xử lý khách khó">Hỗ trợ team</button>
                </div>
                <label class="check-row"><input type="checkbox" id="point-public" checked="checked" /> Công khai cho thành viên xem</label>
                <button type="button" id="point-save-btn" class="primary-btn">Ghi điểm</button>
                <div id="point-message" class="message-box"></div>
              </div>
              <div class="card">
                <h4>Điểm công khai trong tháng</h4>
                <label>Tháng<input type="month" id="points-month" /></label>
                <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Thành viên</th><th>Điểm</th><th>Lý do</th><th>Người ghi</th></tr></thead><tbody id="public-points-table"></tbody></table></div>
              </div>
              <div class="card">
                <h4>Điểm của tôi trong tháng</h4>
                <div id="my-points-summary" class="summary-box"></div>
                <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Điểm</th><th>Lý do</th><th>Người ghi</th></tr></thead><tbody id="my-points-table"></tbody></table></div>
              </div>
            </div>
          </section>

          <section id="users-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Tài khoản</h3>
              <p>Cấp vai trò vận hành và kiểm soát trạng thái truy cập.</p>
            </div>
            <div class="card">
              <h4>Quản lý tài khoản</h4>
              <div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Tài khoản</th><th>Số điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody id="users-table"></tbody></table></div>
            </div>
          </section>

          <section id="otp-settings-panel" class="panel hidden">
            <div class="panel-title-block">
              <h3>Cấu hình OTP (SMS)</h3>
              <p>Thiết lập đơn vị gửi OTP cho đăng ký và quên mật khẩu. Chỉ tài khoản quản trị mới được sửa.</p>
            </div>
            <div class="card">
              <h4>Thiết lập đơn vị gửi OTP</h4>
              <div class="otp-top-grid">
                <label>Endpoint<input type="text" id="otp-endpoint" placeholder="https://api.example.com/send-otp" /></label>
                <label>API Key<input type="text" id="otp-api-key" placeholder="API key" /></label>
                <label>Sender<input type="text" id="otp-sender" placeholder="Brand name" /></label>
                <label>Template<input type="text" id="otp-template" placeholder="Mã OTP của bạn là: {OTP}" /></label>
                <label>HTTP Method
                  <select id="otp-http-method">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </label>
              </div>

              <div class="otp-params-head">
                <h4>Tham số API (key / value)</h4>
                <p>Bạn có thể dùng biến: <code>{OTP}</code>, <code>{phoneNumber}</code>, <code>{message}</code>, <code>{brandName}</code>, <code>{apiKey}</code>, <code>{timestamp}</code>, <code>{now}</code>.</p>
              </div>
              <div id="otp-param-list" class="otp-param-list"></div>
              <div class="row-actions">
                <button type="button" id="otp-add-param-btn" class="secondary-btn">+ Thêm tham số</button>
              </div>

              <label class="check-row"><input type="checkbox" id="otp-dev-mode" /> Bật chế độ DEV (không gửi SMS, chỉ log)</label>
              <div class="row-actions">
                <button type="button" id="otp-save-btn" class="primary-btn">Lưu cấu hình OTP</button>
              </div>
              <div id="otp-settings-message" class="message-box"></div>
            </div>
          </section>
        </section>
      </div>
    </form>
    <script src="/assets/app.js"></script>
  </body>
</html>
