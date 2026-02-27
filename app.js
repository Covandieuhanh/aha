const STORAGE_KEY = "aha-crm-v1";
const SESSION_KEY = "aha-crm-session-v1";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const AUTO_SYNC_INTERVAL_MS = 30000;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function shouldUseRemoteMode() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "server") return true;
  if (mode === "local") return false;

  if (typeof window.__AHA_FORCE_REMOTE__ === "boolean") {
    return window.__AHA_FORCE_REMOTE__;
  }

  if (!window.location.protocol.startsWith("http")) return false;
  return !LOOPBACK_HOSTS.has(window.location.hostname.toLowerCase());
}

const runtime = {
  remoteMode: shouldUseRemoteMode(),
  apiBase:
    typeof window !== "undefined" && window.__AHA_API_BASE__
      ? String(window.__AHA_API_BASE__).replace(/\/+$/, "")
      : "/api",
  syncTimer: null,
};

const TAB_FEATURE_MAP = {
  customers: "customers",
  products: "products",
  visits: "visits",
  referrals: "referrals",
  reports: "reports",
  maintenance: "dataCleanup",
  account: "changePassword",
  users: "manageUsers",
};

const MEMBER_PERMISSION_KEYS = [
  "customers",
  "customerEdit",
  "products",
  "productsEdit",
  "productsDelete",
  "visits",
  "visitsEdit",
  "visitsDelete",
  "referrals",
  "referralsEdit",
  "referralsDelete",
  "dataCleanup",
  "backupData",
  "changePassword",
  "reports",
];

const state = {
  customers: [],
  products: [],
  visits: [],
  referrals: [],
  users: [],
  currentUserId: null,
  editingCustomerId: null,
  editingProductId: null,
  editingVisitId: null,
  editingReferralId: null,
  activeTab: "",
};

const refs = {
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  loginForm: document.getElementById("login-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginMessage: document.getElementById("login-message"),
  runtimeMode: document.getElementById("runtime-mode"),
  sessionUser: document.getElementById("session-user"),
  logoutBtn: document.getElementById("logout-btn"),
  noPermission: document.getElementById("no-permission"),

  tabs: document.querySelectorAll(".tab-btn"),
  panels: document.querySelectorAll(".tab-panel"),

  customerForm: document.getElementById("customer-form"),
  customerName: document.getElementById("customer-name"),
  customerPhone: document.getElementById("customer-phone"),
  customerEmail: document.getElementById("customer-email"),
  customerNote: document.getElementById("customer-note"),
  customerSearch: document.getElementById("customer-search"),
  customerSubmitBtn: document.getElementById("customer-submit-btn"),
  customerCancelBtn: document.getElementById("customer-cancel-btn"),
  customerFormResult: document.getElementById("customer-form-result"),
  customerTableBody: document.getElementById("customer-table-body"),
  customerImportFile: document.getElementById("customer-import-file"),
  importCustomersBtn: document.getElementById("import-customers-btn"),
  exportCustomersBtn: document.getElementById("export-customers-btn"),
  downloadCustomerTemplateBtn: document.getElementById("download-customer-template-btn"),
  customerImportResult: document.getElementById("customer-import-result"),

  productForm: document.getElementById("product-form"),
  productName: document.getElementById("product-name"),
  productCode: document.getElementById("product-code"),
  productDefaultPrice: document.getElementById("product-default-price"),
  productNote: document.getElementById("product-note"),
  productSubmitBtn: document.getElementById("product-submit-btn"),
  productCancelBtn: document.getElementById("product-cancel-btn"),
  productFormResult: document.getElementById("product-form-result"),
  productTableBody: document.getElementById("product-table-body"),

  visitForm: document.getElementById("visit-form"),
  visitCustomer: document.getElementById("visit-customer"),
  visitCustomerOptions: document.getElementById("visit-customer-options"),
  visitProduct: document.getElementById("visit-product"),
  visitProductOptions: document.getElementById("visit-product-options"),
  visitDate: document.getElementById("visit-date"),
  visitRevenue: document.getElementById("visit-revenue"),
  visitSubmitBtn: document.getElementById("visit-submit-btn"),
  visitCancelBtn: document.getElementById("visit-cancel-btn"),
  visitResult: document.getElementById("visit-result"),
  visitTableBody: document.getElementById("visit-table-body"),
  visitMonthFilter: document.getElementById("visit-month-filter"),
  visitSearch: document.getElementById("visit-search"),
  visitSummary: document.getElementById("visit-summary"),

  referralForm: document.getElementById("referral-form"),
  referrerUser: document.getElementById("referrer-user"),
  referrerUserOptions: document.getElementById("referrer-user-options"),
  referredCustomer: document.getElementById("referred-customer"),
  referredCustomerOptions: document.getElementById("referred-customer-options"),
  referralProduct: document.getElementById("referral-product"),
  referralProductOptions: document.getElementById("referral-product-options"),
  referralDate: document.getElementById("referral-date"),
  referralRevenue: document.getElementById("referral-revenue"),
  referralSubmitBtn: document.getElementById("referral-submit-btn"),
  referralCancelBtn: document.getElementById("referral-cancel-btn"),
  referralResult: document.getElementById("referral-result"),
  referralTableBody: document.getElementById("referral-table-body"),
  referralMonthFilter: document.getElementById("referral-month-filter"),
  referralSearch: document.getElementById("referral-search"),
  referralSummary: document.getElementById("referral-summary"),

  reportMonthFilter: document.getElementById("report-month-filter"),
  reportSummary: document.getElementById("report-summary"),
  reportTableBody: document.getElementById("report-table-body"),

  maintenanceForm: document.getElementById("maintenance-form"),
  maintenanceFromDate: document.getElementById("maintenance-from-date"),
  maintenanceToDate: document.getElementById("maintenance-to-date"),
  maintenanceScopeCustomers: document.getElementById("maintenance-scope-customers"),
  maintenanceScopeProducts: document.getElementById("maintenance-scope-products"),
  maintenanceScopeVisits: document.getElementById("maintenance-scope-visits"),
  maintenanceScopeReferrals: document.getElementById("maintenance-scope-referrals"),
  maintenanceScopeMembers: document.getElementById("maintenance-scope-members"),
  maintenanceResult: document.getElementById("maintenance-result"),
  backupNowBtn: document.getElementById("backup-now-btn"),
  backupStatus: document.getElementById("backup-status"),

  changePasswordForm: document.getElementById("change-password-form"),
  currentPassword: document.getElementById("current-password"),
  nextPassword: document.getElementById("next-password"),
  confirmNextPassword: document.getElementById("confirm-next-password"),
  changePasswordResult: document.getElementById("change-password-result"),

  memberForm: document.getElementById("member-form"),
  memberFullName: document.getElementById("member-full-name"),
  memberUsername: document.getElementById("member-username"),
  memberPassword: document.getElementById("member-password"),
  permCustomers: document.getElementById("perm-customers"),
  permCustomerEdit: document.getElementById("perm-customer-edit"),
  permProducts: document.getElementById("perm-products"),
  permProductsEdit: document.getElementById("perm-products-edit"),
  permProductsDelete: document.getElementById("perm-products-delete"),
  permVisits: document.getElementById("perm-visits"),
  permVisitsEdit: document.getElementById("perm-visits-edit"),
  permVisitsDelete: document.getElementById("perm-visits-delete"),
  permReferrals: document.getElementById("perm-referrals"),
  permReferralsEdit: document.getElementById("perm-referrals-edit"),
  permReferralsDelete: document.getElementById("perm-referrals-delete"),
  permDataCleanup: document.getElementById("perm-data-cleanup"),
  permBackupData: document.getElementById("perm-backup-data"),
  permChangePassword: document.getElementById("perm-change-password"),
  permReports: document.getElementById("perm-reports"),
  memberFormResult: document.getElementById("member-form-result"),
  userTableBody: document.getElementById("user-table-body"),
  modalOverlay: document.getElementById("modal-overlay"),
  modalMessage: document.getElementById("modal-message"),
  modalOkBtn: document.getElementById("modal-ok-btn"),
  historyOverlay: document.getElementById("history-overlay"),
  historyTitle: document.getElementById("history-title"),
  historyContent: document.getElementById("history-content"),
  historyCloseBtn: document.getElementById("history-close-btn"),
};

async function initialize() {
  renderRuntimeMode();
  setDefaultDates();
  setDefaultMemberPermissionInputs();
  setCustomerFormMode(false);
  setProductFormMode(false);
  setVisitFormMode(false);
  setReferralFormMode(false);
  bindEvents();

  if (runtime.remoteMode) {
    await restoreRemoteSession();
    renderAuthState();
    return;
  }

  loadState();
  ensureAdminAccount();
  normalizeAllRecords();
  saveState();
  restoreSession();
  renderAuthState();
}

function bindEvents() {
  refs.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      if (!canAccessTab(tabId)) return;
      setActiveTab(tabId);
    });
  });

  refs.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleLogin();
  });

  refs.logoutBtn.addEventListener("click", () => {
    handleLogout();
  });

  refs.customerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCustomer();
  });
  refs.customerCancelBtn.addEventListener("click", handleCancelCustomerEdit);
  if (refs.customerSearch) {
    refs.customerSearch.addEventListener("input", renderCustomers);
  }
  refs.customerTableBody.addEventListener("click", handleCustomerTableClick);
  refs.downloadCustomerTemplateBtn.addEventListener("click", downloadCustomerTemplate);
  refs.exportCustomersBtn.addEventListener("click", exportCustomersCsv);
  refs.importCustomersBtn.addEventListener("click", () => {
    void importCustomersFromFile();
  });

  refs.productForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addProduct();
  });
  refs.productCancelBtn.addEventListener("click", handleCancelProductEdit);
  refs.productTableBody.addEventListener("click", handleProductTableClick);

  refs.visitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addVisit();
  });
  refs.visitCancelBtn.addEventListener("click", handleCancelVisitEdit);
  refs.visitTableBody.addEventListener("click", handleVisitTableClick);

  refs.referralForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addReferral();
  });
  refs.referralCancelBtn.addEventListener("click", handleCancelReferralEdit);
  refs.referralTableBody.addEventListener("click", handleReferralTableClick);

  refs.visitMonthFilter.addEventListener("change", renderVisits);
  if (refs.visitSearch) {
    refs.visitSearch.addEventListener("input", renderVisits);
  }
  refs.referralMonthFilter.addEventListener("change", renderReferrals);
  if (refs.referralSearch) {
    refs.referralSearch.addEventListener("input", renderReferrals);
  }
  refs.reportMonthFilter.addEventListener("change", renderReport);
  refs.maintenanceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    purgeDataByDateRange();
  });
  refs.backupNowBtn.addEventListener("click", () => {
    void triggerBackupNow();
  });
  refs.changePasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    changePassword();
  });

  refs.memberForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addMemberAccount();
  });

  refs.userTableBody.addEventListener("click", handleUserTableClick);

  if (refs.modalOkBtn) {
    refs.modalOkBtn.addEventListener("click", hideModal);
  }
  if (refs.historyCloseBtn) {
    refs.historyCloseBtn.addEventListener("click", hideHistoryModal);
  }

  bindNumericFormatter(refs.productDefaultPrice);
  bindNumericFormatter(refs.visitRevenue);
  bindNumericFormatter(refs.referralRevenue);
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  refs.visitDate.value = today;
  refs.referralDate.value = today;
  refs.maintenanceFromDate.value = `${thisMonth}-01`;
  refs.maintenanceToDate.value = today;
  refs.visitMonthFilter.value = thisMonth;
  refs.referralMonthFilter.value = thisMonth;
  refs.reportMonthFilter.value = thisMonth;
}

function setDefaultMemberPermissionInputs() {
  refs.permCustomers.checked = false;
  refs.permCustomerEdit.checked = false;
  refs.permProducts.checked = false;
  refs.permProductsEdit.checked = false;
  refs.permProductsDelete.checked = false;
  refs.permVisits.checked = false;
  refs.permVisitsEdit.checked = false;
  refs.permVisitsDelete.checked = false;
  refs.permReferrals.checked = false;
  refs.permReferralsEdit.checked = false;
  refs.permReferralsDelete.checked = false;
  refs.permDataCleanup.checked = false;
  refs.permBackupData.checked = false;
  refs.permChangePassword.checked = false;
  refs.permReports.checked = true;
}

function renderRuntimeMode() {
  if (!refs.runtimeMode) return;

  refs.runtimeMode.textContent = runtime.remoteMode ? "Chế độ: Máy chủ dùng chung" : "Chế độ: Một máy cục bộ";
}

function loadState() {
  if (runtime.remoteMode) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    state.customers = Array.isArray(parsed.customers) ? parsed.customers : [];
    state.products = Array.isArray(parsed.products) ? parsed.products : [];
    state.visits = Array.isArray(parsed.visits) ? parsed.visits : [];
    state.referrals = Array.isArray(parsed.referrals) ? parsed.referrals : [];
    state.users = Array.isArray(parsed.users) ? parsed.users.map(normalizeUser) : [];
  } catch (error) {
    console.warn("Không đọc được dữ liệu cũ:", error);
  }
}

function saveState() {
  if (runtime.remoteMode) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      customers: state.customers,
      products: state.products,
      visits: state.visits,
      referrals: state.referrals,
      users: state.users,
    }),
  );
}

function restoreSession() {
  if (runtime.remoteMode) return;

  const sessionUserId = localStorage.getItem(SESSION_KEY);
  if (sessionUserId && state.users.some((item) => item.id === sessionUserId)) {
    state.currentUserId = sessionUserId;
    return;
  }

  state.currentUserId = null;
}

function saveSession(userId) {
  if (runtime.remoteMode) return;

  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
}

function getDefaultMemberPermissions() {
  return {
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
    dataCleanup: false,
    backupData: false,
    changePassword: false,
    reports: true,
  };
}

function buildMemberPermissions(rawPermissions) {
  const defaults = getDefaultMemberPermissions();
  const source = rawPermissions && typeof rawPermissions === "object" ? rawPermissions : {};

  return {
    customers: Boolean(source.customers ?? defaults.customers),
    customerEdit: Boolean(source.customerEdit ?? defaults.customerEdit),
    products: Boolean(source.products ?? defaults.products),
    productsEdit: Boolean(source.productsEdit ?? defaults.productsEdit),
    productsDelete: Boolean(source.productsDelete ?? defaults.productsDelete),
    visits: Boolean(source.visits ?? defaults.visits),
    visitsEdit: Boolean(source.visitsEdit ?? defaults.visitsEdit),
    visitsDelete: Boolean(source.visitsDelete ?? defaults.visitsDelete),
    referrals: Boolean(source.referrals ?? defaults.referrals),
    referralsEdit: Boolean(source.referralsEdit ?? defaults.referralsEdit),
    referralsDelete: Boolean(source.referralsDelete ?? defaults.referralsDelete),
    dataCleanup: Boolean(source.dataCleanup ?? defaults.dataCleanup),
    backupData: Boolean(source.backupData ?? defaults.backupData),
    changePassword: Boolean(source.changePassword ?? defaults.changePassword),
    reports: Boolean(source.reports ?? defaults.reports),
  };
}

function normalizeUser(user) {
  const role = user && user.role === "admin" ? "admin" : "member";
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  const fullName = typeof user?.fullName === "string" ? user.fullName.trim() : "";
  const fallbackName = role === "admin" ? "Quản trị Aha" : "Thành viên";

  return {
    id: typeof user?.id === "string" && user.id ? user.id : createId("user"),
    username,
    password:
      typeof user?.password === "string"
        ? user.password
        : role === "admin" && !runtime.remoteMode
          ? DEFAULT_ADMIN_PASSWORD
          : "",
    fullName: fullName || fallbackName,
    role,
    locked: Boolean(user?.locked) && role !== "admin",
    permissions:
      role === "admin"
        ? {
            customers: true,
            customerEdit: true,
            products: true,
            productsEdit: true,
            productsDelete: true,
            visits: true,
            visitsEdit: true,
            visitsDelete: true,
            referrals: true,
            referralsEdit: true,
            referralsDelete: true,
            dataCleanup: true,
            backupData: true,
            changePassword: true,
            reports: true,
          }
        : buildMemberPermissions(user?.permissions),
    createdAt: typeof user?.createdAt === "string" ? user.createdAt : new Date().toISOString(),
  };
}

function ensureAdminAccount() {
  if (runtime.remoteMode) return;

  state.users = state.users.map(normalizeUser);

  const hasAdmin = state.users.some((item) => item.role === "admin");
  if (!hasAdmin) {
    state.users.unshift({
      id: "user-admin-default",
      username: DEFAULT_ADMIN_USERNAME,
      password: DEFAULT_ADMIN_PASSWORD,
      fullName: "Quản trị Aha",
      role: "admin",
      permissions: {
        customers: true,
        customerEdit: true,
        products: true,
        productsEdit: true,
        productsDelete: true,
        visits: true,
        visitsEdit: true,
        visitsDelete: true,
        referrals: true,
        referralsEdit: true,
        referralsDelete: true,
        dataCleanup: true,
        backupData: true,
        changePassword: true,
        reports: true,
      },
      createdAt: new Date().toISOString(),
    });
  }

  state.users = state.users.map((user) => {
    if (user.role !== "admin") return user;

    return {
      ...user,
      permissions: {
        customers: true,
        customerEdit: true,
        products: true,
        productsEdit: true,
        productsDelete: true,
        visits: true,
        visitsEdit: true,
        visitsDelete: true,
        referrals: true,
        referralsEdit: true,
        referralsDelete: true,
        dataCleanup: true,
        backupData: true,
        changePassword: true,
        reports: true,
      },
      password: user.password || DEFAULT_ADMIN_PASSWORD,
      username: user.username || DEFAULT_ADMIN_USERNAME,
    };
  });
}

function clearState() {
  state.customers = [];
  state.products = [];
  state.visits = [];
  state.referrals = [];
  state.users = [];
  state.currentUserId = null;
  state.editingCustomerId = null;
  state.editingProductId = null;
  state.editingVisitId = null;
  state.editingReferralId = null;
}

function normalizeStateCollections() {
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.products = Array.isArray(state.products) ? state.products : [];
  state.visits = Array.isArray(state.visits) ? state.visits : [];
  state.referrals = Array.isArray(state.referrals) ? state.referrals : [];
  state.users = Array.isArray(state.users) ? state.users.map(normalizeUser) : [];
  normalizeAllRecords();
}

function applyBootstrap(payload) {
  state.customers = Array.isArray(payload?.customers) ? payload.customers : [];
  state.products = Array.isArray(payload?.products) ? payload.products : [];
  state.visits = Array.isArray(payload?.visits) ? payload.visits : [];
  state.referrals = Array.isArray(payload?.referrals) ? payload.referrals : [];
  state.users = Array.isArray(payload?.users) ? payload.users.map(normalizeUser) : [];
  state.currentUserId = typeof payload?.currentUser?.id === "string" ? payload.currentUser.id : null;

  normalizeStateCollections();
}

function buildApiError(response, payload, fallback) {
  const error = new Error(payload?.message || fallback || "Có lỗi khi kết nối máy chủ.");
  error.status = response.status;
  return error;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${runtime.apiBase}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw buildApiError(response, payload, "Máy chủ phản hồi lỗi.");
  }

  return payload || {};
}

function handleRemoteActionError(error, outputElement, fallbackMessage) {
  if (error?.status === 401) {
    clearState();
    state.activeTab = "";
    stopRemoteAutoSync();
    refs.loginMessage.textContent = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    renderAuthState();
    return;
  }

  if (outputElement) {
    outputElement.textContent = error?.message || fallbackMessage;
  }
}

function dayOf(dateValue) {
  if (typeof dateValue !== "string" || dateValue.length < 10) return "";
  return dateValue.slice(0, 10);
}

function isValidDay(dayValue) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayValue);
}

function isDayInRange(dayValue, fromDate, toDate) {
  if (!isValidDay(dayValue)) return false;
  return dayValue >= fromDate && dayValue <= toDate;
}

function readMaintenanceRequest() {
  const fromDate = refs.maintenanceFromDate.value;
  const toDate = refs.maintenanceToDate.value;

  if (!isValidDay(fromDate) || !isValidDay(toDate)) {
    refs.maintenanceResult.textContent = "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc hợp lệ.";
    return null;
  }

  if (fromDate > toDate) {
    refs.maintenanceResult.textContent = "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.";
    return null;
  }

  const scopes = {
    customers: Boolean(refs.maintenanceScopeCustomers.checked),
    products: Boolean(refs.maintenanceScopeProducts.checked),
    visits: Boolean(refs.maintenanceScopeVisits.checked),
    referrals: Boolean(refs.maintenanceScopeReferrals.checked),
    members: Boolean(refs.maintenanceScopeMembers.checked),
  };

  if (!Object.values(scopes).some(Boolean)) {
    refs.maintenanceResult.textContent = "Vui lòng chọn ít nhất một nhóm dữ liệu để xoá.";
    return null;
  }

  return { fromDate, toDate, scopes };
}

function buildCleanupSummaryText(summary) {
  return `Đã xoá dữ liệu từ ngày ${summary.fromDate} đến ngày ${summary.toDate}: ${summary.removedCustomers} khách hàng, ${summary.removedProducts} sản phẩm và dịch vụ, ${summary.removedVisits} giao dịch tích điểm voucher, ${summary.removedReferrals} giao dịch hoa hồng giới thiệu, ${summary.removedMembers} tài khoản thành viên.`;
}

function purgeDataByDateRange() {
  if (!ensureFeature("dataCleanup", refs.maintenanceResult)) return;

  const request = readMaintenanceRequest();
  if (!request) return;

  const accepted = confirmAction(
    `Bạn có chắc chắn muốn xoá dữ liệu từ ngày ${request.fromDate} đến ngày ${request.toDate} không?`,
  );
  if (!accepted) return;

  if (runtime.remoteMode) {
    void purgeDataByDateRangeRemote(request);
    return;
  }

  const summary = {
    fromDate: request.fromDate,
    toDate: request.toDate,
    removedCustomers: 0,
    removedProducts: 0,
    removedVisits: 0,
    removedReferrals: 0,
    removedMembers: 0,
  };

  if (request.scopes.members) {
    const removableMemberIds = state.users
      .filter(
        (item) =>
          item.role === "member" &&
          item.id !== state.currentUserId &&
          isDayInRange(dayOf(item.createdAt), request.fromDate, request.toDate),
      )
      .map((item) => item.id);

    if (removableMemberIds.length > 0) {
      const memberIdSet = new Set(removableMemberIds);
      summary.removedMembers = removableMemberIds.length;
      state.users = state.users.filter((item) => !memberIdSet.has(item.id));
      const beforeReferrals = state.referrals.length;
      state.referrals = state.referrals.filter((item) => !memberIdSet.has(item.referrerId));
      summary.removedReferrals += beforeReferrals - state.referrals.length;
    }
  }

  if (request.scopes.customers) {
    const removableCustomerIds = state.customers
      .filter((item) => isDayInRange(dayOf(item.createdAt), request.fromDate, request.toDate))
      .map((item) => item.id);

    if (removableCustomerIds.length > 0) {
      const customerIdSet = new Set(removableCustomerIds);
      summary.removedCustomers = removableCustomerIds.length;
      state.customers = state.customers.filter((item) => !customerIdSet.has(item.id));

      const beforeVisits = state.visits.length;
      const beforeReferrals = state.referrals.length;
      state.visits = state.visits.filter((item) => !customerIdSet.has(item.customerId));
      state.referrals = state.referrals.filter((item) => !customerIdSet.has(item.referredCustomerId));
      summary.removedVisits += beforeVisits - state.visits.length;
      summary.removedReferrals += beforeReferrals - state.referrals.length;
    }
  }

  if (request.scopes.products) {
    const removableProductIds = state.products
      .filter((item) => isDayInRange(dayOf(item.createdAt), request.fromDate, request.toDate))
      .map((item) => item.id);

    if (removableProductIds.length > 0) {
      const productIdSet = new Set(removableProductIds);
      summary.removedProducts = removableProductIds.length;
      state.products = state.products.filter((item) => !productIdSet.has(item.id));

      const beforeVisits = state.visits.length;
      const beforeReferrals = state.referrals.length;
      state.visits = state.visits.filter((item) => !productIdSet.has(item.productId));
      state.referrals = state.referrals.filter((item) => !productIdSet.has(item.productId));
      summary.removedVisits += beforeVisits - state.visits.length;
      summary.removedReferrals += beforeReferrals - state.referrals.length;
    }
  }

  if (request.scopes.visits) {
    const beforeVisits = state.visits.length;
    state.visits = state.visits.filter((item) => !isDayInRange(dayOf(item.date), request.fromDate, request.toDate));
    summary.removedVisits += beforeVisits - state.visits.length;
  }

  if (request.scopes.referrals) {
    const beforeReferrals = state.referrals.length;
    state.referrals = state.referrals.filter(
      (item) => !isDayInRange(dayOf(item.date), request.fromDate, request.toDate),
    );
    summary.removedReferrals += beforeReferrals - state.referrals.length;
  }

  normalizeAllRecords();
  saveState();
  refs.maintenanceResult.textContent = buildCleanupSummaryText(summary);
  renderAll();
}

async function purgeDataByDateRangeRemote(request) {
  try {
    const payload = await apiRequest("/data-cleanup/range", {
      method: "POST",
      body: request,
    });

    if (payload?.remaining) {
      await syncFromServer({ preserveTab: true, silent: true });
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    if (payload?.summary) {
      refs.maintenanceResult.textContent = buildCleanupSummaryText(payload.summary);
    } else {
      refs.maintenanceResult.textContent = "Đã hoàn thành xoá dữ liệu theo khoảng thời gian đã chọn.";
    }
  } catch (error) {
    handleRemoteActionError(error, refs.maintenanceResult, "Không thể xoá dữ liệu theo khoảng thời gian.");
  }
}

async function refreshBackupStatus() {
  if (!refs.backupStatus) return;

  if (!hasFeaturePermission(getCurrentUser(), "backupData")) {
    refs.backupStatus.textContent = "Bạn chưa có quyền xem trạng thái sao lưu dữ liệu.";
    return;
  }

  if (!runtime.remoteMode) {
    refs.backupStatus.textContent = "Chế độ cục bộ không có sao lưu tự động lên kho mã nguồn từ xa.";
    return;
  }

  try {
    const payload = await apiRequest("/backup/status");
    const status = payload?.status || {};

    if (!status.enabled) {
      refs.backupStatus.textContent = "Sao lưu tự động chưa được bật trên máy chủ.";
      return;
    }

    const latestSuccess = status.lastSuccessAt
      ? new Date(status.lastSuccessAt).toLocaleString("vi-VN")
      : "Chưa có lần sao lưu thành công";
    const latestError = status.lastError ? `Lỗi gần nhất: ${status.lastError}` : "Không có lỗi gần nhất";
    refs.backupStatus.textContent = `Trạng thái sao lưu: ${status.running ? "Đang chạy" : "Sẵn sàng"}. Lần sao lưu thành công gần nhất: ${latestSuccess}. ${latestError}.`;
  } catch (error) {
    handleRemoteActionError(error, refs.backupStatus, "Không thể đọc trạng thái sao lưu dữ liệu.");
  }
}

async function triggerBackupNow() {
  if (!ensureFeature("backupData", refs.backupStatus)) return;

  if (!runtime.remoteMode) {
    refs.backupStatus.textContent = "Chế độ cục bộ không hỗ trợ sao lưu tự động lên kho mã nguồn từ xa.";
    return;
  }

  try {
    await apiRequest("/backup/run", { method: "POST" });
    refs.backupStatus.textContent = "Đã gửi yêu cầu sao lưu dữ liệu. Hệ thống sẽ xử lý trong nền.";
    await refreshBackupStatus();
  } catch (error) {
    handleRemoteActionError(error, refs.backupStatus, "Không thể yêu cầu sao lưu dữ liệu ngay.");
  }
}

function changePassword() {
  if (!ensureFeature("changePassword", refs.changePasswordResult)) return;

  const currentPassword = refs.currentPassword.value;
  const nextPassword = refs.nextPassword.value;
  const confirmNextPassword = refs.confirmNextPassword.value;

  if (!currentPassword || !nextPassword || !confirmNextPassword) {
    refs.changePasswordResult.textContent = "Vui lòng nhập đầy đủ thông tin mật khẩu.";
    return;
  }

  if (nextPassword.length < 6) {
    refs.changePasswordResult.textContent = "Mật khẩu mới tối thiểu 6 ký tự.";
    return;
  }

  if (nextPassword !== confirmNextPassword) {
    refs.changePasswordResult.textContent = "Mật khẩu mới và phần xác nhận mật khẩu mới chưa khớp.";
    return;
  }

  if (runtime.remoteMode) {
    void changePasswordRemote({ currentPassword, nextPassword });
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    refs.changePasswordResult.textContent = "Không tìm thấy phiên đăng nhập hiện tại.";
    return;
  }

  const user = state.users.find((item) => item.id === currentUser.id);
  if (!user || user.password !== currentPassword) {
    refs.changePasswordResult.textContent = "Mật khẩu hiện tại không đúng.";
    return;
  }

  user.password = nextPassword;
  saveState();
  refs.changePasswordForm.reset();
  refs.changePasswordResult.textContent = "Đã cập nhật mật khẩu mới thành công.";
  showModal(refs.changePasswordResult.textContent);
}

async function changePasswordRemote(payload) {
  try {
    await apiRequest("/account/change-password", {
      method: "POST",
      body: payload,
    });
    refs.changePasswordForm.reset();
    refs.changePasswordResult.textContent = "Đã cập nhật mật khẩu mới thành công.";
    showModal(refs.changePasswordResult.textContent);
  } catch (error) {
    handleRemoteActionError(error, refs.changePasswordResult, "Không thể cập nhật mật khẩu mới.");
  }
}

function stopRemoteAutoSync() {
  if (runtime.syncTimer) {
    clearInterval(runtime.syncTimer);
    runtime.syncTimer = null;
  }
}

function startRemoteAutoSync() {
  if (!runtime.remoteMode) return;
  if (runtime.syncTimer) return;

  runtime.syncTimer = setInterval(() => {
    if (!state.currentUserId) return;

    const activeTag = document.activeElement?.tagName;
    if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
      return;
    }

    void syncFromServer({ preserveTab: true, silent: true });
  }, AUTO_SYNC_INTERVAL_MS);
}

async function syncFromServer({ preserveTab = true, silent = false } = {}) {
  const currentTab = state.activeTab;
  const previousUserId = state.currentUserId;

  try {
    const payload = await apiRequest("/bootstrap");
    applyBootstrap(payload);
    if (preserveTab && currentTab) {
      state.activeTab = currentTab;
    }

    renderAuthState();
  } catch (error) {
    if (error.status === 401) {
      clearState();
      state.activeTab = "";
      stopRemoteAutoSync();
      renderAuthState();
      return;
    }

    if (!silent) {
      refs.loginMessage.textContent = error.message || "Không thể đồng bộ dữ liệu từ máy chủ.";
    }

    if (previousUserId && !state.currentUserId) {
      state.currentUserId = previousUserId;
    }
  }
}

async function restoreRemoteSession() {
  clearState();
  await syncFromServer({ preserveTab: false, silent: true });
}

async function handleLogin() {
  if (runtime.remoteMode) {
    await handleRemoteLogin();
    return;
  }

  const username = refs.loginUsername.value.trim().toLowerCase();
  const password = refs.loginPassword.value;

  const matchedUser = state.users.find(
    (user) => user.username.toLowerCase() === username && user.password === password,
  );

  if (!matchedUser) {
    refs.loginMessage.textContent = "Sai tên đăng nhập hoặc mật khẩu.";
    return;
  }

   if (matchedUser.role === "member" && matchedUser.locked) {
     refs.loginMessage.textContent = "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.";
     return;
   }

  state.currentUserId = matchedUser.id;
  saveSession(matchedUser.id);
  refs.loginForm.reset();
  refs.loginMessage.textContent = "";
  renderAuthState();
}

async function handleRemoteLogin() {
  const username = refs.loginUsername.value.trim();
  const password = refs.loginPassword.value;

  if (!username || !password) {
    refs.loginMessage.textContent = "Vui lòng nhập tên đăng nhập và mật khẩu.";
    return;
  }

  try {
    await apiRequest("/auth/login", {
      method: "POST",
      body: { username, password },
    });

    refs.loginForm.reset();
    refs.loginMessage.textContent = "";
    await syncFromServer({ preserveTab: false, silent: false });
  } catch (error) {
    handleRemoteActionError(error, refs.loginMessage, "Đăng nhập thất bại.");
  }
}

function handleLogout() {
  if (runtime.remoteMode) {
    void handleRemoteLogout();
    return;
  }

  state.currentUserId = null;
  state.activeTab = "";
  saveSession(null);
  renderAuthState();
}

async function handleRemoteLogout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (error) {
    // Ignore logout API failures and force local cleanup.
  }

  clearState();
  state.activeTab = "";
  stopRemoteAutoSync();
  renderAuthState();
}

function getCurrentUser() {
  return state.users.find((item) => item.id === state.currentUserId) || null;
}

function isAdmin(user) {
  return Boolean(user && user.role === "admin");
}

function canEditCustomerInfo(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return Boolean(user.permissions?.customerEdit);
}

function canDeleteCustomer(user) {
  return isAdmin(user);
}

function canEditProduct(user) {
  return hasFeaturePermission(user, "productsEdit");
}

function canDeleteProduct(user) {
  return hasFeaturePermission(user, "productsDelete");
}

function canEditVisit(user) {
  return hasFeaturePermission(user, "visitsEdit");
}

function canDeleteVisit(user) {
  return hasFeaturePermission(user, "visitsDelete");
}

function canEditReferral(user) {
  return hasFeaturePermission(user, "referralsEdit");
}

function canDeleteReferral(user) {
  return hasFeaturePermission(user, "referralsDelete");
}

function hasFeaturePermission(user, featureKey) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (featureKey === "manageUsers") return false;
  return Boolean(user.permissions?.[featureKey]);
}

function canAccessTab(tabId) {
  const featureKey = TAB_FEATURE_MAP[tabId];
  if (!featureKey) return false;

  return hasFeaturePermission(getCurrentUser(), featureKey);
}

function ensureFeature(featureKey, errorElement) {
  if (hasFeaturePermission(getCurrentUser(), featureKey)) return true;

  if (errorElement) {
    errorElement.textContent = "Bạn không có quyền dùng tính năng này.";
  }

  return false;
}

function renderAuthState() {
  const user = getCurrentUser();
  if (user && user.role === "member" && user.locked) {
    saveSession(null);
    refs.loginMessage.textContent = "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.";
    refs.authView.classList.remove("hidden");
    refs.appView.classList.add("hidden");
    return;
  }
  if (!user) {
    state.editingCustomerId = null;
    state.editingProductId = null;
    state.editingVisitId = null;
    state.editingReferralId = null;
    setCustomerFormMode(false);
    setProductFormMode(false);
    setVisitFormMode(false);
    setReferralFormMode(false);

    if (runtime.remoteMode) {
      stopRemoteAutoSync();
    }

    refs.authView.classList.remove("hidden");
    refs.appView.classList.add("hidden");
    setActiveTab("");
    return;
  }

  refs.authView.classList.add("hidden");
  refs.appView.classList.remove("hidden");

  const roleLabel = isAdmin(user) ? "Quản trị viên" : "Nhân viên";
  refs.sessionUser.textContent = `${user.fullName} (${roleLabel})`;

  applyTabPermissions();
  renderAll();

  if (runtime.remoteMode) {
    startRemoteAutoSync();
  }
}

function applyTabPermissions() {
  const user = getCurrentUser();
  const allowedTabs = Object.keys(TAB_FEATURE_MAP).filter((tabId) =>
    hasFeaturePermission(user, TAB_FEATURE_MAP[tabId]),
  );

  refs.tabs.forEach((btn) => {
    const isAllowed = allowedTabs.includes(btn.dataset.tab);
    btn.classList.toggle("hidden", !isAllowed);
  });

  if (allowedTabs.length === 0) {
    refs.noPermission.classList.remove("hidden");
    setActiveTab("");
    return;
  }

  refs.noPermission.classList.add("hidden");
  const nextTab = allowedTabs.includes(state.activeTab) ? state.activeTab : allowedTabs[0];
  setActiveTab(nextTab);
}

function setActiveTab(tabId) {
  state.activeTab = tabId;

  refs.tabs.forEach((btn) => {
    btn.classList.toggle("active", tabId && btn.dataset.tab === tabId);
  });

  refs.panels.forEach((panel) => {
    panel.classList.toggle("active", tabId && panel.id === `tab-${tabId}`);
  });

  if (tabId === "maintenance") {
    void refreshBackupStatus();
  }
}

function getRateByOccurrence(occurrence) {
  const step = Math.min(occurrence, 10);
  return step * 0.05;
}

function monthOf(dateValue) {
  return typeof dateValue === "string" ? dateValue.slice(0, 7) : "";
}

function formatPercent(rate) {
  return `${Math.round(rate * 100)}%`;
}

function formatDate(dateValue) {
  if (!dateValue || typeof dateValue !== "string" || !dateValue.includes("-")) {
    return "-";
  }

  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatNumberDisplay(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return num.toLocaleString("vi-VN");
}

function unformatNumber(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits ? Number(digits) : 0;
}

function bindNumericFormatter(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D+/g, "");
    input.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
  });
}

function showModal(message) {
  if (!refs.modalOverlay || !refs.modalMessage) return;
  refs.modalMessage.textContent = message || "";
  refs.modalOverlay.classList.remove("hidden");
}

function hideModal() {
  if (!refs.modalOverlay) return;
  refs.modalOverlay.classList.add("hidden");
}

function showHistoryModal() {
  if (!refs.historyOverlay) return;
  refs.historyOverlay.classList.remove("hidden");
}

function hideHistoryModal() {
  if (!refs.historyOverlay) return;
  refs.historyOverlay.classList.add("hidden");
}

function getCustomerName(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  return customer ? customer.name : "Không xác định";
}

function getProductName(productId) {
  if (!productId) return "-";
  const product = state.products.find((item) => item.id === productId);
  return product ? product.name : "Không xác định";
}

function getMemberUsers() {
  return state.users
    .filter((item) => item.role === "member")
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
}

function getReferrerName(referrerId) {
  if (!referrerId) return "-";
  const user = state.users.find((item) => item.id === referrerId);
  if (!user) return "Không xác định";
  return `${user.fullName} (${user.username})`;
}

function getReferredCustomerDisplay(referral) {
  if (referral.referredCustomerId) {
    return getCustomerName(referral.referredCustomerId);
  }

  if (referral.referredName) {
    return referral.referredName;
  }

  return "Không xác định";
}

function resolveIdFromOptions(inputElement, optionsElement, items, labelPicker) {
  const typed = inputElement?.value?.trim() || "";
  if (!typed) return "";

  const normalizedTyped = normalizeTextValue(typed);
  const options = optionsElement ? Array.from(optionsElement.options || []) : [];
  const matchedOption = options.find((option) => {
    const optionLabel = option.label || option.textContent || option.value;
    return (
      normalizeTextValue(option.value) === normalizedTyped || normalizeTextValue(optionLabel) === normalizedTyped
    );
  });

  if (matchedOption) {
    return matchedOption.dataset?.id || matchedOption.value || "";
  }

  const direct = items.find((item) => item.id === typed);
  if (direct) return typed;

  if (typeof labelPicker === "function") {
    const matchedItem = items.find((item) => normalizeTextValue(labelPicker(item)) === normalizedTyped);
    if (matchedItem) return matchedItem.id;
  }

  return "";
}

function resolveCustomerId(inputElement, optionsElement) {
  return resolveIdFromOptions(inputElement, optionsElement, state.customers, (item) =>
    `${item.name}${item.phone ? ` - ${item.phone}` : ""}`,
  );
}

function resolveProductId(inputElement, optionsElement) {
  return resolveIdFromOptions(inputElement, optionsElement, state.products, (item) =>
    `${item.name}${item.code ? ` (${item.code})` : ""}`,
  );
}

function resolveReferrerId(inputElement, optionsElement) {
  return resolveIdFromOptions(
    inputElement,
    optionsElement,
    getMemberUsers(),
    (item) => `${item.fullName} (${item.username})`,
  );
}

function escapeCsvCell(value) {
  const normalized = String(value ?? "");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

function buildCustomersCsv(rows) {
  const header = ["name", "phone", "email", "note"];
  const body = rows.map((item) =>
    [item.name || "", item.phone || "", item.email || "", item.note || ""].map(escapeCsvCell).join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeTextValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCsvTable(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells) => cells.some((item) => String(item).trim() !== ""));
}

function parseCustomersCsv(csvText) {
  const table = parseCsvTable(csvText);
  if (table.length === 0) {
    throw new Error("Tệp dữ liệu phân tách bằng dấu phẩy đang trống.");
  }

  const headers = table[0].map((item) => normalizeHeader(item));
  const indexOf = (aliases) => headers.findIndex((item) => aliases.includes(item));

  const nameIndex = indexOf(["name", "ten", "hoten", "fullname", "customername"]);
  const phoneIndex = indexOf(["phone", "sdt", "sodienthoai", "dienthoai", "mobile"]);
  const emailIndex = indexOf(["email"]);
  const noteIndex = indexOf(["note", "ghichu"]);

  if (nameIndex < 0) {
    throw new Error("Thiếu cột bắt buộc `name` (hoặc `ten`) trong tệp dữ liệu phân tách bằng dấu phẩy.");
  }

  let skippedCount = 0;
  const rows = [];

  table.slice(1).forEach((line) => {
    const pick = (idx) => (idx >= 0 ? String(line[idx] || "").trim() : "");
    const name = pick(nameIndex);
    const phone = pick(phoneIndex);
    const email = pick(emailIndex);
    const note = pick(noteIndex);

    if (!name && !phone && !email && !note) {
      skippedCount += 1;
      return;
    }

    if (!name) {
      skippedCount += 1;
      return;
    }

    rows.push({ name, phone, email, note });
  });

  return {
    rows,
    skippedCount,
  };
}

function downloadCustomerTemplate() {
  if (!ensureFeature("customers", refs.customerImportResult)) return;

  const templateRows = [
    { name: "Nguyen Van A", phone: "0901234567", email: "a@example.com", note: "Khach moi" },
    { name: "Tran Thi B", phone: "0912345678", email: "b@example.com", note: "Khach than thiet" },
  ];
  const content = buildCustomersCsv(templateRows);
  downloadTextFile("aha-customers-template.csv", content, "text/csv;charset=utf-8");
  refs.customerImportResult.textContent = "Đã tải tệp mẫu dữ liệu khách hàng.";
}

function exportCustomersCsv() {
  if (!ensureFeature("customers", refs.customerImportResult)) return;

  if (state.customers.length === 0) {
    refs.customerImportResult.textContent = "Chưa có dữ liệu khách hàng để xuất.";
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const content = buildCustomersCsv(state.customers);
  downloadTextFile(`aha-customers-${timestamp}.csv`, content, "text/csv;charset=utf-8");
  refs.customerImportResult.textContent = `Đã xuất ${state.customers.length} khách hàng ra tệp dữ liệu phân tách bằng dấu phẩy.`;
}

async function importCustomersFromFile() {
  if (!ensureFeature("customers", refs.customerImportResult)) return;

  const file = refs.customerImportFile.files?.[0];
  if (!file) {
    refs.customerImportResult.textContent =
      "Vui lòng chọn tệp dữ liệu phân tách bằng dấu phẩy trước khi nhập dữ liệu.";
    return;
  }

  try {
    const csvText = await file.text();
    const parsed = parseCustomersCsv(csvText);

    if (parsed.rows.length === 0) {
      refs.customerImportResult.textContent = "Không có dòng dữ liệu hợp lệ để nhập.";
      return;
    }

    if (state.editingCustomerId) {
      resetCustomerFormState();
    }

    if (runtime.remoteMode) {
      await importCustomersRemote(parsed.rows, parsed.skippedCount);
      return;
    }

    for (let index = parsed.rows.length - 1; index >= 0; index -= 1) {
      const row = parsed.rows[index];
      state.customers.unshift({
        id: createId("cus"),
        name: row.name,
        phone: row.phone,
        email: row.email,
        note: row.note,
        createdAt: new Date().toISOString(),
      });
    }

    saveState();
    renderAll();
    refs.customerImportFile.value = "";
    refs.customerImportResult.textContent = `Đã nhập ${parsed.rows.length} khách hàng từ tệp dữ liệu phân tách bằng dấu phẩy. Bỏ qua ${parsed.skippedCount} dòng không hợp lệ.`;
  } catch (error) {
    refs.customerImportResult.textContent = error.message || "Không thể nhập dữ liệu từ tệp dữ liệu phân tách bằng dấu phẩy.";
  }
}

async function importCustomersRemote(rows, skippedCount) {
  try {
    const payload = await apiRequest("/customers/import", {
      method: "POST",
      body: { rows },
    });

    if (Array.isArray(payload?.customers)) {
      state.customers = payload.customers;
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    refs.customerImportFile.value = "";
    renderAll();

    const importedCount = Number(payload?.importedCount) || rows.length;
    const totalSkipped = (Number(payload?.skippedCount) || 0) + skippedCount;
    refs.customerImportResult.textContent = `Đã nhập ${importedCount} khách hàng từ tệp dữ liệu phân tách bằng dấu phẩy. Bỏ qua ${totalSkipped} dòng không hợp lệ.`;
  } catch (error) {
    handleRemoteActionError(
      error,
      refs.customerImportResult,
      "Không thể nhập dữ liệu khách hàng từ tệp dữ liệu phân tách bằng dấu phẩy.",
    );
  }
}

function setCustomerFormMode(editing) {
  refs.customerSubmitBtn.textContent = editing ? "Lưu chỉnh sửa khách hàng" : "Lưu khách hàng";
  refs.customerCancelBtn.classList.toggle("hidden", !editing);
}

function resetCustomerFormState() {
  state.editingCustomerId = null;
  refs.customerForm.reset();
  setCustomerFormMode(false);
}

function handleCancelCustomerEdit() {
  if (!state.editingCustomerId) return;
  resetCustomerFormState();
  refs.customerFormResult.textContent = "Đã huỷ chỉnh sửa khách hàng.";
}

function setProductFormMode(editing) {
  refs.productSubmitBtn.textContent = editing ? "Lưu chỉnh sửa sản phẩm dịch vụ" : "Lưu sản phẩm dịch vụ";
  refs.productCancelBtn.classList.toggle("hidden", !editing);
}

function resetProductFormState() {
  state.editingProductId = null;
  refs.productForm.reset();
  setProductFormMode(false);
}

function handleCancelProductEdit() {
  if (!state.editingProductId) return;
  resetProductFormState();
  refs.productFormResult.textContent = "Đã huỷ chỉnh sửa sản phẩm/dịch vụ.";
}

function setVisitFormMode(editing) {
  refs.visitSubmitBtn.textContent = editing ? "Lưu chỉnh sửa tích điểm voucher" : "Ghi nhận + tính voucher";
  refs.visitCancelBtn.classList.toggle("hidden", !editing);
}

function resetVisitFormState() {
  state.editingVisitId = null;
  refs.visitForm.reset();
  refs.visitDate.value = new Date().toISOString().slice(0, 10);
  setVisitFormMode(false);
}

function handleCancelVisitEdit() {
  if (!state.editingVisitId) return;
  resetVisitFormState();
  refs.visitResult.textContent = "Đã huỷ chỉnh sửa giao dịch tích điểm voucher.";
}

function setReferralFormMode(editing) {
  refs.referralSubmitBtn.textContent = editing ? "Lưu chỉnh sửa hoa hồng" : "Ghi nhận + tính hoa hồng";
  refs.referralCancelBtn.classList.toggle("hidden", !editing);
}

function resetReferralFormState() {
  state.editingReferralId = null;
  refs.referralForm.reset();
  refs.referralDate.value = new Date().toISOString().slice(0, 10);
  setReferralFormMode(false);
}

function handleCancelReferralEdit() {
  if (!state.editingReferralId) return;
  resetReferralFormState();
  refs.referralResult.textContent = "Đã huỷ chỉnh sửa giao dịch hoa hồng.";
}

function prepareCustomerEdit(customerId) {
  const currentUser = getCurrentUser();
  if (!canEditCustomerInfo(currentUser)) {
    refs.customerFormResult.textContent = "Bạn không có quyền sửa thông tin khách hàng.";
    return;
  }

  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) {
    refs.customerFormResult.textContent = "Không tìm thấy khách hàng cần chỉnh sửa.";
    return;
  }

  state.editingCustomerId = customer.id;
  refs.customerName.value = customer.name || "";
  refs.customerPhone.value = customer.phone || "";
  refs.customerEmail.value = customer.email || "";
  refs.customerNote.value = customer.note || "";
  setCustomerFormMode(true);
  refs.customerFormResult.textContent = `Đang chỉnh sửa khách hàng: ${customer.name}.`;
}

function applyCustomerValues(customer, values) {
  customer.name = values.name;
  customer.phone = values.phone;
  customer.email = values.email;
  customer.note = values.note;
}

function confirmAction(message) {
  try {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      const confirmation = window.confirm(message);
      if (typeof confirmation === "boolean") {
        return confirmation;
      }

      return true;
    }
  } catch (error) {
    return true;
  }

  return true;
}

function removeCustomerData(customerId) {
  const beforeVisits = state.visits.length;
  const beforeReferrals = state.referrals.length;

  state.customers = state.customers.filter((item) => item.id !== customerId);
  state.visits = state.visits.filter((item) => item.customerId !== customerId);
  state.referrals = state.referrals.filter((item) => item.referredCustomerId !== customerId);
  normalizeAllRecords();

  if (state.editingVisitId && !state.visits.some((item) => item.id === state.editingVisitId)) {
    resetVisitFormState();
  }

  if (state.editingReferralId && !state.referrals.some((item) => item.id === state.editingReferralId)) {
    resetReferralFormState();
  }

  return {
    removedVisits: beforeVisits - state.visits.length,
    removedReferrals: beforeReferrals - state.referrals.length,
  };
}

function handleCustomerTableClick(event) {
  const nameButton = event.target.closest(".customer-name-btn");
  if (nameButton) {
    showCustomerHistory(nameButton.dataset.customerId || "");
    return;
  }

  const editButton = event.target.closest(".edit-customer-btn");
  if (editButton) {
    prepareCustomerEdit(editButton.dataset.customerId || "");
    return;
  }

  const deleteButton = event.target.closest(".delete-customer-btn");
  if (!deleteButton) return;

  const currentUser = getCurrentUser();
  if (!canDeleteCustomer(currentUser)) {
    refs.customerFormResult.textContent = "Chỉ quản trị viên mới có quyền xoá khách hàng.";
    return;
  }

  const customerId = deleteButton.dataset.customerId || "";
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) {
    refs.customerFormResult.textContent = "Không tìm thấy khách hàng cần xoá.";
    return;
  }

  const accepted = confirmAction(`Xoá khách hàng ${customer.name}? Thao tác này sẽ xoá cả giao dịch liên quan.`);
  if (!accepted) return;

  if (runtime.remoteMode) {
    void deleteCustomerRemote(customerId);
    return;
  }

  const removed = removeCustomerData(customerId);
  saveState();

  if (state.editingCustomerId === customerId) {
    resetCustomerFormState();
  }

  refs.customerFormResult.textContent = `Đã xoá khách hàng ${customer.name}. Xoá ${removed.removedVisits} lượt voucher và ${removed.removedReferrals} lượt hoa hồng liên quan.`;
  showModal(refs.customerFormResult.textContent);
  renderAll();
}

function addCustomer() {
  if (runtime.remoteMode) {
    void addCustomerRemote();
    return;
  }

  if (!ensureFeature("customers", refs.customerFormResult)) return;

  const name = refs.customerName.value.trim();
  const phone = refs.customerPhone.value.trim();
  const email = refs.customerEmail.value.trim();
  const note = refs.customerNote.value.trim();
  const editingCustomerId = state.editingCustomerId;

  if (!name) {
    refs.customerFormResult.textContent = "Vui lòng nhập tên khách hàng.";
    return;
  }

  if (editingCustomerId) {
    const currentUser = getCurrentUser();
    if (!canEditCustomerInfo(currentUser)) {
      refs.customerFormResult.textContent = "Bạn không có quyền sửa thông tin khách hàng.";
      return;
    }

    const customer = state.customers.find((item) => item.id === editingCustomerId);
    if (!customer) {
      refs.customerFormResult.textContent = "Không tìm thấy khách hàng cần chỉnh sửa.";
      resetCustomerFormState();
      return;
    }

    applyCustomerValues(customer, { name, phone, email, note });
    saveState();
    resetCustomerFormState();
    refs.customerFormResult.textContent = `Đã cập nhật khách hàng: ${name}.`;
    showModal(`Đã cập nhật khách hàng: ${name}.`);
    renderAll();
    return;
  }

  const customer = {
    id: createId("cus"),
    name,
    phone,
    email,
    note,
    createdAt: new Date().toISOString(),
  };

  state.customers.unshift(customer);
  saveState();

  resetCustomerFormState();
  refs.customerFormResult.textContent = `Đã thêm khách hàng: ${name}.`;
  showModal(`Đã thêm khách hàng: ${name}.`);
  renderAll();
}

async function addCustomerRemote() {
  if (!ensureFeature("customers", refs.customerFormResult)) return;

  const name = refs.customerName.value.trim();
  const phone = refs.customerPhone.value.trim();
  const email = refs.customerEmail.value.trim();
  const note = refs.customerNote.value.trim();
  const editingCustomerId = state.editingCustomerId;

  if (!name) {
    refs.customerFormResult.textContent = "Vui lòng nhập tên khách hàng.";
    return;
  }

  if (editingCustomerId) {
    const currentUser = getCurrentUser();
    if (!canEditCustomerInfo(currentUser)) {
      refs.customerFormResult.textContent = "Bạn không có quyền sửa thông tin khách hàng.";
      return;
    }

    try {
      const payload = await apiRequest(`/customers/${encodeURIComponent(editingCustomerId)}`, {
        method: "PATCH",
        body: { name, phone, email, note },
      });

      const savedCustomer = payload?.customer;
      if (savedCustomer) {
        state.customers = state.customers.map((item) =>
          item.id === savedCustomer.id
            ? {
                ...item,
                name: savedCustomer.name,
                phone: savedCustomer.phone,
                email: savedCustomer.email,
                note: savedCustomer.note,
              }
            : item,
        );
      } else {
        await syncFromServer({ preserveTab: true, silent: true });
      }

      resetCustomerFormState();
      refs.customerFormResult.textContent = `Đã cập nhật khách hàng: ${name}.`;
      showModal(refs.customerFormResult.textContent);
      renderAll();
    } catch (error) {
      handleRemoteActionError(error, refs.customerFormResult, "Không thể cập nhật thông tin khách hàng.");
    }

    return;
  }

  try {
    const payload = await apiRequest("/customers", {
      method: "POST",
      body: { name, phone, email, note },
    });

    if (payload?.customer) {
      state.customers.unshift(payload.customer);
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    resetCustomerFormState();
    refs.customerFormResult.textContent = `Đã thêm khách hàng: ${name}.`;
    showModal(refs.customerFormResult.textContent);
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.customerFormResult, "Không thể thêm khách hàng.");
  }
}

async function deleteCustomerRemote(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) {
    refs.customerFormResult.textContent = "Không tìm thấy khách hàng cần xoá.";
    return;
  }

  try {
    const payload = await apiRequest(`/customers/${encodeURIComponent(customerId)}`, {
      method: "DELETE",
    });
    const removedLocal = removeCustomerData(customerId);
    const removed = payload?.deleted || removedLocal;

    if (state.editingCustomerId === customerId) {
      resetCustomerFormState();
    }

    refs.customerFormResult.textContent = `Đã xoá khách hàng ${customer.name}. Xoá ${removed.removedVisits || 0} lượt voucher và ${removed.removedReferrals || 0} lượt hoa hồng liên quan.`;
    showModal(refs.customerFormResult.textContent);
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.customerFormResult, "Không thể xoá khách hàng.");
  }
}

function readProductFormValues() {
  const name = refs.productName.value.trim();
  const code = refs.productCode.value.trim();
  const defaultPrice = unformatNumber(refs.productDefaultPrice.value);
  const note = refs.productNote.value.trim();

  if (!name) {
    refs.productFormResult.textContent = "Vui lòng nhập tên sản phẩm / dịch vụ.";
    return null;
  }

  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    refs.productFormResult.textContent = "Giá gợi ý không hợp lệ.";
    return null;
  }

  return { name, code, defaultPrice, note };
}

function getProductUsage(productId) {
  const usedInVisits = state.visits.filter((item) => item.productId === productId).length;
  const usedInReferrals = state.referrals.filter((item) => item.productId === productId).length;
  return { usedInVisits, usedInReferrals };
}

function prepareProductEdit(productId) {
  const currentUser = getCurrentUser();
  if (!canEditProduct(currentUser)) {
    refs.productFormResult.textContent = "Bạn không có quyền sửa sản phẩm/dịch vụ.";
    return;
  }

  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    refs.productFormResult.textContent = "Không tìm thấy sản phẩm/dịch vụ cần chỉnh sửa.";
    return;
  }

  state.editingProductId = product.id;
  refs.productName.value = product.name || "";
  refs.productCode.value = product.code || "";
  refs.productDefaultPrice.value = formatNumberDisplay(product.defaultPrice);
  refs.productNote.value = product.note || "";
  setProductFormMode(true);
  refs.productFormResult.textContent = `Đang chỉnh sửa sản phẩm/dịch vụ: ${product.name}.`;
}

function handleProductTableClick(event) {
  const editButton = event.target.closest(".edit-product-btn");
  if (editButton) {
    prepareProductEdit(editButton.dataset.productId || "");
    return;
  }

  const deleteButton = event.target.closest(".delete-product-btn");
  if (!deleteButton) return;

  const currentUser = getCurrentUser();
  if (!canDeleteProduct(currentUser)) {
    refs.productFormResult.textContent = "Bạn không có quyền xoá sản phẩm/dịch vụ.";
    return;
  }

  const productId = deleteButton.dataset.productId || "";
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    refs.productFormResult.textContent = "Không tìm thấy sản phẩm/dịch vụ cần xoá.";
    return;
  }

  const usage = getProductUsage(productId);
  if (usage.usedInVisits > 0 || usage.usedInReferrals > 0) {
    refs.productFormResult.textContent = `Không thể xoá ${product.name} vì đang được dùng ở ${usage.usedInVisits} lượt voucher và ${usage.usedInReferrals} lượt hoa hồng.`;
    return;
  }

  if (!confirmAction(`Xoá sản phẩm/dịch vụ ${product.name}?`)) return;

  if (runtime.remoteMode) {
    void deleteProductRemote(productId);
    return;
  }

  state.products = state.products.filter((item) => item.id !== productId);
  if (state.editingProductId === productId) {
    resetProductFormState();
  }

  saveState();
  refs.productFormResult.textContent = `Đã xoá sản phẩm/dịch vụ: ${product.name}.`;
  showModal(refs.productFormResult.textContent);
  renderAll();
}

async function deleteProductRemote(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    refs.productFormResult.textContent = "Không tìm thấy sản phẩm/dịch vụ cần xoá.";
    return;
  }

  try {
    const payload = await apiRequest(`/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    });

    if (Array.isArray(payload?.products)) {
      state.products = payload.products;
    } else {
      state.products = state.products.filter((item) => item.id !== productId);
    }

    if (state.editingProductId === productId) {
      resetProductFormState();
    }

    refs.productFormResult.textContent = `Đã xoá sản phẩm/dịch vụ: ${product.name}.`;
    showModal(refs.productFormResult.textContent);
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.productFormResult, "Không thể xoá sản phẩm/dịch vụ.");
  }
}

function addProduct() {
  if (runtime.remoteMode) {
    void addProductRemote();
    return;
  }

  if (!ensureFeature("products", refs.productFormResult)) return;
  const values = readProductFormValues();
  if (!values) return;

  const editingProductId = state.editingProductId;
  if (editingProductId) {
    const currentUser = getCurrentUser();
    if (!canEditProduct(currentUser)) {
      refs.productFormResult.textContent = "Bạn không có quyền sửa sản phẩm/dịch vụ.";
      return;
    }

    const product = state.products.find((item) => item.id === editingProductId);
    if (!product) {
      refs.productFormResult.textContent = "Không tìm thấy sản phẩm/dịch vụ cần chỉnh sửa.";
      resetProductFormState();
      return;
    }

    product.name = values.name;
    product.code = values.code;
    product.defaultPrice = values.defaultPrice;
    product.note = values.note;
    saveState();
    resetProductFormState();
    refs.productFormResult.textContent = `Đã cập nhật sản phẩm/dịch vụ: ${values.name}.`;
    renderAll();
    return;
  }

  const product = {
    id: createId("prd"),
    name: values.name,
    code: values.code,
    defaultPrice: values.defaultPrice,
    note: values.note,
    createdAt: new Date().toISOString(),
  };

  state.products.unshift(product);
  saveState();
  resetProductFormState();
  refs.productFormResult.textContent = `Đã thêm sản phẩm/dịch vụ: ${values.name}.`;
  showModal(`Đã thêm sản phẩm/dịch vụ: ${values.name}.`);
  renderAll();
}

async function addProductRemote() {
  if (!ensureFeature("products", refs.productFormResult)) return;
  const values = readProductFormValues();
  if (!values) return;

  const editingProductId = state.editingProductId;
  if (editingProductId) {
    const currentUser = getCurrentUser();
    if (!canEditProduct(currentUser)) {
      refs.productFormResult.textContent = "Bạn không có quyền sửa sản phẩm/dịch vụ.";
      return;
    }

    try {
      const payload = await apiRequest(`/products/${encodeURIComponent(editingProductId)}`, {
        method: "PATCH",
        body: values,
      });

      if (payload?.product) {
        state.products = state.products.map((item) => (item.id === payload.product.id ? payload.product : item));
      } else if (Array.isArray(payload?.products)) {
        state.products = payload.products;
      } else {
        await syncFromServer({ preserveTab: true, silent: true });
      }

      resetProductFormState();
      refs.productFormResult.textContent = `Đã cập nhật sản phẩm/dịch vụ: ${values.name}.`;
      showModal(`Đã cập nhật sản phẩm/dịch vụ: ${values.name}.`);
      renderAll();
    } catch (error) {
      handleRemoteActionError(error, refs.productFormResult, "Không thể cập nhật sản phẩm/dịch vụ.");
    }

    return;
  }

  try {
    const payload = await apiRequest("/products", {
      method: "POST",
      body: values,
    });

    if (payload?.product) {
      state.products.unshift(payload.product);
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    resetProductFormState();
    refs.productFormResult.textContent = `Đã thêm sản phẩm/dịch vụ: ${values.name}.`;
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.productFormResult, "Không thể thêm sản phẩm/dịch vụ.");
  }
}

function readVisitFormValues() {
  if (state.customers.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận lượt đến.";
    return null;
  }

  if (state.products.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giao dịch.";
    return null;
  }

  const customerId = resolveCustomerId(refs.visitCustomer, refs.visitCustomerOptions);
  const productId = resolveProductId(refs.visitProduct, refs.visitProductOptions);
  const date = refs.visitDate.value;
  const revenue = unformatNumber(refs.visitRevenue.value);

  if (!customerId || !productId || !date || revenue <= 0) {
    refs.visitResult.textContent = "Vui lòng nhập đủ khách hàng, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return null;
  }

  const validCustomer = state.customers.some((item) => item.id === customerId);
  const validProduct = state.products.some((item) => item.id === productId);
  if (!validCustomer || !validProduct) {
    refs.visitResult.textContent = "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.";
    return null;
  }

  return { customerId, productId, date, revenue };
}

function formatVisitMessage(visit) {
  return `${getCustomerName(visit.customerId)} - ${getProductName(visit.productId)} - lần ${visit.occurrence} trong tháng ${monthOf(visit.date)}: ${formatPercent(visit.rate)} | Voucher tích điểm: ${formatMoney(visit.voucher)}.`;
}

function prepareVisitEdit(visitId) {
  const currentUser = getCurrentUser();
  if (!canEditVisit(currentUser)) {
    refs.visitResult.textContent = "Bạn không có quyền sửa dữ liệu tích điểm voucher.";
    return;
  }

  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) {
    refs.visitResult.textContent = "Không tìm thấy giao dịch tích điểm cần chỉnh sửa.";
    return;
  }

  state.editingVisitId = visit.id;
  refs.visitCustomer.value = getCustomerName(visit.customerId) || "";
  refs.visitProduct.value = getProductName(visit.productId) || "";
  refs.visitDate.value = visit.date || "";
  refs.visitRevenue.value = formatNumberDisplay(visit.revenue);
  setVisitFormMode(true);
  refs.visitResult.textContent = "Đang chỉnh sửa giao dịch tích điểm voucher.";
}

function handleVisitTableClick(event) {
  const editButton = event.target.closest(".edit-visit-btn");
  if (editButton) {
    prepareVisitEdit(editButton.dataset.visitId || "");
    return;
  }

  const deleteButton = event.target.closest(".delete-visit-btn");
  if (!deleteButton) return;

  const currentUser = getCurrentUser();
  if (!canDeleteVisit(currentUser)) {
    refs.visitResult.textContent = "Bạn không có quyền xoá dữ liệu tích điểm voucher.";
    return;
  }

  const visitId = deleteButton.dataset.visitId || "";
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) {
    refs.visitResult.textContent = "Không tìm thấy giao dịch tích điểm cần xoá.";
    return;
  }

  if (!confirmAction("Xoá giao dịch tích điểm voucher này?")) return;

  if (runtime.remoteMode) {
    void deleteVisitRemote(visitId);
    return;
  }

  state.visits = state.visits.filter((item) => item.id !== visitId);
  normalizeAllRecords();
  if (state.editingVisitId === visitId) {
    resetVisitFormState();
  }
  saveState();
  refs.visitResult.textContent = "Đã xoá giao dịch tích điểm voucher.";
  showModal(refs.visitResult.textContent);
  renderVisits();
}

async function deleteVisitRemote(visitId) {
  try {
    const payload = await apiRequest(`/visits/${encodeURIComponent(visitId)}`, {
      method: "DELETE",
    });

    if (Array.isArray(payload?.visits)) {
      state.visits = payload.visits;
    } else {
      state.visits = state.visits.filter((item) => item.id !== visitId);
    }

    normalizeAllRecords();
    if (state.editingVisitId === visitId) {
      resetVisitFormState();
    }
    refs.visitResult.textContent = "Đã xoá giao dịch tích điểm voucher.";
    renderVisits();
  } catch (error) {
    handleRemoteActionError(error, refs.visitResult, "Không thể xoá giao dịch tích điểm voucher.");
  }
}

function addVisit() {
  if (runtime.remoteMode) {
    void addVisitRemote();
    return;
  }

  if (!ensureFeature("visits", refs.visitResult)) return;
  const values = readVisitFormValues();
  if (!values) return;

  const editingVisitId = state.editingVisitId;
  if (editingVisitId) {
    const currentUser = getCurrentUser();
    if (!canEditVisit(currentUser)) {
      refs.visitResult.textContent = "Bạn không có quyền sửa dữ liệu tích điểm voucher.";
      return;
    }

    const visit = state.visits.find((item) => item.id === editingVisitId);
    if (!visit) {
      refs.visitResult.textContent = "Không tìm thấy giao dịch tích điểm cần chỉnh sửa.";
      resetVisitFormState();
      return;
    }

    visit.customerId = values.customerId;
    visit.productId = values.productId;
    visit.date = values.date;
    visit.revenue = values.revenue;
    normalizeAllRecords();
    saveState();
    const savedVisit = state.visits.find((item) => item.id === editingVisitId);
    resetVisitFormState();
    refs.visitResult.textContent = savedVisit
      ? `Đã cập nhật. ${formatVisitMessage(savedVisit)}`
      : "Đã cập nhật giao dịch tích điểm.";
    renderVisits();
    return;
  }

  const visitRecord = {
    id: createId("visit"),
    customerId: values.customerId,
    productId: values.productId,
    date: values.date,
    revenue: values.revenue,
    occurrence: 0,
    rate: 0,
    voucher: 0,
    createdAt: new Date().toISOString(),
  };

  state.visits.unshift(visitRecord);
  normalizeVisitMonth(values.customerId, monthOf(values.date));
  const savedVisit = state.visits.find((item) => item.id === visitRecord.id);
  saveState();

  refs.visitRevenue.value = "";
  refs.visitResult.textContent = savedVisit ? formatVisitMessage(savedVisit) : "Đã ghi nhận giao dịch tích điểm.";
  showModal(refs.visitResult.textContent);
  renderVisits();
}

async function addVisitRemote() {
  if (!ensureFeature("visits", refs.visitResult)) return;
  const values = readVisitFormValues();
  if (!values) return;

  const editingVisitId = state.editingVisitId;
  if (editingVisitId) {
    const currentUser = getCurrentUser();
    if (!canEditVisit(currentUser)) {
      refs.visitResult.textContent = "Bạn không có quyền sửa dữ liệu tích điểm voucher.";
      return;
    }

    try {
      const payload = await apiRequest(`/visits/${encodeURIComponent(editingVisitId)}`, {
        method: "PATCH",
        body: values,
      });

      if (Array.isArray(payload?.visits)) {
        state.visits = payload.visits;
      } else if (payload?.visit) {
        state.visits = state.visits.map((item) => (item.id === payload.visit.id ? payload.visit : item));
      } else {
        await syncFromServer({ preserveTab: true, silent: true });
      }

      normalizeAllRecords();
      const savedVisit = state.visits.find((item) => item.id === editingVisitId);
      resetVisitFormState();
      refs.visitResult.textContent = savedVisit
        ? `Đã cập nhật. ${formatVisitMessage(savedVisit)}`
        : "Đã cập nhật giao dịch tích điểm.";
      renderVisits();
    } catch (error) {
      handleRemoteActionError(error, refs.visitResult, "Không thể cập nhật giao dịch tích điểm.");
    }

    return;
  }

  try {
    const payload = await apiRequest("/visits", {
      method: "POST",
      body: values,
    });

    if (Array.isArray(payload?.visits)) {
      state.visits = payload.visits;
      normalizeAllRecords();
    } else if (payload?.visit) {
      state.visits.unshift(payload.visit);
      normalizeVisitMonth(values.customerId, monthOf(values.date));
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    const savedVisit = state.visits.find((item) => item.id === payload?.visit?.id) || payload?.visit;
    refs.visitRevenue.value = "";
    refs.visitResult.textContent = savedVisit ? formatVisitMessage(savedVisit) : "Đã ghi nhận giao dịch tích điểm.";
    renderVisits();
  } catch (error) {
    handleRemoteActionError(error, refs.visitResult, "Không thể ghi nhận giao dịch tích điểm.");
  }
}

function readReferralFormValues() {
  if (state.customers.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận giới thiệu.";
    return null;
  }

  if (state.products.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giới thiệu.";
    return null;
  }

  const referrerId = resolveReferrerId(refs.referrerUser, refs.referrerUserOptions);
  const referredCustomerId = resolveCustomerId(refs.referredCustomer, refs.referredCustomerOptions);
  const productId = resolveProductId(refs.referralProduct, refs.referralProductOptions);
  const date = refs.referralDate.value;
  const revenue = unformatNumber(refs.referralRevenue.value);

  if (!referredCustomerId || !productId || !date || revenue <= 0) {
    refs.referralResult.textContent = "Vui lòng nhập đủ khách được giới thiệu, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return null;
  }

  const memberIds = new Set(getMemberUsers().map((user) => user.id));
  if (referrerId && !memberIds.has(referrerId)) {
    refs.referralResult.textContent = "Người giới thiệu phải là tài khoản thành viên do quản trị viên tạo.";
    return null;
  }

  const validCustomer = state.customers.some((item) => item.id === referredCustomerId);
  const validProduct = state.products.some((item) => item.id === productId);
  if (!validCustomer || !validProduct) {
    refs.referralResult.textContent = "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.";
    return null;
  }

  return { referrerId: referrerId || "", referredCustomerId, productId, date, revenue };
}

function formatReferralMessage(referral) {
  const referredCustomerName = getCustomerName(referral.referredCustomerId);
  const productName = getProductName(referral.productId);

  if (!referral.referrerId) {
    return `Đã ghi nhận giao dịch cho ${referredCustomerName} - ${productName} (không có người giới thiệu). Hoa hồng: ${formatMoney(0)}.`;
  }

  return `${getReferrerName(referral.referrerId)} - ${referredCustomerName} - ${productName} - lần giới thiệu ${referral.occurrence} trong tháng ${monthOf(referral.date)}: ${formatPercent(referral.rate)} | Hoa hồng: ${formatMoney(referral.commission)}.`;
}

function prepareReferralEdit(referralId) {
  const currentUser = getCurrentUser();
  if (!canEditReferral(currentUser)) {
    refs.referralResult.textContent = "Bạn không có quyền sửa dữ liệu hoa hồng giới thiệu.";
    return;
  }

  const referral = state.referrals.find((item) => item.id === referralId);
  if (!referral) {
    refs.referralResult.textContent = "Không tìm thấy giao dịch hoa hồng cần chỉnh sửa.";
    return;
  }

  state.editingReferralId = referral.id;
  refs.referrerUser.value = getReferrerName(referral.referrerId);
  refs.referredCustomer.value = getCustomerName(referral.referredCustomerId);
  refs.referralProduct.value = getProductName(referral.productId);
  refs.referralDate.value = referral.date || "";
  refs.referralRevenue.value = formatNumberDisplay(referral.revenue);
  setReferralFormMode(true);
  refs.referralResult.textContent = "Đang chỉnh sửa giao dịch hoa hồng.";
}

function handleReferralTableClick(event) {
  const editButton = event.target.closest(".edit-referral-btn");
  if (editButton) {
    prepareReferralEdit(editButton.dataset.referralId || "");
    return;
  }

  const deleteButton = event.target.closest(".delete-referral-btn");
  if (!deleteButton) return;

  const currentUser = getCurrentUser();
  if (!canDeleteReferral(currentUser)) {
    refs.referralResult.textContent = "Bạn không có quyền xoá dữ liệu hoa hồng giới thiệu.";
    return;
  }

  const referralId = deleteButton.dataset.referralId || "";
  const referral = state.referrals.find((item) => item.id === referralId);
  if (!referral) {
    refs.referralResult.textContent = "Không tìm thấy giao dịch hoa hồng cần xoá.";
    return;
  }

  if (!confirmAction("Xoá giao dịch hoa hồng giới thiệu này?")) return;

  if (runtime.remoteMode) {
    void deleteReferralRemote(referralId);
    return;
  }

  state.referrals = state.referrals.filter((item) => item.id !== referralId);
  normalizeAllRecords();
  if (state.editingReferralId === referralId) {
    resetReferralFormState();
  }
  saveState();
  refs.referralResult.textContent = "Đã xoá giao dịch hoa hồng giới thiệu.";
  showModal(refs.referralResult.textContent);
  renderReferrals();
  renderReport();
}

async function deleteReferralRemote(referralId) {
  try {
    const payload = await apiRequest(`/referrals/${encodeURIComponent(referralId)}`, {
      method: "DELETE",
    });

    if (Array.isArray(payload?.referrals)) {
      state.referrals = payload.referrals;
    } else {
      state.referrals = state.referrals.filter((item) => item.id !== referralId);
    }

    normalizeAllRecords();
    if (state.editingReferralId === referralId) {
      resetReferralFormState();
    }
    refs.referralResult.textContent = "Đã xoá giao dịch hoa hồng giới thiệu.";
    renderReferrals();
    renderReport();
  } catch (error) {
    handleRemoteActionError(error, refs.referralResult, "Không thể xoá giao dịch hoa hồng giới thiệu.");
  }
}

function addReferral() {
  if (runtime.remoteMode) {
    void addReferralRemote();
    return;
  }

  if (!ensureFeature("referrals", refs.referralResult)) return;
  const values = readReferralFormValues();
  if (!values) return;

  const editingReferralId = state.editingReferralId;
  if (editingReferralId) {
    const currentUser = getCurrentUser();
    if (!canEditReferral(currentUser)) {
      refs.referralResult.textContent = "Bạn không có quyền sửa dữ liệu hoa hồng giới thiệu.";
      return;
    }

    const referral = state.referrals.find((item) => item.id === editingReferralId);
    if (!referral) {
      refs.referralResult.textContent = "Không tìm thấy giao dịch hoa hồng cần chỉnh sửa.";
      resetReferralFormState();
      return;
    }

    referral.referrerId = values.referrerId;
    referral.referredCustomerId = values.referredCustomerId;
    referral.referredName = "";
    referral.productId = values.productId;
    referral.date = values.date;
    referral.revenue = values.revenue;
    normalizeAllRecords();
    saveState();
    const savedReferral = state.referrals.find((item) => item.id === editingReferralId);
    resetReferralFormState();
    refs.referralResult.textContent = savedReferral
      ? `Đã cập nhật. ${formatReferralMessage(savedReferral)}`
      : "Đã cập nhật giao dịch hoa hồng.";
    renderReferrals();
    renderReport();
    return;
  }

  const referralRecord = {
    id: createId("ref"),
    referrerId: values.referrerId,
    referredCustomerId: values.referredCustomerId,
    referredName: "",
    productId: values.productId,
    date: values.date,
    revenue: values.revenue,
    occurrence: 0,
    rate: 0,
    commission: 0,
    createdAt: new Date().toISOString(),
  };

  state.referrals.unshift(referralRecord);
  if (values.referrerId) {
    normalizeReferralMonth(values.referrerId, monthOf(values.date));
  }

  const savedReferral = state.referrals.find((item) => item.id === referralRecord.id);
  saveState();
  refs.referralRevenue.value = "";
  refs.referredCustomer.value = "";

  refs.referralResult.textContent = savedReferral
    ? formatReferralMessage(savedReferral)
    : "Đã ghi nhận giao dịch hoa hồng.";
  showModal(refs.referralResult.textContent);
  renderReferrals();
  renderReport();
}

async function addReferralRemote() {
  if (!ensureFeature("referrals", refs.referralResult)) return;
  const values = readReferralFormValues();
  if (!values) return;

  const editingReferralId = state.editingReferralId;
  if (editingReferralId) {
    const currentUser = getCurrentUser();
    if (!canEditReferral(currentUser)) {
      refs.referralResult.textContent = "Bạn không có quyền sửa dữ liệu hoa hồng giới thiệu.";
      return;
    }

    try {
      const payload = await apiRequest(`/referrals/${encodeURIComponent(editingReferralId)}`, {
        method: "PATCH",
        body: values,
      });

      if (Array.isArray(payload?.referrals)) {
        state.referrals = payload.referrals;
      } else if (payload?.referral) {
        state.referrals = state.referrals.map((item) => (item.id === payload.referral.id ? payload.referral : item));
      } else {
        await syncFromServer({ preserveTab: true, silent: true });
      }

      normalizeAllRecords();
      const savedReferral = state.referrals.find((item) => item.id === editingReferralId);
      resetReferralFormState();
      refs.referralResult.textContent = savedReferral
        ? `Đã cập nhật. ${formatReferralMessage(savedReferral)}`
        : "Đã cập nhật giao dịch hoa hồng.";
      renderReferrals();
      renderReport();
    } catch (error) {
      handleRemoteActionError(error, refs.referralResult, "Không thể cập nhật giao dịch hoa hồng.");
    }

    return;
  }

  try {
    const payload = await apiRequest("/referrals", {
      method: "POST",
      body: values,
    });

    if (Array.isArray(payload?.referrals)) {
      state.referrals = payload.referrals;
      normalizeAllRecords();
    } else if (payload?.referral) {
      state.referrals.unshift(payload.referral);
      if (values.referrerId) {
        normalizeReferralMonth(values.referrerId, monthOf(values.date));
      }
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    const savedReferral = state.referrals.find((item) => item.id === payload?.referral?.id) || payload?.referral;
    refs.referralRevenue.value = "";
    refs.referredCustomer.value = "";
    refs.referralResult.textContent = savedReferral
      ? formatReferralMessage(savedReferral)
      : "Đã ghi nhận giao dịch hoa hồng.";
    renderReferrals();
    renderReport();
  } catch (error) {
    handleRemoteActionError(error, refs.referralResult, "Không thể ghi nhận giao dịch hoa hồng.");
  }
}

function addMemberAccount() {
  if (runtime.remoteMode) {
    void addMemberAccountRemote();
    return;
  }

  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) {
    refs.memberFormResult.textContent = "Chỉ quản trị viên mới có quyền tạo tài khoản nhân viên.";
    return;
  }

  const fullName = refs.memberFullName.value.trim();
  const username = refs.memberUsername.value.trim();
  const password = refs.memberPassword.value;

  if (!fullName || !username || !password) {
    refs.memberFormResult.textContent = "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.";
    return;
  }

  if (!/^[0-9]{8,15}$/.test(username)) {
    refs.memberFormResult.textContent = "Tên đăng nhập phải là số điện thoại 8-15 chữ số.";
    return;
  }

  const duplicated = state.users.some((user) => user.username.toLowerCase() === username.toLowerCase());
  if (duplicated) {
    refs.memberFormResult.textContent = "Tên đăng nhập đã tồn tại.";
    return;
  }

  const member = {
    id: createId("user"),
    fullName,
    username,
    password,
    role: "member",
    permissions: {
      customers: Boolean(refs.permCustomers.checked),
      customerEdit: Boolean(refs.permCustomerEdit.checked),
      products: Boolean(refs.permProducts.checked),
      productsEdit: Boolean(refs.permProductsEdit.checked),
      productsDelete: Boolean(refs.permProductsDelete.checked),
      visits: Boolean(refs.permVisits.checked),
      visitsEdit: Boolean(refs.permVisitsEdit.checked),
      visitsDelete: Boolean(refs.permVisitsDelete.checked),
      referrals: Boolean(refs.permReferrals.checked),
      referralsEdit: Boolean(refs.permReferralsEdit.checked),
      referralsDelete: Boolean(refs.permReferralsDelete.checked),
      dataCleanup: Boolean(refs.permDataCleanup.checked),
      backupData: Boolean(refs.permBackupData.checked),
      changePassword: Boolean(refs.permChangePassword.checked),
      reports: Boolean(refs.permReports.checked),
    },
    createdAt: new Date().toISOString(),
  };

  state.users.push(member);
  saveState();

  refs.memberForm.reset();
  setDefaultMemberPermissionInputs();
  refs.memberFormResult.textContent = `Đã tạo tài khoản ${username}.`;
  showModal(refs.memberFormResult.textContent);

  renderUserAccounts();
  renderReferrerOptions();
}

async function addMemberAccountRemote() {
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) {
    refs.memberFormResult.textContent = "Chỉ quản trị viên mới có quyền tạo tài khoản nhân viên.";
    return;
  }

  const fullName = refs.memberFullName.value.trim();
  const username = refs.memberUsername.value.trim();
  const password = refs.memberPassword.value;

  if (!fullName || !username || !password) {
    refs.memberFormResult.textContent = "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.";
    return;
  }

  if (!/^[0-9]{8,15}$/.test(username)) {
    refs.memberFormResult.textContent = "Tên đăng nhập phải là số điện thoại 8-15 chữ số.";
    return;
  }

  try {
    const payload = await apiRequest("/users", {
      method: "POST",
      body: {
        fullName,
        username,
        password,
        permissions: {
          customers: Boolean(refs.permCustomers.checked),
          customerEdit: Boolean(refs.permCustomerEdit.checked),
          products: Boolean(refs.permProducts.checked),
          productsEdit: Boolean(refs.permProductsEdit.checked),
          productsDelete: Boolean(refs.permProductsDelete.checked),
          visits: Boolean(refs.permVisits.checked),
          visitsEdit: Boolean(refs.permVisitsEdit.checked),
          visitsDelete: Boolean(refs.permVisitsDelete.checked),
          referrals: Boolean(refs.permReferrals.checked),
          referralsEdit: Boolean(refs.permReferralsEdit.checked),
          referralsDelete: Boolean(refs.permReferralsDelete.checked),
          dataCleanup: Boolean(refs.permDataCleanup.checked),
          backupData: Boolean(refs.permBackupData.checked),
          changePassword: Boolean(refs.permChangePassword.checked),
          reports: Boolean(refs.permReports.checked),
        },
      },
    });

    if (payload?.user) {
      state.users.push(normalizeUser(payload.user));
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    refs.memberForm.reset();
    setDefaultMemberPermissionInputs();
    refs.memberFormResult.textContent = `Đã tạo tài khoản ${username}.`;
    showModal(refs.memberFormResult.textContent);

    renderUserAccounts();
    renderReferrerOptions();
  } catch (error) {
    handleRemoteActionError(error, refs.memberFormResult, "Không thể tạo tài khoản thành viên.");
  }
}

function handleUserTableClick(event) {
  if (runtime.remoteMode) {
    void handleUserTableClickRemote(event);
    return;
  }

  const deleteBtn = event.target.closest(".delete-member-btn");
  if (deleteBtn) {
    deleteMemberAccount(deleteBtn.dataset.userId || "");
    return;
  }

  const resetBtn = event.target.closest(".reset-password-btn");
  if (resetBtn) {
    resetMemberPassword(resetBtn.dataset.userId || "");
    return;
  }

  const button = event.target.closest(".save-permissions-btn");
  if (!button) return;

  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) return;

  const userId = button.dataset.userId;
  const member = state.users.find((item) => item.id === userId && item.role === "member");
  if (!member) return;

  const row = button.closest("tr");
  if (!row) return;

  const nextPermissions = MEMBER_PERMISSION_KEYS.reduce((result, key) => {
    const input = row.querySelector(`input.permission-toggle[data-permission=\"${key}\"]`);
    result[key] = Boolean(input && input.checked);
    return result;
  }, {});

  const lockedInput = row.querySelector(`input.lock-toggle[data-user-id=\"${userId}\"]`);
  const locked = Boolean(lockedInput && lockedInput.checked);

  member.permissions = buildMemberPermissions(nextPermissions);
  member.locked = locked;
  saveState();

  refs.memberFormResult.textContent = `Đã cập nhật quyền cho ${member.username}.`;
  showModal(refs.memberFormResult.textContent);
  renderUserAccounts();
}

async function handleUserTableClickRemote(event) {
  const button = event.target.closest(".save-permissions-btn");
  const deleteBtn = event.target.closest(".delete-member-btn");
  const resetBtn = event.target.closest(".reset-password-btn");
  if (!button && !deleteBtn && !resetBtn) return;

  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) return;

  const userId = (button || deleteBtn || resetBtn).dataset.userId;
  const member = state.users.find((item) => item.id === userId && item.role === "member");
  if (!member) return;

  if (deleteBtn) {
    await deleteMemberAccountRemote(userId);
    return;
  }

  if (resetBtn) {
    await resetMemberPasswordRemote(userId);
    return;
  }

  const row = button.closest("tr");
  if (!row) return;

  const nextPermissions = MEMBER_PERMISSION_KEYS.reduce((result, key) => {
    const input = row.querySelector(`input.permission-toggle[data-permission=\"${key}\"]`);
    result[key] = Boolean(input && input.checked);
    return result;
  }, {});

  const lockedInput = row.querySelector(`input.lock-toggle[data-user-id=\"${userId}\"]`);
  const locked = Boolean(lockedInput && lockedInput.checked);

  try {
    const payload = await apiRequest(`/users/${encodeURIComponent(userId)}/permissions`, {
      method: "PATCH",
      body: { permissions: { ...nextPermissions, locked } },
    });

    if (payload?.user) {
      member.permissions = buildMemberPermissions(payload.user.permissions);
      member.locked = Boolean(payload.user.locked);
    } else {
      member.permissions = buildMemberPermissions(nextPermissions);
      member.locked = locked;
    }

    refs.memberFormResult.textContent = `Đã cập nhật quyền cho ${member.username}.`;
    showModal(refs.memberFormResult.textContent);
    renderUserAccounts();
  } catch (error) {
    handleRemoteActionError(error, refs.memberFormResult, "Không thể cập nhật quyền tài khoản.");
  }
}

function deleteMemberAccount(userId) {
  if (!userId) return;
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) return;

  const member = state.users.find((item) => item.id === userId && item.role === "member");
  if (!member) {
    refs.memberFormResult.textContent = "Không tìm thấy tài khoản cần xoá.";
    return;
  }

  const accepted = confirmAction(`Xoá tài khoản ${member.username}? Thao tác này không thể hoàn tác.`);
  if (!accepted) return;

  if (runtime.remoteMode) {
    void deleteMemberAccountRemote(userId);
    return;
  }

  applyMemberDeletion(userId, member.username);
}

function applyMemberDeletion(userId, username) {
  state.users = state.users.filter((item) => item.id !== userId);
  state.referrals = state.referrals.map((item) =>
    item.referrerId === userId ? { ...item, referrerId: "", occurrence: 0, rate: 0, commission: 0 } : item,
  );
  normalizeAllRecords();
  saveState();
  refs.memberFormResult.textContent = `Đã xoá tài khoản ${username}.`;
  showModal(refs.memberFormResult.textContent);
  renderUserAccounts();
  renderReferrals();
  renderReport();
}

async function deleteMemberAccountRemote(userId) {
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    await syncFromServer({ preserveTab: true, silent: true });
    refs.memberFormResult.textContent = "Đã xoá tài khoản.";
    showModal(refs.memberFormResult.textContent);
    renderUserAccounts();
    renderReferrals();
    renderReport();
  } catch (error) {
    handleRemoteActionError(error, refs.memberFormResult, "Không thể xoá tài khoản thành viên.");
  }
}

function resetMemberPassword(userId) {
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) return;
  const member = state.users.find((item) => item.id === userId && item.role === "member");
  if (!member) {
    refs.memberFormResult.textContent = "Không tìm thấy tài khoản cần đặt lại mật khẩu.";
    return;
  }

  const nextPassword = prompt(`Nhập mật khẩu mới cho ${member.username}:`, "");
  if (!nextPassword || nextPassword.length < 6) {
    refs.memberFormResult.textContent = "Mật khẩu mới phải có tối thiểu 6 ký tự.";
    return;
  }

  if (runtime.remoteMode) {
    void resetMemberPasswordRemote(userId, nextPassword);
    return;
  }

  member.password = nextPassword;
  saveState();
  refs.memberFormResult.textContent = `Đã đặt lại mật khẩu cho ${member.username}.`;
  showModal(refs.memberFormResult.textContent);
}

async function resetMemberPasswordRemote(userId, nextPassword) {
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { nextPassword },
    });
    await syncFromServer({ preserveTab: true, silent: true });
    refs.memberFormResult.textContent = "Đã đặt lại mật khẩu.";
    showModal(refs.memberFormResult.textContent);
  } catch (error) {
    handleRemoteActionError(error, refs.memberFormResult, "Không thể đặt lại mật khẩu.");
  }
}

function renderAll() {
  renderCustomerOptions();
  renderProductOptions();
  renderReferrerOptions();
  renderCustomers();
  renderProducts();
  renderVisits();
  renderReferrals();
  renderReport();
  renderUserAccounts();
}

function renderCustomerOptions() {
  const prevVisitValue = refs.visitCustomer.value;
  const prevReferredValue = refs.referredCustomer.value;
  const options = state.customers
    .map(
      (customer) =>
        `<option data-id="${escapeHtml(customer.id)}" value="${escapeHtml(customer.name)}${customer.phone ? ` - ${escapeHtml(customer.phone)}` : ""}"></option>`,
    )
    .join("");

  refs.visitCustomerOptions.innerHTML = options;
  refs.referredCustomerOptions.innerHTML = options;

  refs.visitCustomer.value = prevVisitValue;
  refs.referredCustomer.value = prevReferredValue;
}

function renderProductOptions() {
  const prevVisitProduct = refs.visitProduct.value;
  const prevReferralProduct = refs.referralProduct.value;
  const options = state.products
    .map(
      (product) =>
        `<option data-id="${escapeHtml(product.id)}" value="${escapeHtml(product.name)}${product.code ? ` (${escapeHtml(product.code)})` : ""}"></option>`,
    )
    .join("");

  refs.visitProductOptions.innerHTML = options;
  refs.referralProductOptions.innerHTML = options;

  refs.visitProduct.value = prevVisitProduct;
  refs.referralProduct.value = prevReferralProduct;
}

function renderReferrerOptions() {
  const prevReferrerValue = refs.referrerUser.value;
  const options = getMemberUsers()
    .map(
      (member) =>
        `<option data-id="${escapeHtml(member.id)}" value="${escapeHtml(member.fullName)} (${escapeHtml(member.username)})"></option>`,
    )
    .join("");

  refs.referrerUserOptions.innerHTML = options;

  refs.referrerUser.value = prevReferrerValue;
}

function renderCustomers() {
  const currentUser = getCurrentUser();
  const canEdit = canEditCustomerInfo(currentUser);
  const canDelete = canDeleteCustomer(currentUser);

  const query = normalizeTextValue(refs.customerSearch?.value || "");
  const rows = state.customers.filter((item) => {
    if (!query) return true;
    const haystack = normalizeTextValue(
      `${item.name || ""} ${item.phone || ""} ${item.email || ""} ${item.note || ""}`,
    );
    return haystack.includes(query);
  });

  if (rows.length === 0) {
    refs.customerTableBody.innerHTML = '<tr><td class="empty-cell" colspan="6">Chưa có khách hàng nào.</td></tr>';
    return;
  }

  refs.customerTableBody.innerHTML = rows
    .map(
      (item) => {
        const actions = [];
        if (canEdit) {
          actions.push(
            `<button type="button" class="secondary-btn table-btn edit-customer-btn" data-customer-id="${escapeHtml(item.id)}">Sửa</button>`,
          );
        }

        if (canDelete) {
          actions.push(
            `<button type="button" class="secondary-btn table-btn delete-customer-btn" data-customer-id="${escapeHtml(item.id)}">Xoá</button>`,
          );
        }

        return `
      <tr>
        <td><button type="button" class="link-btn customer-name-btn" data-customer-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button></td>
        <td>${escapeHtml(item.phone || "-")}</td>
        <td>${escapeHtml(item.email || "-")}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td>${new Date(item.createdAt).toLocaleString("vi-VN")}</td>
        <td>${actions.length ? actions.join(" ") : "-"}</td>
      </tr>
    `;
      },
    )
    .join("");
}

function renderProducts() {
  const currentUser = getCurrentUser();
  const canEdit = canEditProduct(currentUser);
  const canDelete = canDeleteProduct(currentUser);

  if (state.products.length === 0) {
    refs.productTableBody.innerHTML = '<tr><td class="empty-cell" colspan="6">Chưa có sản phẩm/dịch vụ nào.</td></tr>';
    return;
  }

  refs.productTableBody.innerHTML = state.products
    .map(
      (item) => {
        const actions = [];
        if (canEdit) {
          actions.push(
            `<button type="button" class="secondary-btn table-btn edit-product-btn" data-product-id="${escapeHtml(item.id)}">Sửa</button>`,
          );
        }

        if (canDelete) {
          actions.push(
            `<button type="button" class="secondary-btn table-btn delete-product-btn" data-product-id="${escapeHtml(item.id)}">Xoá</button>`,
          );
        }

        return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.code || "-")}</td>
        <td>${item.defaultPrice > 0 ? formatMoney(item.defaultPrice) : "-"}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td>${actions.length ? actions.join(" ") : "-"}</td>
        <td>${new Date(item.createdAt).toLocaleString("vi-VN")}</td>
      </tr>
    `;
      },
    )
    .join("");
}

function renderVisits() {
  const currentUser = getCurrentUser();
  const canEdit = canEditVisit(currentUser);
  const canDelete = canDeleteVisit(currentUser);
  const selectedMonth = refs.visitMonthFilter.value;
  const query = normalizeTextValue(refs.visitSearch?.value || "");
  let filtered = selectedMonth ? state.visits.filter((item) => monthOf(item.date) === selectedMonth) : state.visits;
  if (query) {
    filtered = filtered.filter((item) => normalizeTextValue(getCustomerName(item.customerId)).includes(query));
  }
  const rows = [...filtered].sort(sortByLatest);

  if (rows.length === 0) {
    refs.visitTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Chưa có giao dịch phù hợp tháng lọc.</td></tr>';
  } else {
    refs.visitTableBody.innerHTML = rows
      .map(
        (item) => {
          const actions = [];
          if (canEdit) {
            actions.push(
              `<button type="button" class="secondary-btn table-btn edit-visit-btn" data-visit-id="${escapeHtml(item.id)}">Sửa</button>`,
            );
          }

          if (canDelete) {
            actions.push(
              `<button type="button" class="secondary-btn table-btn delete-visit-btn" data-visit-id="${escapeHtml(item.id)}">Xoá</button>`,
            );
          }

          return `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(getCustomerName(item.customerId))}</td>
          <td>${escapeHtml(getProductName(item.productId))}</td>
          <td>Lần ${item.occurrence}</td>
          <td>${formatPercent(item.rate)}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.voucher)}</td>
          <td>${actions.length ? actions.join(" ") : "-"}</td>
        </tr>
      `;
        },
      )
      .join("");
  }

  const totalRevenue = filtered.reduce((sum, item) => sum + item.revenue, 0);
  const totalVoucher = filtered.reduce((sum, item) => sum + item.voucher, 0);

  refs.visitSummary.innerHTML = `
    <div class="summary-chip">
      <p>Số lượt</p>
      <strong>${filtered.length}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng doanh thu</p>
      <strong>${formatMoney(totalRevenue)}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng voucher tích điểm</p>
      <strong>${formatMoney(totalVoucher)}</strong>
    </div>
  `;
}

function renderReferrals() {
  const currentUser = getCurrentUser();
  const canEdit = canEditReferral(currentUser);
  const canDelete = canDeleteReferral(currentUser);
  const selectedMonth = refs.referralMonthFilter.value;
  const query = normalizeTextValue(refs.referralSearch?.value || "");
  let filtered = selectedMonth ? state.referrals.filter((item) => monthOf(item.date) === selectedMonth) : state.referrals;
  if (query) {
    filtered = filtered.filter((item) => normalizeTextValue(getReferrerName(item.referrerId)).includes(query));
  }
  const rows = [...filtered].sort(sortByLatest);

  if (rows.length === 0) {
    refs.referralTableBody.innerHTML = '<tr><td class="empty-cell" colspan="9">Chưa có giao dịch phù hợp tháng lọc.</td></tr>';
  } else {
    refs.referralTableBody.innerHTML = rows
      .map(
        (item) => {
          const actions = [];
          if (canEdit) {
            actions.push(
              `<button type="button" class="secondary-btn table-btn edit-referral-btn" data-referral-id="${escapeHtml(item.id)}">Sửa</button>`,
            );
          }

          if (canDelete) {
            actions.push(
              `<button type="button" class="secondary-btn table-btn delete-referral-btn" data-referral-id="${escapeHtml(item.id)}">Xoá</button>`,
            );
          }

          return `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(getReferrerName(item.referrerId))}</td>
          <td>${escapeHtml(getReferredCustomerDisplay(item))}</td>
          <td>${escapeHtml(getProductName(item.productId))}</td>
          <td>${item.referrerId ? `Lần ${item.occurrence}` : "-"}</td>
          <td>${item.referrerId ? formatPercent(item.rate) : "0%"}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.commission)}</td>
          <td>${actions.length ? actions.join(" ") : "-"}</td>
        </tr>
      `;
        },
      )
      .join("");
  }

  const totalRevenue = filtered.reduce((sum, item) => sum + item.revenue, 0);
  const totalCommission = filtered.reduce((sum, item) => sum + item.commission, 0);
  const totalWithReferrer = filtered.filter((item) => item.referrerId).length;

  refs.referralSummary.innerHTML = `
    <div class="summary-chip">
      <p>Tổng lượt ghi nhận</p>
      <strong>${filtered.length}</strong>
    </div>
    <div class="summary-chip">
      <p>Lượt có người giới thiệu</p>
      <strong>${totalWithReferrer}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng doanh thu</p>
      <strong>${formatMoney(totalRevenue)}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng hoa hồng</p>
      <strong>${formatMoney(totalCommission)}</strong>
    </div>
  `;
}

function renderReport() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    refs.reportSummary.innerHTML = "";
    refs.reportTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Vui lòng đăng nhập.</td></tr>';
    return;
  }

  const selectedMonth = refs.reportMonthFilter.value;
  let filtered = state.referrals.filter((item) => item.referrerId);

  if (!isAdmin(currentUser)) {
    filtered = filtered.filter((item) => item.referrerId === currentUser.id);
  }

  if (selectedMonth) {
    filtered = filtered.filter((item) => monthOf(item.date) === selectedMonth);
  }

  const rows = [...filtered].sort(sortByLatest);

  if (rows.length === 0) {
    refs.reportTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Chưa có dữ liệu hoa hồng phù hợp tháng lọc.</td></tr>';
  } else {
    refs.reportTableBody.innerHTML = rows
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(getReferrerName(item.referrerId))}</td>
          <td>${escapeHtml(getReferredCustomerDisplay(item))}</td>
          <td>${escapeHtml(getProductName(item.productId))}</td>
          <td>Lần ${item.occurrence}</td>
          <td>${formatPercent(item.rate)}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.commission)}</td>
        </tr>
      `,
      )
      .join("");
  }

  const totalRevenue = filtered.reduce((sum, item) => sum + item.revenue, 0);
  const totalCommission = filtered.reduce((sum, item) => sum + item.commission, 0);
  const uniqueCustomers = new Set(filtered.map((item) => item.referredCustomerId || item.referredName)).size;

  refs.reportSummary.innerHTML = `
    <div class="summary-chip">
      <p>Số giao dịch nhận hoa hồng</p>
      <strong>${filtered.length}</strong>
    </div>
    <div class="summary-chip">
      <p>Khách được giới thiệu</p>
      <strong>${uniqueCustomers}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng doanh thu tham chiếu</p>
      <strong>${formatMoney(totalRevenue)}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng hoa hồng nhận</p>
      <strong>${formatMoney(totalCommission)}</strong>
    </div>
  `;
}

function showCustomerHistory(customerId) {
  if (!customerId || !refs.historyContent) return;
  const customer = state.customers.find((item) => item.id === customerId);
  const title = customer ? `Lịch sử dịch vụ của ${customer.name}` : "Lịch sử dịch vụ";
  if (refs.historyTitle) {
    refs.historyTitle.textContent = title;
  }

  const visits = state.visits
    .filter((item) => item.customerId === customerId)
    .sort(sortByLatest);

  if (visits.length === 0) {
    refs.historyContent.innerHTML = "<p>Chưa có giao dịch tích điểm voucher cho khách này.</p>";
    showHistoryModal();
    return;
  }

  const rows = visits
    .map(
      (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(getProductName(item.productId))}</td>
          <td>Lần ${item.occurrence}</td>
          <td>${formatPercent(item.rate)}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.voucher)}</td>
        </tr>
      `,
    )
    .join("");

  refs.historyContent.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Sản phẩm / dịch vụ</th>
          <th>Lần</th>
          <th>Tỷ lệ</th>
          <th>Doanh thu</th>
          <th>Voucher</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  showHistoryModal();
}

function renderUserAccounts() {
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) {
    refs.userTableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="22">Chỉ quản trị viên được xem danh sách tài khoản.</td></tr>';
    return;
  }

  const users = [...state.users].sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, "vi");
  });

  refs.userTableBody.innerHTML = users
    .map((user) => {
      const createdAt = new Date(user.createdAt).toLocaleString("vi-VN");
      const permissions = buildMemberPermissions(user.permissions);
      const deleteButtonCell =
        user.role === "member"
          ? `<button type="button" class="secondary-btn table-btn delete-member-btn" data-user-id="${escapeHtml(user.id)}">Xoá</button>`
          : "-";
      const resetButtonCell =
        user.role === "member"
          ? `<button type="button" class="secondary-btn table-btn reset-password-btn" data-user-id="${escapeHtml(user.id)}">Đặt lại mật khẩu</button>`
          : "-";

      if (user.role === "admin") {
        return `
          <tr>
            <td>${escapeHtml(user.fullName)} (Quản trị viên)</td>
            <td>${escapeHtml(user.username)}</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>${resetButtonCell}</td>
            <td>${deleteButtonCell}</td>
            <td>-</td>
            <td>${createdAt}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.username)}</td>
          ${renderPermissionCheckbox(user.id, "customers", permissions.customers)}
          ${renderPermissionCheckbox(user.id, "customerEdit", permissions.customerEdit)}
          ${renderPermissionCheckbox(user.id, "products", permissions.products)}
          ${renderPermissionCheckbox(user.id, "productsEdit", permissions.productsEdit)}
          ${renderPermissionCheckbox(user.id, "productsDelete", permissions.productsDelete)}
          ${renderPermissionCheckbox(user.id, "visits", permissions.visits)}
          ${renderPermissionCheckbox(user.id, "visitsEdit", permissions.visitsEdit)}
          ${renderPermissionCheckbox(user.id, "visitsDelete", permissions.visitsDelete)}
          ${renderPermissionCheckbox(user.id, "referrals", permissions.referrals)}
          ${renderPermissionCheckbox(user.id, "referralsEdit", permissions.referralsEdit)}
          ${renderPermissionCheckbox(user.id, "referralsDelete", permissions.referralsDelete)}
          ${renderPermissionCheckbox(user.id, "dataCleanup", permissions.dataCleanup)}
          ${renderPermissionCheckbox(user.id, "backupData", permissions.backupData)}
          <td><input type="checkbox" class="lock-toggle" data-user-id="${escapeHtml(user.id)}" ${user.locked ? "checked" : ""} /></td>
          ${renderPermissionCheckbox(user.id, "changePassword", permissions.changePassword)}
          ${renderPermissionCheckbox(user.id, "reports", permissions.reports)}
          <td>${resetButtonCell}</td>
          <td>${deleteButtonCell}</td>
          <td><button type="button" class="secondary-btn table-btn save-permissions-btn" data-user-id="${escapeHtml(user.id)}">Lưu</button></td>
          <td>${createdAt}</td>
        </tr>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPermissionCheckbox(userId, key, checked) {
  return `<td><input type="checkbox" class="permission-toggle" data-user-id="${escapeHtml(
    userId,
  )}" data-permission="${escapeHtml(key)}" ${checked ? "checked" : ""} /></td>`;
}

function sortByDateThenCreatedAtAsc(a, b) {
  const byDate = (a.date || "").localeCompare(b.date || "");
  if (byDate !== 0) return byDate;
  return (a.createdAt || "").localeCompare(b.createdAt || "");
}

function sortByLatest(a, b) {
  const byDate = (b.date || "").localeCompare(a.date || "");
  if (byDate !== 0) return byDate;
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

function normalizeVisitMonth(customerId, targetMonth) {
  const rows = state.visits
    .filter((item) => item.customerId === customerId && monthOf(item.date) === targetMonth)
    .sort(sortByDateThenCreatedAtAsc);

  rows.forEach((item, index) => {
    const occurrence = index + 1;
    const rate = getRateByOccurrence(occurrence);
    item.occurrence = occurrence;
    item.rate = rate;
    item.voucher = item.revenue * rate;
  });
}

function normalizeReferralMonth(referrerId, targetMonth) {
  if (!referrerId) return;

  const rows = state.referrals
    .filter((item) => item.referrerId === referrerId && monthOf(item.date) === targetMonth)
    .sort(sortByDateThenCreatedAtAsc);

  rows.forEach((item, index) => {
    const occurrence = index + 1;
    const rate = getRateByOccurrence(occurrence);
    item.occurrence = occurrence;
    item.rate = rate;
    item.commission = item.revenue * rate;
  });
}

function normalizeAllRecords() {
  state.customers = state.customers.filter((item) => item && typeof item === "object");
  state.visits = state.visits.filter((item) => item && typeof item === "object");
  state.referrals = state.referrals.filter((item) => item && typeof item === "object");

  state.products = state.products
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("prd"),
      name: typeof item.name === "string" ? item.name : "",
      code: typeof item.code === "string" ? item.code : "",
      defaultPrice: Number(item.defaultPrice) > 0 ? Number(item.defaultPrice) : 0,
      note: typeof item.note === "string" ? item.note : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    }))
    .filter((item) => item.name);

  state.visits.forEach((item) => {
    if (typeof item.productId !== "string") {
      item.productId = "";
    }
  });

  state.referrals.forEach((item) => {
    if (typeof item.referrerId !== "string") item.referrerId = "";
    if (typeof item.referredCustomerId !== "string") item.referredCustomerId = "";
    if (typeof item.referredName !== "string") item.referredName = "";
    if (typeof item.productId !== "string") item.productId = "";

    if (!item.referrerId) {
      item.occurrence = 0;
      item.rate = 0;
      item.commission = 0;
    }
  });

  if (state.editingCustomerId && !state.customers.some((item) => item.id === state.editingCustomerId)) {
    state.editingCustomerId = null;
  }

  if (state.editingProductId && !state.products.some((item) => item.id === state.editingProductId)) {
    state.editingProductId = null;
  }

  if (state.editingVisitId && !state.visits.some((item) => item.id === state.editingVisitId)) {
    state.editingVisitId = null;
  }

  if (state.editingReferralId && !state.referrals.some((item) => item.id === state.editingReferralId)) {
    state.editingReferralId = null;
  }

  const visitGroups = new Set(state.visits.map((item) => `${item.customerId}|${monthOf(item.date)}`));
  visitGroups.forEach((groupKey) => {
    const [customerId, month] = groupKey.split("|");
    normalizeVisitMonth(customerId, month);
  });

  const referralGroups = new Set(
    state.referrals.filter((item) => item.referrerId).map((item) => `${item.referrerId}|${monthOf(item.date)}`),
  );

  referralGroups.forEach((groupKey) => {
    const [referrerId, month] = groupKey.split("|");
    normalizeReferralMonth(referrerId, month);
  });
}

void initialize();
