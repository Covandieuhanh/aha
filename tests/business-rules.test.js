const {
  addReferral,
  addVisit,
  bootApp,
  closeApp,
  createCustomer,
  createMember,
  createProduct,
  dateInMonth,
  getRowTexts,
  login,
  monthFromUi,
} = require('./helpers/appHarness');

describe('Business Rules', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('applies voucher and referral commission tiers by monthly occurrence', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    createCustomer(ctx, { name: 'Khách A' });
    createCustomer(ctx, { name: 'Khách B' });
    createProduct(ctx, { name: 'Combo Chăm Sóc', code: 'DV01', defaultPrice: 500000 });
    createMember(ctx, {
      fullName: 'Nhân viên GT',
      username: 'nvgt',
      password: '123456',
    });

    const monthValue = monthFromUi(ctx);
    const dateValue = dateInMonth(monthValue, 10);

    addVisit(ctx, {
      customerName: 'Khách A',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    addVisit(ctx, {
      customerName: 'Khách A',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    const visitRows = getRowTexts(ctx, 'visit-table-body');
    expect(visitRows.some((row) => row.includes('Lần 2') && row.includes('10%'))).toBe(true);
    expect(visitRows.some((row) => row.includes('Lần 1') && row.includes('5%'))).toBe(true);

    addReferral(ctx, {
      referrerUsername: 'nvgt',
      referredCustomerName: 'Khách A',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    addReferral(ctx, {
      referrerUsername: 'nvgt',
      referredCustomerName: 'Khách B',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    const referralRows = getRowTexts(ctx, 'referral-table-body');
    expect(referralRows.some((row) => row.includes('Lần 2') && row.includes('10%'))).toBe(true);
    expect(referralRows.some((row) => row.includes('Lần 1') && row.includes('5%'))).toBe(true);
  });
});
