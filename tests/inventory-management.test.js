const {
  addInventoryTransaction,
  bootApp,
  byId,
  click,
  closeApp,
  createMember,
  getDataRows,
  getVisibleTabIds,
  login,
  logout,
  normalizeText,
  openTab,
  setValue,
  textOf,
  updateMemberPermissions,
} = require('./helpers/appHarness');

describe('Quản lý kho', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('enforces warehouse/spa in-out permissions for member accounts', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên kho',
      username: '0900000211',
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
      inventory: true,
      inventoryWarehouseIn: true,
      inventoryWarehouseOut: false,
      inventorySpaIn: false,
      inventorySpaOut: false,
      finance: false,
      financeFund: false,
      dataCleanup: false,
      backupData: false,
      changePassword: false,
      reports: true,
      reportsAll: false,
    });

    logout(ctx);
    login(ctx, '0900000211', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(expect.arrayContaining(['inventory', 'reports']));

    const successMessage = addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'NHAP',
      itemName: 'GEL XANH',
      quantity: 5,
      note: 'Nhập đầu ngày',
    });
    expect(successMessage).toContain('Đã ghi nhận NHAP');

    const blockedWarehouseOut = addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'XUAT',
      itemName: 'GEL XANH',
      quantity: 1,
      note: 'Không được phép',
    });
    expect(blockedWarehouseOut).toContain('Bạn chưa được cấp quyền xuất kho');

    openTab(ctx, 'inventory');
    setValue(byId(ctx, 'inventory-area'), 'SPA');
    expect(byId(ctx, 'inventory-type').disabled).toBe(true);
    expect(byId(ctx, 'inventory-type').value).toBe('XUAT');

    const blockedSpaOut = addInventoryTransaction(ctx, {
      area: 'SPA',
      type: 'XUAT',
      itemName: 'GEL XANH',
      quantity: 1,
      note: 'Không được phép',
    });
    expect(blockedSpaOut).toContain('Bạn chưa được cấp quyền xuất spa');
  });

  it('aggregates stock separately for warehouse and spa', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'NHAP',
      itemName: 'GEL XANH',
      quantity: 10,
      note: 'Nhập kho tổng',
    });
    addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'XUAT',
      itemName: 'GEL XANH',
      quantity: 2,
      note: 'Chuyển cho spa',
      transferTargetArea: 'SPA',
    });

    openTab(ctx, 'inventory');

    const khoStockText = normalizeText(byId(ctx, 'inventory-stock-warehouse-body').textContent);
    const spaStockText = normalizeText(byId(ctx, 'inventory-stock-spa-body').textContent);

    expect(khoStockText).toContain('GEL XANH');
    expect(khoStockText).toContain('10');
    expect(khoStockText).toContain('2');
    expect(khoStockText).toContain('8');

    expect(spaStockText).toContain('GEL XANH');
    expect(spaStockText).toContain('2');

    const historyRows = getDataRows(ctx, 'inventory-table-body');
    expect(historyRows).toHaveLength(2);
    expect(normalizeText(byId(ctx, 'inventory-table-body').textContent)).toContain('Kho -> SPA');

    const summaryTextKho = textOf(byId(ctx, 'inventory-summary'));
    expect(summaryTextKho).toContain('Mặt hàng Kho');

    click(byId(ctx, 'inventory-view-spa-btn'));
    const spaHistoryRows = getDataRows(ctx, 'inventory-table-body');
    expect(spaHistoryRows).toHaveLength(1);
    const summaryTextSpa = textOf(byId(ctx, 'inventory-summary'));
    expect(summaryTextSpa).toContain('Mặt hàng Spa');
  });

  it('allows admin to edit inventory history and sync transfer pair data', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'NHAP',
      itemName: 'GEL XANH',
      quantity: 10,
      date: '2026-03-01',
      note: 'Nhập kho',
    });
    addInventoryTransaction(ctx, {
      area: 'KHO',
      type: 'XUAT',
      itemName: 'GEL XANH',
      quantity: 2,
      date: '2026-03-02',
      note: 'Chuyển spa',
      transferTargetArea: 'SPA',
    });

    openTab(ctx, 'inventory');

    const rowsBefore = getDataRows(ctx, 'inventory-table-body');
    expect(rowsBefore.length).toBeGreaterThan(0);
    const editBtn = rowsBefore[0].querySelector('.inventory-edit-btn');
    expect(editBtn).not.toBeNull();
    click(editBtn);

    setValue(byId(ctx, 'inventory-inline-edit-date'), '2026-03-04');
    setValue(byId(ctx, 'inventory-inline-edit-item-name'), 'GEL TIM');
    setValue(byId(ctx, 'inventory-inline-edit-quantity'), '3');
    setValue(byId(ctx, 'inventory-inline-edit-note'), 'Điều chỉnh xuất spa');
    click(ctx.document.querySelector('.inventory-inline-save-btn'));

    expect(textOf(byId(ctx, 'inventory-result'))).toContain('Đã cập nhật giao dịch kho/spa');

    const khoHistoryText = textOf(byId(ctx, 'inventory-table-body'));
    expect(khoHistoryText).toContain('04/03/2026');
    expect(khoHistoryText).toContain('GEL TIM');
    expect(khoHistoryText).toContain('3');
    expect(khoHistoryText).toContain('Điều chỉnh xuất spa');

    click(byId(ctx, 'inventory-view-spa-btn'));
    const spaHistoryText = textOf(byId(ctx, 'inventory-table-body'));
    expect(spaHistoryText).toContain('04/03/2026');
    expect(spaHistoryText).toContain('GEL TIM');
    expect(spaHistoryText).toContain('[Từ kho] Điều chỉnh xuất spa');

    const spaStockText = textOf(byId(ctx, 'inventory-stock-spa-body'));
    expect(spaStockText).toContain('GEL TIM');
    expect(spaStockText).toContain('3');
  });
});
