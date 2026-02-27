const {
  bootApp,
  closeApp,
  createCustomer,
  createMember,
  deleteCustomer,
  editCustomer,
  getDataRows,
  getRowTexts,
  login,
  logout,
  updateMemberPermissions,
} = require('./helpers/appHarness');

describe('Customer Management Permissions', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('member can edit customer only when customerEdit permission is enabled', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createCustomer(ctx, { name: 'Khách Sửa', phone: '0900000001' });
    createMember(ctx, { fullName: 'Nhân viên CS', username: '0900000003', password: '123456' });

    updateMemberPermissions(ctx, '0900000003', {
      customers: true,
      customerEdit: false,
      products: false,
      visits: false,
      referrals: false,
      reports: false,
    });

    logout(ctx);
    login(ctx, '0900000003', '123456');

    const rowsWithoutEdit = getDataRows(ctx, 'customer-table-body');
    expect(rowsWithoutEdit[0].querySelector('.edit-customer-btn')).toBeNull();

    logout(ctx);
    login(ctx, 'admin', 'admin123');

    updateMemberPermissions(ctx, '0900000003', {
      customers: true,
      customerEdit: true,
      products: false,
      visits: false,
      referrals: false,
      reports: false,
    });

    logout(ctx);
    login(ctx, '0900000003', '123456');

    const editMessage = editCustomer(ctx, {
      currentName: 'Khách Sửa',
      nextName: 'Khách Đã Sửa',
      phone: '0900000002',
      email: 'khach.sua@example.com',
      note: 'Đã cập nhật thông tin',
    });

    expect(editMessage).toContain('Đã cập nhật khách hàng');
    const customerRows = getRowTexts(ctx, 'customer-table-body').join(' | ');
    expect(customerRows).toContain('Khách Đã Sửa');
    expect(customerRows).toContain('0900000002');
  });

  it('only admin can delete customer', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createCustomer(ctx, { name: 'Khách Xóa' });
    createMember(ctx, { fullName: 'Nhân viên X', username: '0900000004', password: '123456' });

    updateMemberPermissions(ctx, '0900000004', {
      customers: true,
      customerEdit: true,
      products: false,
      visits: false,
      referrals: false,
      reports: false,
    });

    logout(ctx);
    login(ctx, '0900000004', '123456');

    const memberRows = getDataRows(ctx, 'customer-table-body');
    expect(memberRows[0].querySelector('.delete-customer-btn')).toBeNull();

    logout(ctx);
    login(ctx, 'admin', 'admin123');

    const deleteMessage = deleteCustomer(ctx, 'Khách Xóa');
    expect(deleteMessage).toContain('Đã xoá khách hàng Khách Xóa');

    expect(getDataRows(ctx, 'customer-table-body')).toHaveLength(0);
  });
});
