const {
  addReferral,
  addVisit,
  bootApp,
  closeApp,
  createCustomer,
  createMember,
  createProduct,
  deleteProduct,
  deleteReferral,
  deleteVisit,
  editProduct,
  editReferral,
  editVisit,
  getDataRows,
  login,
  logout,
  monthFromUi,
  openTab,
  updateMemberPermissions,
} = require("./helpers/appHarness");

describe("Edit/Delete Permissions", () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it("member can edit/delete product, voucher and referral only when granted matching permissions", () => {
    ctx = bootApp();

    login(ctx, "admin", "admin123");
    createMember(ctx, { fullName: "Nhân viên thao tác", username: "0900000005", password: "123456" });

    createCustomer(ctx, { name: "Khách C" });
    createProduct(ctx, { name: "Dịch vụ C", code: "DVC", defaultPrice: 500000 });

    const monthValue = monthFromUi(ctx);
    const dateValue = `${monthValue}-15`;

    addVisit(ctx, {
      customerName: "Khách C",
      productName: "Dịch vụ C",
      date: dateValue,
      revenue: 1000000,
    });

    addReferral(ctx, {
      referrerUsername: "0900000005",
      referredCustomerName: "Khách C",
      productName: "Dịch vụ C",
      date: dateValue,
      revenue: 1000000,
    });

    updateMemberPermissions(ctx, "0900000005", {
      products: true,
      productsEdit: false,
      productsDelete: false,
      visits: true,
      visitsEdit: false,
      visitsDelete: false,
      referrals: true,
      referralsEdit: false,
      referralsDelete: false,
      reports: false,
    });

    logout(ctx);
    login(ctx, "0900000005", "123456");

    openTab(ctx, "products");
    expect(getDataRows(ctx, "product-table-body")[0].querySelector(".edit-product-btn")).toBeNull();
    expect(getDataRows(ctx, "product-table-body")[0].querySelector(".delete-product-btn")).toBeNull();

    openTab(ctx, "visits");
    expect(getDataRows(ctx, "visit-table-body")[0].querySelector(".edit-visit-btn")).toBeNull();
    expect(getDataRows(ctx, "visit-table-body")[0].querySelector(".delete-visit-btn")).toBeNull();

    openTab(ctx, "referrals");
    expect(getDataRows(ctx, "referral-table-body")[0].querySelector(".edit-referral-btn")).toBeNull();
    expect(getDataRows(ctx, "referral-table-body")[0].querySelector(".delete-referral-btn")).toBeNull();

    logout(ctx);
    login(ctx, "admin", "admin123");

    updateMemberPermissions(ctx, "0900000005", {
      products: true,
      productsEdit: true,
      productsDelete: true,
      visits: true,
      visitsEdit: true,
      visitsDelete: true,
      referrals: true,
      referralsEdit: true,
      referralsDelete: true,
      reports: false,
    });

    logout(ctx);
    login(ctx, "0900000005", "123456");

    openTab(ctx, "products");
    expect(getDataRows(ctx, "product-table-body")[0].querySelector(".edit-product-btn")).not.toBeNull();
    expect(getDataRows(ctx, "product-table-body")[0].querySelector(".delete-product-btn")).not.toBeNull();

    const productEditMessage = editProduct(ctx, {
      currentName: "Dịch vụ C",
      nextName: "Dịch vụ C+",
      code: "DVC",
      defaultPrice: 600000,
    });
    expect(productEditMessage).toContain("Đã cập nhật sản phẩm/dịch vụ");

    const visitEditMessage = editVisit(ctx, {
      customerName: "Khách C",
      productName: "Dịch vụ C+",
      date: dateValue,
      revenue: 1200000,
    });
    expect(visitEditMessage).toContain("Đã cập nhật");

    const referralEditMessage = editReferral(ctx, {
      referrerUsername: "0900000005",
      referredCustomerName: "Khách C",
      productName: "Dịch vụ C+",
      date: dateValue,
      revenue: 1300000,
    });
    expect(referralEditMessage).toContain("Đã cập nhật");

    const deleteVisitMessage = deleteVisit(ctx, "Khách C");
    expect(deleteVisitMessage).toContain("Đã xoá giao dịch tích điểm voucher");

    const deleteReferralMessage = deleteReferral(ctx, "Khách C");
    expect(deleteReferralMessage).toContain("Đã xoá giao dịch hoa hồng giới thiệu");

    const deleteProductMessage = deleteProduct(ctx, "Dịch vụ C+");
    expect(deleteProductMessage).toContain("Đã xoá sản phẩm/dịch vụ");
  });
});
