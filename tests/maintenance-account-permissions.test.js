const {
  addReferral,
  addVisit,
  bootApp,
  byId,
  closeApp,
  createCustomer,
  createMember,
  createProduct,
  getDataRows,
  login,
  logout,
  openTab,
  setValue,
  submit,
  textOf,
  updateMemberPermissions,
} = require("./helpers/appHarness");

describe("Maintenance & Account Features", () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it("removes only selected datasets inside the chosen date range", () => {
    ctx = bootApp();

    login(ctx, "admin", "admin123");
    createMember(ctx, {
      fullName: "Nhân viên giới thiệu",
      username: "0900001111",
      password: "123456",
    });

    createCustomer(ctx, { name: "Khách dọn dữ liệu" });
    createProduct(ctx, { name: "Dịch vụ dọn dữ liệu", defaultPrice: 300000 });

    const dateValue = new Date().toISOString().slice(0, 10);
    addVisit(ctx, {
      customerName: "Khách dọn dữ liệu",
      productName: "Dịch vụ dọn dữ liệu",
      date: dateValue,
      revenue: 500000,
    });

    addReferral(ctx, {
      referrerUsername: "0900001111",
      referredCustomerName: "Khách dọn dữ liệu",
      productName: "Dịch vụ dọn dữ liệu",
      date: dateValue,
      revenue: 500000,
    });

    openTab(ctx, "maintenance");
    setValue(byId(ctx, "maintenance-from-date"), dateValue);
    setValue(byId(ctx, "maintenance-to-date"), dateValue);
    byId(ctx, "maintenance-scope-customers").checked = false;
    byId(ctx, "maintenance-scope-products").checked = false;
    byId(ctx, "maintenance-scope-visits").checked = true;
    byId(ctx, "maintenance-scope-referrals").checked = false;
    byId(ctx, "maintenance-scope-members").checked = false;
    submit(byId(ctx, "maintenance-form"));

    expect(textOf(byId(ctx, "maintenance-result"))).toContain("Đã xoá dữ liệu từ ngày");

    openTab(ctx, "visits");
    expect(getDataRows(ctx, "visit-table-body")).toHaveLength(0);

    openTab(ctx, "customers");
    expect(getDataRows(ctx, "customer-table-body")).toHaveLength(1);

    openTab(ctx, "referrals");
    expect(getDataRows(ctx, "referral-table-body")).toHaveLength(1);
  });

  it("allows member to change password when permission is granted", () => {
    ctx = bootApp();

    login(ctx, "admin", "admin123");
    createMember(ctx, {
      fullName: "Nhân viên đổi mật khẩu",
      username: "0900002222",
      password: "123456",
    });

    updateMemberPermissions(ctx, "0900002222", {
      customers: false,
      customerEdit: false,
      products: false,
      productsEdit: false,
      productsDelete: false,
      visits: false,
      visitsEdit: false,
      visitsDelete: false,
      referrals: false,
      referralsEdit: false,
      referralsDelete: false,
      dataCleanup: false,
      backupData: false,
      changePassword: true,
      reports: true,
    });

    logout(ctx);
    login(ctx, "0900002222", "123456");

    openTab(ctx, "account");
    setValue(byId(ctx, "current-password"), "123456");
    setValue(byId(ctx, "next-password"), "654321");
    setValue(byId(ctx, "confirm-next-password"), "654321");
    submit(byId(ctx, "change-password-form"));

    expect(textOf(byId(ctx, "change-password-result"))).toContain("Đã cập nhật mật khẩu mới thành công.");

    logout(ctx);
    login(ctx, "0900002222", "123456");
    expect(textOf(byId(ctx, "login-message"))).toContain("Sai tên đăng nhập hoặc mật khẩu.");

    login(ctx, "0900002222", "654321");
    expect(textOf(byId(ctx, "session-user"))).toContain("Nhân viên đổi mật khẩu");
  });
});
