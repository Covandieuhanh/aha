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
    expect(byId(ctx, 'session-user').textContent).toContain('Admin');
  });

  it('employee account can only access detailed report tab', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    const createMsg = createMember(ctx, {
      fullName: 'Nhân viên A',
      username: 'nva',
      password: '123456',
    });

    expect(createMsg).toContain('Đã tạo tài khoản');

    logout(ctx);
    login(ctx, 'nva', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(['reports']);
    expect(byId(ctx, 'session-user').textContent).toContain('Nhân viên');
  });

  it('admin can add or remove member permissions and save immediately', () => {
    ctx = bootApp();

    login(ctx, 'admin', 'admin123');
    createMember(ctx, {
      fullName: 'Nhân viên B',
      username: 'nvb',
      password: '123456',
    });

    const updateMessage = updateMemberPermissions(ctx, 'nvb', {
      customers: true,
      products: true,
      visits: false,
      referrals: true,
      reports: false,
    });

    expect(updateMessage).toContain('Đã cập nhật quyền cho nvb');

    logout(ctx);
    login(ctx, 'nvb', '123456');

    const visibleTabs = getVisibleTabIds(ctx);
    expect(visibleTabs).toEqual(['customers', 'products', 'referrals']);
  });
});
