const {
  addReferral,
  addVisit,
  bootApp,
  closeApp,
  createCustomer,
  createMember,
  createProduct,
  dateInMonth,
  getDataRows,
  getRowTexts,
  login,
  logout,
  monthFromUi,
  textOf,
  updateMemberPermissions,
} = require('./helpers/appHarness');

describe('Employee Detailed Report', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('shows only the logged-in employee commission history', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    createMember(ctx, {
      fullName: 'Nhân viên 1',
      username: '0911111111',
      password: '123456',
    });

    createMember(ctx, {
      fullName: 'Nhân viên 2',
      username: '0911111112',
      password: '123456',
    });

    createCustomer(ctx, { name: 'Khách C1' });
    createCustomer(ctx, { name: 'Khách C2' });
    createProduct(ctx, { name: 'Liệu trình VIP', code: 'VIP01', defaultPrice: 1500000 });

    const monthValue = monthFromUi(ctx);
    const dateValue = dateInMonth(monthValue, 12);

    addReferral(ctx, {
      referrerUsername: '0911111111',
      referredCustomerName: 'Khách C1',
      productName: 'Liệu trình VIP',
      date: dateValue,
      revenue: 1000000,
    });

    addReferral(ctx, {
      referrerUsername: '0911111112',
      referredCustomerName: 'Khách C2',
      productName: 'Liệu trình VIP',
      date: dateValue,
      revenue: 1000000,
    });

    logout(ctx);
    login(ctx, '0911111111', '123456');

    const reportRows = getDataRows(ctx, 'report-table-body');
    const reportText = getRowTexts(ctx, 'report-table-body').join(' | ');

    expect(reportRows).toHaveLength(1);
    expect(reportText).toContain('(0911111111)');
    expect(reportText).not.toContain('(0911111112)');

    const summaryText = textOf(ctx.document.getElementById('report-summary'));
    expect(summaryText).toContain('Số giao dịch nhận hoa hồng');
  });

  it('allows report all permission to view the full detailed report', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    createMember(ctx, {
      fullName: 'Nhân viên Toàn Bộ',
      username: '0911111199',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0911111199', {
      reports: false,
      reportsAll: true,
      customers: false,
      products: false,
      visits: false,
      referrals: false,
    });

    createCustomer(ctx, { name: 'Khách R1' });
    createCustomer(ctx, { name: 'Khách R2' });
    createProduct(ctx, { name: 'Gói Tổng Hợp', code: 'TH01', defaultPrice: 800000 });

    const monthValue = monthFromUi(ctx);
    const dateValue = dateInMonth(monthValue, 15);

    addVisit(ctx, {
      customerName: 'Khách R1',
      productName: 'Gói Tổng Hợp',
      date: dateValue,
      revenue: 800000,
    });

    addReferral(ctx, {
      referrerUsername: '0911111199',
      referredCustomerName: 'Khách R1',
      productName: 'Gói Tổng Hợp',
      date: dateValue,
      revenue: 800000,
    });

    addReferral(ctx, {
      referrerUsername: '0911111199',
      referredCustomerName: 'Khách R2',
      productName: 'Gói Tổng Hợp',
      date: dateValue,
      revenue: 800000,
    });

    logout(ctx);
    login(ctx, '0911111199', '123456');

    const reportText = getRowTexts(ctx, 'report-table-body').join(' | ');
    const visitSummaryText = textOf(ctx.document.getElementById('report-visit-summary'));

    expect(reportText).toContain('Khách R1');
    expect(reportText).toContain('Khách R2');
    expect(visitSummaryText).toContain('Tổng voucher tích điểm');
  });
});
