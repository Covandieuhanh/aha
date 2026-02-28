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
      username: '0900003333',
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
      referrerUsername: '0900003333',
      referredCustomerName: 'Khách A',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    addReferral(ctx, {
      referrerUsername: '0900003333',
      referredCustomerName: 'Khách B',
      productName: 'Combo Chăm Sóc',
      date: dateValue,
      revenue: 1000000,
    });

    const referralRows = getRowTexts(ctx, 'referral-table-body');
    expect(referralRows.some((row) => row.includes('Lần 2') && row.includes('10%'))).toBe(true);
    expect(referralRows.some((row) => row.includes('Lần 1') && row.includes('5%'))).toBe(true);
  });

  it('creates voucher and referral commission together from one service transaction form', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    createCustomer(ctx, { name: 'Khách Gộp' });
    createProduct(ctx, { name: 'Gội đầu dưỡng sinh', code: 'DV02', defaultPrice: 350000 });
    createMember(ctx, {
      fullName: 'Nhân viên Gộp',
      username: '0900004444',
      password: '123456',
    });

    const monthValue = monthFromUi(ctx);
    const dateValue = dateInMonth(monthValue, 12);

    const message = addVisit(ctx, {
      customerName: 'Khách Gộp',
      productName: 'Gội đầu dưỡng sinh',
      date: dateValue,
      revenue: 500000,
      referrerUsername: '0900004444',
    });

    expect(message).toContain('Voucher tích điểm');
    expect(message).toContain('Hoa hồng giới thiệu');

    const visitRows = getRowTexts(ctx, 'visit-table-body').join(' | ');
    const referralRows = getRowTexts(ctx, 'referral-table-body').join(' | ');

    expect(visitRows).toContain('Khách Gộp');
    expect(referralRows).toContain('Khách Gộp');
    expect(referralRows).toContain('Nhân viên Gộp');
  });
});
