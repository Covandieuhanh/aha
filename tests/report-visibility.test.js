const {
  addReferral,
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
});
