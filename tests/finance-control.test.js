const {
  addFinanceTransaction,
  bootApp,
  byId,
  click,
  closeApp,
  createMember,
  getDataRows,
  getVisibleTabIds,
  login,
  logout,
  openTab,
  textOf,
  updateMemberPermissions,
} = require('./helpers/appHarness');

describe('Tài chính', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('enforces admin/member finance roles with append-only history', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên tài chính',
      username: '0900000099',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0900000099', {
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
      finance: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    const adminBlockedMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000099',
      amount: 1000000,
      note: 'Admin cap quy khi chua co ton',
    });
    expect(adminBlockedMessage).toContain('Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT');

    const adminTopupMessage = addFinanceTransaction(ctx, {
      type: 'NHAP',
      amount: 1000000,
      note: 'Admin nap quy he thong',
    });
    expect(adminTopupMessage).toContain('Đã ghi nhận NHẬP');

    const adminMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000099',
      amount: 1000000,
      note: 'Cấp quỹ tháng',
    });
    expect(adminMessage).toContain('Đã ghi nhận XUẤT');

    openTab(ctx, 'finance');
    expect(getDataRows(ctx, 'finance-table-body')).toHaveLength(1);

    logout(ctx);
    login(ctx, '0900000099', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(expect.arrayContaining(['finance', 'reports']));

    openTab(ctx, 'finance');
    expect(textOf(byId(ctx, 'finance-balance'))).toContain('1.000.000');
    expect(byId(ctx, 'finance-type').value).toBe('XUAT');
    expect(byId(ctx, 'finance-type').disabled).toBe(true);

    const memberMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      amount: 200000,
      note: 'Mua vật tư',
    });
    expect(memberMessage).toContain('Đã ghi nhận XUẤT');
    expect(byId(ctx, 'finance-admin-report-panel').classList.contains('hidden')).toBe(false);
    expect(textOf(byId(ctx, 'finance-report-title'))).toContain('Báo cáo cá nhân realtime');
    const reportSummaryText = textOf(byId(ctx, 'finance-report-summary'));
    expect(reportSummaryText).toContain('1.000.000');
    expect(reportSummaryText).toContain('200.000');
    expect(reportSummaryText).toContain('800.000');

    const overspendMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      amount: 900000,
      note: 'Vượt số dư',
    });
    expect(overspendMessage).toContain('Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT');

    expect(textOf(byId(ctx, 'finance-balance'))).toContain('800.000');
    expect(getDataRows(ctx, 'finance-table-body')).toHaveLength(1);
    expect(textOf(byId(ctx, 'finance-table-body'))).toContain('Mua vật tư');
    expect(byId(ctx, 'finance-table-body').querySelector('.edit-finance-btn')).toBeNull();
    expect(byId(ctx, 'finance-table-body').querySelector('.delete-finance-btn')).toBeNull();
  });

  it('allows delegated finance funding permission for non-admin accounts', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên nhận quỹ',
      username: '0900000111',
      password: '123456',
    });
    createMember(ctx, {
      fullName: 'Kế toán',
      username: '0900000112',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0900000111', {
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
      finance: true,
      financeFund: false,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });
    updateMemberPermissions(ctx, '0900000112', {
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
      finance: true,
      financeFund: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    logout(ctx);
    login(ctx, '0900000112', '123456');
    openTab(ctx, 'finance');

    expect(byId(ctx, 'finance-form').classList.contains('hidden')).toBe(false);
    expect(byId(ctx, 'finance-user').disabled).toBe(false);
    expect(byId(ctx, 'finance-open-expense-btn').classList.contains('hidden')).toBe(true);
    expect(byId(ctx, 'finance-admin-staff-panel').classList.contains('hidden')).toBe(true);

    const blockedFundingMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000111',
      amount: 250000,
      note: 'Ke toan cap tien vuot ton',
    });
    expect(blockedFundingMessage).toContain('Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT');

    logout(ctx);
    login(ctx, 'admin', 'admin123');
    addFinanceTransaction(ctx, {
      type: 'NHAP',
      amount: 300000,
      note: 'Admin nap quy cho ke toan',
    });
    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000112',
      amount: 300000,
      note: 'Cap quy cho ke toan',
    });

    logout(ctx);
    login(ctx, '0900000112', '123456');
    openTab(ctx, 'finance');
    const fundingMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000111',
      amount: 250000,
      note: 'Ke toan cap tien',
    });
    expect(fundingMessage).toContain('Đã ghi nhận XUẤT');

    const spendingMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      amount: 50000,
      note: 'Ke toan tu xuat',
    });
    expect(spendingMessage).toContain('Đã ghi nhận XUẤT');

    logout(ctx);
    login(ctx, '0900000111', '123456');
    openTab(ctx, 'finance');
    expect(textOf(byId(ctx, 'finance-balance'))).toContain('250.000');
  });

  it('keeps self selectable for delegated funding and shows correct transfer target in history', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Cường',
      username: '0900000211',
      password: '123456',
    });
    createMember(ctx, {
      fullName: 'Minh Pháp',
      username: '0900000212',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0900000211', {
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
      finance: true,
      financeFund: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });
    updateMemberPermissions(ctx, '0900000212', {
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
      finance: true,
      financeFund: false,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    addFinanceTransaction(ctx, {
      type: 'NHAP',
      amount: 600000,
      note: 'Admin nap quy cho Cuong',
    });
    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000211',
      amount: 600000,
      note: 'Cap quy cho Cuong',
    });

    logout(ctx);
    login(ctx, '0900000211', '123456');
    openTab(ctx, 'finance');

    const selfOutMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000211',
      amount: 100000,
      note: 'Cuong tu xuat',
    });
    expect(selfOutMessage).toContain('Đã ghi nhận XUẤT');

    const transferMessage = addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000212',
      amount: 250000,
      note: 'Cuong chuyen Minh Phap',
    });
    expect(transferMessage).toContain('Đã ghi nhận XUẤT');
    expect(transferMessage).toContain('0900000212');
    expect(transferMessage).not.toContain('sang Cường (0900000211)');

    const memberHistoryText = textOf(byId(ctx, 'finance-table-body'));
    expect(memberHistoryText).toContain('Cuong chuyen Minh Phap');
    expect(memberHistoryText).toContain('0900000212');
    expect(memberHistoryText).toContain('Tự xuất');

    logout(ctx);
    login(ctx, 'admin', 'admin123');
    openTab(ctx, 'finance');

    const staffRows = [...byId(ctx, 'finance-staff-body').querySelectorAll('tr')].filter(
      (row) => !row.querySelector('.empty-cell'),
    );
    const cuongRow = staffRows.find((row) => row.textContent.includes('0900000211'));
    const minhPhapRow = staffRows.find((row) => row.textContent.includes('0900000212'));
    expect(cuongRow).toBeTruthy();
    expect(minhPhapRow).toBeTruthy();

    click(cuongRow);
    const cuongHistoryText = textOf(byId(ctx, 'finance-table-body'));
    expect(cuongHistoryText).toContain('Cuong chuyen Minh Phap');
    expect(cuongHistoryText).toContain('0900000212');

    click(minhPhapRow);
    const minhHistoryText = textOf(byId(ctx, 'finance-table-body'));
    expect(minhHistoryText).toContain('Cuong chuyen Minh Phap');
    expect(minhHistoryText).toContain('0900000211');
  });

  it('allows admin to view each employee history from finance staff list', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên A',
      username: '0900000101',
      password: '123456',
    });
    createMember(ctx, {
      fullName: 'Nhân viên B',
      username: '0900000102',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0900000101', {
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
      finance: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });
    updateMemberPermissions(ctx, '0900000102', {
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
      finance: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    addFinanceTransaction(ctx, {
      type: 'NHAP',
      amount: 1100000,
      note: 'Admin nap quy cho nhan vien A B',
    });
    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000101',
      amount: 400000,
      note: 'Cap quy A',
    });
    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000102',
      amount: 700000,
      note: 'Cap quy B',
    });

    openTab(ctx, 'finance');
    const staffRows = [...byId(ctx, 'finance-staff-body').querySelectorAll('tr')].filter(
      (row) => !row.querySelector('.empty-cell'),
    );
    const rowA = staffRows.find((row) => row.textContent.includes('0900000101'));
    const rowB = staffRows.find((row) => row.textContent.includes('0900000102'));
    expect(rowA).toBeTruthy();
    expect(rowB).toBeTruthy();

    click(rowB);
    expect(textOf(byId(ctx, 'finance-history-title'))).toContain('0900000102');
    expect(textOf(byId(ctx, 'finance-table-body'))).toContain('Cap quy B');
    expect(textOf(byId(ctx, 'finance-table-body'))).not.toContain('Cap quy A');

    const refreshedRowA = [...byId(ctx, 'finance-staff-body').querySelectorAll('tr')].find((row) =>
      row.textContent.includes('0900000101'),
    );
    const viewHistoryButton = refreshedRowA && refreshedRowA.querySelector('.finance-view-history-btn');
    expect(viewHistoryButton).toBeTruthy();
    click(viewHistoryButton);
    expect(textOf(byId(ctx, 'finance-history-title'))).toContain('0900000101');
    expect(textOf(byId(ctx, 'finance-table-body'))).toContain('Cap quy A');
    expect(textOf(byId(ctx, 'finance-table-body'))).not.toContain('Cap quy B');
  });

  it('supports optional transaction date and keeps realtime default when left empty', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên C',
      username: '0900000103',
      password: '123456',
    });

    updateMemberPermissions(ctx, '0900000103', {
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
      finance: true,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    addFinanceTransaction(ctx, {
      type: 'NHAP',
      amount: 400000,
      note: 'Admin nap quy bo sung',
    });
    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000103',
      amount: 300000,
      note: 'Nhap bo sung qua khu',
      transactionDate: '2024-01-15',
    });

    addFinanceTransaction(ctx, {
      type: 'XUAT',
      targetUsername: '0900000103',
      amount: 100000,
      note: 'Nhap realtime',
    });

    openTab(ctx, 'finance');
    const historyText = textOf(byId(ctx, 'finance-table-body'));
    expect(historyText).toContain('Nhap bo sung qua khu');
    expect(historyText).toContain('Nhap realtime');
    expect(historyText).toContain('2024');
    expect(historyText).toContain(String(new Date().getFullYear()));
  });
});
