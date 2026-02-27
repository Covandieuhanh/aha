const {
  bootApp,
  byId,
  closeApp,
  createMember,
  getVisibleTabIds,
  login,
  logout,
  updateMemberPermissions,
} = require('./helpers/appHarness');

describe('Auth & Permissions', () => {
  let ctx;

  afterEach(() => {
    closeApp(ctx);
    ctx = null;
  });

  it('admin sees all operational tabs', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(
      expect.arrayContaining(['customers', 'products', 'visits', 'referrals', 'reports', 'users']),
    );
    expect(byId(ctx, 'session-user').textContent).toContain('Quản trị viên');
  });

  it('employee account can only access detailed report tab', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    const createMsg = createMember(ctx, {
      fullName: 'Nhân viên A',
      username: '0900000001',
      password: '123456',
    });

    expect(createMsg).toContain('Đã tạo tài khoản');

    logout(ctx);
    login(ctx, '0900000001', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(['reports']);
    expect(byId(ctx, 'session-user').textContent).toContain('Nhân viên');
  });

  it('admin can add or remove member permissions and save immediately', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên B',
      username: '0900000002',
      password: '123456',
    });

    const updateMessage = updateMemberPermissions(ctx, '0900000002', {
      customers: true,
      products: true,
      visits: false,
      referrals: true,
      reports: false,
    });

    expect(updateMessage).toContain('Đã cập nhật quyền cho 0900000002');

    logout(ctx);
    login(ctx, '0900000002', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(['customers', 'products', 'referrals']);
  });
});
