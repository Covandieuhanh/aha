const STORAGE_KEY = "aha-crm-v1";
const SESSION_KEY = "aha-crm-session-v1";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const AUTO_SYNC_INTERVAL_MS = 5000;
const MAX_FINANCE_RECEIPT_SIZE_BYTES = 2 * 1024 * 1024;
const FINANCE_EXPENSE_CATEGORIES = {
  ADS: "Ads",
  OPERATIONS: "Vận hành",
  OTHER: "Khác",
};
const FINANCE_TYPE_IN = "NHAP";
const FINANCE_TYPE_OUT = "XUAT";

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

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const TAB_FEATURE_MAP = {
  customers: "customers",
  products: "products",
  visits: "visits",
  referrals: "referrals",
  reports: "reports",
  finance: "finance",
  maintenance: "dataCleanup",
  account: "changePassword",
  users: "manageUsers",
};

const SUPPRESSED_TABS = new Set(["referrals"]);

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
  "finance",
  "financeFund",
  "dataCleanup",
  "backupData",
  "changePassword",
  "reports",
  "reportsAll",
];

const state = {
  customers: [],
  products: [],
  visits: [],
  referrals: [],
  financeTransactions: [],
  users: [],
  currentUserId: null,
  editingCustomerId: null,
  editingProductId: null,
  editingVisitId: null,
  editingReferralId: null,
  financeSelectedUserId: "",
  financeExpenseFormOpen: false,
  financePendingReceipt: null,
  financeVisibleRows: [],
  activeTab: "",
  pushPermission: "default",
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
  pushBtn: document.getElementById("push-btn"),
  pushStatus: document.getElementById("push-status"),
  pushHint: document.getElementById("push-hint"),

  tabs: document.querySelectorAll(".tab-btn"),
  tabSelector: document.getElementById("tab-selector"),
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
  visitReferrerGroup: document.getElementById("visit-referrer-group"),
  visitReferrer: document.getElementById("visit-referrer"),
  visitReferrerOptions: document.getElementById("visit-referrer-options"),
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
  reportSearch: document.getElementById("report-search"),
  reportSearchOptions: document.getElementById("report-search-options"),
  reportSummary: document.getElementById("report-summary"),
  reportVisitSummary: document.getElementById("report-visit-summary"),
  reportTableBody: document.getElementById("report-table-body"),
  reportVisitTableBody: document.getElementById("report-visit-table-body"),
  reportCustomerSearch: document.getElementById("report-customer-search"),
  reportCustomerSearchOptions: document.getElementById("report-customer-search-options"),
  reportCustomerHistoryBody: document.getElementById("report-customer-history-body"),

  financeForm: document.getElementById("finance-form"),
  financeRoleDesc: document.getElementById("finance-role-desc"),
  financeOpenExpenseBtn: document.getElementById("finance-open-expense-btn"),
  financeCancelBtn: document.getElementById("finance-cancel-btn"),
  financeSubmitBtn: document.getElementById("finance-submit-btn"),
  financeUserGroup: document.getElementById("finance-user-group"),
  financeUser: document.getElementById("finance-user"),
  financeUserOptions: document.getElementById("finance-user-options"),
  financeTypeGroup: document.getElementById("finance-type-group"),
  financeType: document.getElementById("finance-type"),
  financeAmount: document.getElementById("finance-amount"),
  financeDate: document.getElementById("finance-date"),
  financeCategoryGroup: document.getElementById("finance-category-group"),
  financeCategory: document.getElementById("finance-category"),
  financeNote: document.getElementById("finance-note"),
  financeReceiptGroup: document.getElementById("finance-receipt-group"),
  financeReceipt: document.getElementById("finance-receipt"),
  financeReceiptPreview: document.getElementById("finance-receipt-preview"),
  financeResult: document.getElementById("finance-result"),
  financeAdminStaffPanel: document.getElementById("finance-admin-staff-panel"),
  financeAdminReportPanel: document.getElementById("finance-admin-report-panel"),
  financeReportTitle: document.getElementById("finance-report-title"),
  financeReportDesc: document.getElementById("finance-report-desc"),
  financeReportUserGroup: document.getElementById("finance-report-user-group"),
  financeStaffBody: document.getElementById("finance-staff-body"),
  financeReportUser: document.getElementById("finance-report-user"),
  financeReportGroup: document.getElementById("finance-report-group"),
  financeReportFrom: document.getElementById("finance-report-from"),
  financeReportTo: document.getElementById("finance-report-to"),
  financeReportSummary: document.getElementById("finance-report-summary"),
  financeReportTableBody: document.getElementById("finance-report-table-body"),
  financeHistoryTitle: document.getElementById("finance-history-title"),
  financeBalance: document.getElementById("finance-balance"),
  financeSummary: document.getElementById("finance-summary"),
  financeSearchNote: document.getElementById("finance-search-note"),
  financeSearchAmount: document.getElementById("finance-search-amount"),
  financeExportCsvBtn: document.getElementById("finance-export-csv-btn"),
  financeTableHead: document.getElementById("finance-table-head"),
  financeTableBody: document.getElementById("finance-table-body"),

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
  permFinance: document.getElementById("perm-finance"),
  permFinanceFund: document.getElementById("perm-finance-fund"),
  permReferrals: document.getElementById("perm-referrals"),
  permReferralsEdit: document.getElementById("perm-referrals-edit"),
  permReferralsDelete: document.getElementById("perm-referrals-delete"),
  permDataCleanup: document.getElementById("perm-data-cleanup"),
  permBackupData: document.getElementById("perm-backup-data"),
  permChangePassword: document.getElementById("perm-change-password"),
  permReports: document.getElementById("perm-reports"),
  permReportsAll: document.getElementById("perm-reports-all"),
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
  updatePushUI();
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

  if (refs.tabSelector) {
    refs.tabSelector.addEventListener("change", (event) => {
      const tabId = event.target.value;
      if (!canAccessTab(tabId)) return;
      setActiveTab(tabId);
    });
  }

  refs.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleLogin();
  });

  refs.logoutBtn.addEventListener("click", () => {
    handleLogout();
  });
  if (refs.pushBtn) {
    refs.pushBtn.addEventListener("click", () => {
      void handlePushButton();
    });
  }

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

  if (refs.financeForm) {
    refs.financeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addFinanceTransaction();
    });
  }
  if (refs.financeOpenExpenseBtn) {
    refs.financeOpenExpenseBtn.addEventListener("click", () => {
      state.financeExpenseFormOpen = true;
      renderFinance();
      if (refs.financeAmount) refs.financeAmount.focus();
    });
  }
  if (refs.financeCancelBtn) {
    refs.financeCancelBtn.addEventListener("click", () => {
      state.financeExpenseFormOpen = false;
      if (refs.financeForm) refs.financeForm.classList.add("hidden");
      if (refs.financeAmount) refs.financeAmount.value = "";
      if (refs.financeDate) refs.financeDate.value = "";
      if (refs.financeNote) refs.financeNote.value = "";
      clearFinanceReceiptSelection();
      renderFinance();
    });
  }
  if (refs.financeReceipt) {
    refs.financeReceipt.addEventListener("change", () => {
      void handleFinanceReceiptFileChange();
    });
  }
  if (refs.financeUser) {
    refs.financeUser.addEventListener("input", renderFinance);
    refs.financeUser.addEventListener("change", renderFinance);
  }
  if (refs.financeType) {
    refs.financeType.addEventListener("change", () => {
      refs.financeType.dataset.touched = "true";
      renderFinance();
    });
  }
  if (refs.financeSearchNote) {
    refs.financeSearchNote.addEventListener("input", renderFinance);
  }
  if (refs.financeSearchAmount) {
    refs.financeSearchAmount.addEventListener("input", renderFinance);
  }
  if (refs.financeExportCsvBtn) {
    refs.financeExportCsvBtn.addEventListener("click", exportFinanceVisibleRowsCsv);
  }
  if (refs.financeReportUser) {
    refs.financeReportUser.addEventListener("change", renderFinance);
  }
  if (refs.financeReportGroup) {
    refs.financeReportGroup.addEventListener("change", renderFinance);
  }
  if (refs.financeReportFrom) {
    refs.financeReportFrom.addEventListener("change", renderFinance);
  }
  if (refs.financeReportTo) {
    refs.financeReportTo.addEventListener("change", renderFinance);
  }
  if (refs.financeStaffBody) {
    refs.financeStaffBody.addEventListener("click", (event) => {
      const button = event.target.closest(".finance-view-history-btn");
      const row = event.target.closest("tr[data-user-id]");
      const userId = (button?.dataset.userId || row?.dataset.userId || "").trim();
      if (!userId) return;
      state.financeSelectedUserId = userId;
      renderFinance();
    });
  }

  refs.visitMonthFilter.addEventListener("change", renderVisits);
  if (refs.visitSearch) {
    refs.visitSearch.addEventListener("input", renderVisits);
  }
  refs.referralMonthFilter.addEventListener("change", renderReferrals);
  if (refs.referralSearch) {
    refs.referralSearch.addEventListener("input", renderReferrals);
  }
  refs.reportMonthFilter.addEventListener("change", renderReport);
  if (refs.reportSearch) {
    refs.reportSearch.addEventListener("input", renderReport);
  }
  if (refs.reportCustomerSearch) {
    refs.reportCustomerSearch.addEventListener("input", renderReportCustomerHistory);
  }
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
  refs.userTableBody.addEventListener("change", handleUserTableChange);

  refs.permVisits.addEventListener("change", syncMemberCreateServicePermissions);
  refs.permVisitsEdit.addEventListener("change", syncMemberCreateServicePermissions);
  refs.permVisitsDelete.addEventListener("change", syncMemberCreateServicePermissions);

  if (refs.modalOkBtn) {
    refs.modalOkBtn.addEventListener("click", hideModal);
  }
  if (refs.historyCloseBtn) {
    refs.historyCloseBtn.addEventListener("click", hideHistoryModal);
  }

  bindNumericFormatter(refs.productDefaultPrice);
  bindNumericFormatter(refs.visitRevenue);
  bindNumericFormatter(refs.referralRevenue);
  bindNumericFormatter(refs.financeAmount);
  bindNumericFormatter(refs.financeSearchAmount);
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
  if (refs.financeDate) refs.financeDate.value = "";
  if (refs.financeReportFrom) refs.financeReportFrom.value = `${thisMonth}-01`;
  if (refs.financeReportTo) refs.financeReportTo.value = today;
  if (refs.financeReportGroup) refs.financeReportGroup.value = "day";
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
  refs.permFinance.checked = false;
  refs.permFinanceFund.checked = false;
  refs.permReferrals.checked = false;
  refs.permReferralsEdit.checked = false;
  refs.permReferralsDelete.checked = false;
  refs.permDataCleanup.checked = false;
  refs.permBackupData.checked = false;
  refs.permChangePassword.checked = false;
  refs.permReports.checked = true;
  refs.permReportsAll.checked = false;
  syncMemberCreateServicePermissions();
}

function renderRuntimeMode() {
  if (!refs.runtimeMode) return;

  refs.runtimeMode.textContent = runtime.remoteMode ? "Chế độ: Máy chủ dùng chung" : "Chế độ: Một máy cục bộ";
}

function updatePushUI() {
  if (!refs.pushBtn || !refs.pushStatus) return;
  const supported = isPushSupported() && runtime.remoteMode;

  if (!supported) {
    refs.pushBtn.classList.add("hidden");
    refs.pushStatus.textContent = "Thiết bị không hỗ trợ thông báo nền.";
    return;
  }

  const permission = Notification.permission;
  state.pushPermission = permission;

  if (permission === "granted") {
    refs.pushStatus.textContent = "Đã bật thông báo";
    refs.pushBtn.textContent = "Gửi thông báo thử";
    refs.pushBtn.classList.remove("hidden");
  } else if (permission === "denied") {
    refs.pushStatus.textContent = "Bạn đã chặn thông báo cho AHA. Hãy bật lại trong cài đặt trình duyệt.";
    refs.pushBtn.classList.add("hidden");
  } else {
    refs.pushStatus.textContent = "Bật để nhận thông báo nền";
    refs.pushBtn.textContent = "Bật thông báo";
    refs.pushBtn.classList.remove("hidden");
  }

  if (refs.pushHint) {
    refs.pushHint.classList.toggle("hidden", !supported);
  }
}

async function registerServiceWorker() {
  if (!isPushSupported() || !runtime.remoteMode) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch (error) {
    console.warn("Không thể đăng ký Service Worker:", error);
    return null;
  }
}

async function fetchVapidPublicKey() {
  const payload = await apiRequest("/push/public-key", { method: "GET" });
  if (!payload?.publicKey) throw new Error("Không nhận được VAPID public key.");
  return payload.publicKey;
}

async function subscribePush(registration) {
  const publicKey = await fetchVapidPublicKey();
  const appServerKey = urlBase64ToUint8Array(publicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey,
  });

  await apiRequest("/push/subscribe", {
    method: "POST",
    body: { subscription, ua: navigator.userAgent },
  });
}

async function handlePushButton() {
  if (!isPushSupported() || !runtime.remoteMode) return;

  if (Notification.permission === "granted") {
    try {
      const resp = await apiRequest("/push/test", { method: "POST" });
      const first = Array.isArray(resp?.results) ? resp.results[0] : null;
      if (first) {
        refs.pushStatus.textContent = first.ok
          ? `Đã gửi, mã ${first.status} (kiểm tra khay thông báo)`
          : `Không gửi được (mã ${first.status}): ${first.message || first.error || ""}`;
      } else {
        refs.pushStatus.textContent = "Đã gửi thông báo thử";
      }
    } catch (error) {
      refs.pushStatus.textContent = error?.message || "Không gửi được thông báo thử.";
    }
    return;
  }

  if (Notification.permission === "denied") {
    refs.pushStatus.textContent = "Bạn đã chặn thông báo. Bật lại trong cài đặt trình duyệt.";
    return;
  }

  const permission = await Notification.requestPermission();
  state.pushPermission = permission;

  if (permission !== "granted") {
    updatePushUI();
    return;
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) throw new Error("Không đăng ký được Service Worker.");
    await subscribePush(registration);
    refs.pushStatus.textContent = "Đã bật thông báo.";
  } catch (error) {
    refs.pushStatus.textContent = error?.message || "Không bật được thông báo.";
    console.error(error);
  } finally {
    updatePushUI();
  }
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
    state.financeTransactions = Array.isArray(parsed.financeTransactions) ? parsed.financeTransactions : [];
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
      financeTransactions: state.financeTransactions,
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
    finance: false,
    financeFund: false,
    dataCleanup: false,
    backupData: false,
    changePassword: false,
    reports: true,
    reportsAll: false,
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
    finance: Boolean(source.finance ?? defaults.finance),
    financeFund: Boolean(source.financeFund ?? defaults.financeFund),
    dataCleanup: Boolean(source.dataCleanup ?? defaults.dataCleanup),
    backupData: Boolean(source.backupData ?? defaults.backupData),
    changePassword: Boolean(source.changePassword ?? defaults.changePassword),
    reports: Boolean(source.reports ?? defaults.reports),
    reportsAll: Boolean(source.reportsAll ?? defaults.reportsAll),
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
            finance: true,
            financeFund: true,
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
        finance: true,
        financeFund: true,
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
        finance: true,
        financeFund: true,
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
  state.financeTransactions = [];
  state.users = [];
  state.currentUserId = null;
  state.editingCustomerId = null;
  state.editingProductId = null;
  state.editingVisitId = null;
  state.editingReferralId = null;
  state.financeSelectedUserId = "";
  state.financeExpenseFormOpen = false;
  state.financePendingReceipt = null;
  state.financeVisibleRows = [];
}

function normalizeStateCollections() {
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.products = Array.isArray(state.products) ? state.products : [];
  state.visits = Array.isArray(state.visits) ? state.visits : [];
  state.referrals = Array.isArray(state.referrals) ? state.referrals : [];
  state.financeTransactions = Array.isArray(state.financeTransactions) ? state.financeTransactions : [];
  state.users = Array.isArray(state.users) ? state.users.map(normalizeUser) : [];
  normalizeAllRecords();
}

function applyBootstrap(payload) {
  state.customers = Array.isArray(payload?.customers) ? payload.customers : [];
  state.products = Array.isArray(payload?.products) ? payload.products : [];
  state.visits = Array.isArray(payload?.visits) ? payload.visits : [];
  state.referrals = Array.isArray(payload?.referrals) ? payload.referrals : [];
  state.financeTransactions = Array.isArray(payload?.financeTransactions) ? payload.financeTransactions : [];
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

function buildFinanceCreatedAt(transactionDate) {
  const now = new Date();
  if (!transactionDate) {
    return now.toISOString();
  }

  if (!isValidDay(transactionDate)) {
    return "";
  }

  const timePart = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const createdAt = `${transactionDate}T${timePart}`;
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "" : createdAt;
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

function canGrantFinanceToMembers(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return Boolean(user.permissions?.financeFund);
}

function hasFeaturePermission(user, featureKey) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (featureKey === "manageUsers") return false;
  if (featureKey === "referrals") {
    return Boolean(user.permissions?.referrals || user.permissions?.visits);
  }
  if (featureKey === "referralsEdit") {
    return Boolean(user.permissions?.referralsEdit || user.permissions?.visitsEdit);
  }
  if (featureKey === "referralsDelete") {
    return Boolean(user.permissions?.referralsDelete || user.permissions?.visitsDelete);
  }
  if (featureKey === "reports") {
    return Boolean(user.permissions?.reports || user.permissions?.reportsAll);
  }
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
    state.financeSelectedUserId = "";
    state.financeExpenseFormOpen = false;
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
    if (refs.pushBtn) refs.pushBtn.classList.add("hidden");
    if (refs.pushStatus) refs.pushStatus.textContent = "";
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

  updatePushUI();
  void registerServiceWorker();
}

function applyTabPermissions() {
  const user = getCurrentUser();
  const allowedTabs = Object.keys(TAB_FEATURE_MAP).filter((tabId) =>
    hasFeaturePermission(user, TAB_FEATURE_MAP[tabId]),
  );
  const visibleTabs = allowedTabs.filter((tabId) => !SUPPRESSED_TABS.has(tabId));

  refs.tabs.forEach((btn) => {
    const isAllowed = visibleTabs.includes(btn.dataset.tab);
    btn.classList.toggle("hidden", !isAllowed);
  });

  if (visibleTabs.length === 0) {
    refs.noPermission.classList.remove("hidden");
    setActiveTab("");
    return;
  }

  refs.noPermission.classList.add("hidden");
  const nextTab = visibleTabs.includes(state.activeTab) ? state.activeTab : visibleTabs[0];
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

  if (refs.tabSelector && refs.tabSelector.value !== tabId) {
    refs.tabSelector.value = tabId;
  }

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

function buildCustomerHistoryEntries(customerId) {
  const visits = state.visits.filter((item) => item.customerId === customerId);
  const referrals = state.referrals.filter((item) => item.referredCustomerId === customerId && item.referrerId);

  return [
    ...visits.map((item) => ({
      date: item.date,
      product: getProductName(item.productId),
      occurrence: item.occurrence,
      rate: item.rate,
      revenue: item.revenue,
      value: item.voucher,
      type: "Voucher",
    })),
    ...referrals.map((item) => ({
      date: item.date,
      product: getProductName(item.productId),
      occurrence: item.occurrence,
      rate: item.rate,
      revenue: item.revenue,
      value: item.commission,
      type: "Hoa hồng",
    })),
  ].sort(sortByLatest);
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

function getFinanceUserLabel(user) {
  if (!user) return "";
  return `${user.fullName} (${user.username})`;
}

function getFinanceSelectableUsers(currentUser = getCurrentUser()) {
  const members = getMemberUsers();
  if (!currentUser || currentUser.role !== "member") return members;
  if (members.some((item) => item.id === currentUser.id)) return members;
  return [...members, currentUser].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
}

function getUserDisplayName(userId) {
  if (!userId) return "-";
  const user = state.users.find((item) => item.id === userId);
  if (!user) return "Không xác định";
  return `${user.fullName} (${user.username})`;
}

function getFinanceCounterpartyUserId(item) {
  if (!item) return "";
  const value =
    typeof item.transferCounterpartyUserId === "string"
      ? item.transferCounterpartyUserId
      : typeof item.transfer_counterparty_user_id === "string"
        ? item.transfer_counterparty_user_id
        : "";
  return value.trim();
}

function getFinanceRelatedMemberDisplay(item, options = {}) {
  const counterpartyUserId = getFinanceCounterpartyUserId(item);
  if (counterpartyUserId) {
    return getUserDisplayName(counterpartyUserId);
  }

  const currentUserId = typeof options.currentUserId === "string" ? options.currentUserId : "";
  const selfLabel = typeof options.selfLabel === "string" ? options.selfLabel : "Tự xuất";
  if (
    currentUserId &&
    item &&
    item.userId === currentUserId &&
    normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT
  ) {
    return selfLabel;
  }

  return typeof options.emptyLabel === "string" ? options.emptyLabel : "-";
}

function normalizeFinanceTransactionType(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "THU" || normalized === FINANCE_TYPE_IN) return FINANCE_TYPE_IN;
  if (normalized === "CHI" || normalized === FINANCE_TYPE_OUT) return FINANCE_TYPE_OUT;
  return "";
}

function getFinanceTypeLabel(type) {
  const normalized = normalizeFinanceTransactionType(type);
  if (normalized === FINANCE_TYPE_IN) return "Nhập";
  if (normalized === FINANCE_TYPE_OUT) return "Xuất";
  return "-";
}

function getFinanceSignedAmount(item) {
  const type = normalizeFinanceTransactionType(item?.type);
  if (!type) return 0;
  const amount = Number(item.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return type === FINANCE_TYPE_IN ? amount : -amount;
}

function getFinanceBalanceByUserId(userId) {
  if (!userId) return 0;
  return state.financeTransactions.reduce((sum, item) => {
    if (item.userId !== userId) return sum;
    return sum + getFinanceSignedAmount(item);
  }, 0);
}

function normalizeFinanceNoteText(note) {
  return String(note || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAdjustmentFinanceNote(note) {
  const normalized = normalizeFinanceNoteText(note || "");
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  return lowered.includes("điều chỉnh") || lowered.includes("dieu chinh");
}

function normalizeAdjustmentFinanceNote(note) {
  const normalized = normalizeFinanceNoteText(note || "");
  if (!normalized) return "[ĐIỀU CHỈNH] Điều chỉnh số liệu.";
  if (isAdjustmentFinanceNote(normalized)) return normalized;
  return `[ĐIỀU CHỈNH] ${normalized}`;
}

function normalizeFinanceExpenseCategory(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ADS") return "ADS";
  if (normalized === "OPERATIONS") return "OPERATIONS";
  if (normalized === "OTHER") return "OTHER";
  return "";
}

function getFinanceExpenseCategoryLabel(value) {
  const key = normalizeFinanceExpenseCategory(value);
  return key ? FINANCE_EXPENSE_CATEGORIES[key] : "-";
}

function isFinanceReceiptDataUrl(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return normalized.startsWith("data:image/") && normalized.includes(";base64,");
}

function formatFinanceAttachmentCell(item) {
  const dataUrl = typeof item?.receiptImageDataUrl === "string" ? item.receiptImageDataUrl : "";
  if (!isFinanceReceiptDataUrl(dataUrl)) return "-";
  const name = typeof item?.receiptImageName === "string" && item.receiptImageName.trim() ? item.receiptImageName : "hoa-don";
  return `<a href="${escapeHtml(dataUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`;
}

function setFinanceVisibleRows(rows) {
  state.financeVisibleRows = Array.isArray(rows) ? rows.map((item) => ({ ...item })) : [];
}

function renderFinanceReceiptPreview() {
  if (!refs.financeReceiptPreview) return;

  const attachment = state.financePendingReceipt;
  if (!attachment?.dataUrl || !isFinanceReceiptDataUrl(attachment.dataUrl)) {
    refs.financeReceiptPreview.textContent = "Chưa đính kèm ảnh hóa đơn.";
    return;
  }

  const sizeKb = Math.max(1, Math.round((Number(attachment.size) || 0) / 1024));
  refs.financeReceiptPreview.innerHTML = "";

  const label = document.createElement("span");
  label.textContent = `Đã chọn: ${attachment.name} (${sizeKb} KB). `;
  refs.financeReceiptPreview.appendChild(label);

  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Xem ảnh";
  refs.financeReceiptPreview.appendChild(link);
}

function clearFinanceReceiptSelection() {
  state.financePendingReceipt = null;
  if (refs.financeReceipt) {
    refs.financeReceipt.value = "";
  }
  renderFinanceReceiptPreview();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Không thể đọc ảnh hóa đơn."));
    reader.readAsDataURL(file);
  });
}

async function handleFinanceReceiptFileChange() {
  const file = refs.financeReceipt?.files?.[0];
  if (!file) {
    clearFinanceReceiptSelection();
    return;
  }

  if (!String(file.type || "").startsWith("image/")) {
    refs.financeResult.textContent = "Chỉ hỗ trợ tệp ảnh cho hóa đơn.";
    clearFinanceReceiptSelection();
    return;
  }

  if ((file.size || 0) > MAX_FINANCE_RECEIPT_SIZE_BYTES) {
    refs.financeResult.textContent = "Ảnh hóa đơn tối đa 2MB.";
    clearFinanceReceiptSelection();
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (!isFinanceReceiptDataUrl(dataUrl)) {
      refs.financeResult.textContent = "Tệp ảnh hóa đơn không hợp lệ.";
      clearFinanceReceiptSelection();
      return;
    }

    state.financePendingReceipt = {
      name: String(file.name || "hoa-don").slice(0, 120),
      type: String(file.type || ""),
      size: Number(file.size || 0),
      dataUrl,
    };
    renderFinanceReceiptPreview();
  } catch (error) {
    refs.financeResult.textContent = "Không thể đọc ảnh hóa đơn.";
    clearFinanceReceiptSelection();
  }
}

function readFinanceHistoryFilters() {
  const noteQuery = normalizeTextValue(refs.financeSearchNote?.value || "");
  const amount = unformatNumber(refs.financeSearchAmount?.value || "");
  return {
    noteQuery,
    hasAmount: Number.isFinite(amount) && amount > 0,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
  };
}

function filterFinanceHistoryRows(rows) {
  const filters = readFinanceHistoryFilters();
  return rows.filter((item) => {
    if (filters.hasAmount && Number(item.amount || 0) !== filters.amount) {
      return false;
    }

    if (filters.noteQuery) {
      const searchSource = [
        item.note || "",
        getFinanceExpenseCategoryLabel(item.category),
        getFinanceTypeLabel(item.type),
        getUserDisplayName(item.userId),
        getUserDisplayName(item.createdBy || item.created_by),
        getFinanceRelatedMemberDisplay(item, { selfLabel: "Tự xuất", emptyLabel: "" }),
      ]
        .join(" ")
        .trim();
      if (!normalizeTextValue(searchSource).includes(filters.noteQuery)) {
        return false;
      }
    }

    return true;
  });
}

function buildFinanceVisibleRowsCsv(rows) {
  const header = [
    "created_at",
    "type",
    "category",
    "amount",
    "wallet_user",
    "created_by",
    "related_member",
    "note",
    "receipt_name",
    "has_receipt",
  ];
  const body = rows.map((item) =>
    [
      item.createdAt || item.timestamp || "",
      getFinanceTypeLabel(item.type),
      getFinanceExpenseCategoryLabel(item.category),
      Number(item.amount || 0),
      getUserDisplayName(item.userId),
      getUserDisplayName(item.createdBy || item.created_by),
      getFinanceRelatedMemberDisplay(item, { selfLabel: "Tự xuất" }),
      item.note || "",
      item.receiptImageName || "",
      item.receiptImageDataUrl ? "yes" : "no",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
}

function exportFinanceVisibleRowsCsv() {
  if (!ensureFeature("finance", refs.financeResult)) return;

  if (!Array.isArray(state.financeVisibleRows) || state.financeVisibleRows.length === 0) {
    refs.financeResult.textContent = "Không có dữ liệu giao dịch phù hợp để xuất CSV.";
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const content = buildFinanceVisibleRowsCsv(state.financeVisibleRows);
  downloadTextFile(`aha-finance-${timestamp}.csv`, content, "text/csv;charset=utf-8");
  refs.financeResult.textContent = `Đã xuất ${state.financeVisibleRows.length} giao dịch ra CSV.`;
}

function resolveFinanceUserIdByValue(rawValue, users = getFinanceSelectableUsers()) {
  const typed = String(rawValue || "").trim();
  if (!typed) return "";
  const normalizedTyped = normalizeTextValue(typed);
  const matched = users.find((item) => {
    const comparableValues = [item.id, item.username, item.fullName, getFinanceUserLabel(item)];
    return comparableValues.some((value) => normalizeTextValue(value) === normalizedTyped);
  });
  return matched ? matched.id : "";
}

function resolveFinanceUserId() {
  const users = getFinanceSelectableUsers();
  const resolvedFromOption = resolveIdFromOptions(
    refs.financeUser,
    refs.financeUserOptions,
    users,
    (item) => getFinanceUserLabel(item),
  );
  if (resolvedFromOption) return resolvedFromOption;
  return resolveFinanceUserIdByValue(refs.financeUser?.value || "", users);
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

function resolveReportCustomerId() {
  if (!refs.reportCustomerSearch) return "";
  return resolveCustomerId(refs.reportCustomerSearch, refs.reportCustomerSearchOptions);
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

function canUseReferralInVisitForm(user = getCurrentUser()) {
  return hasFeaturePermission(user, "referrals");
}

function findLinkedReferralByVisitId(visitId) {
  if (!visitId) return null;
  return state.referrals.find((item) => item.sourceVisitId === visitId) || null;
}

function buildLinkedReferralValues(visitId, values) {
  if (!visitId || !values?.referrerId) return null;

  return {
    referrerId: values.referrerId,
    referredCustomerId: values.customerId,
    productId: values.productId,
    date: values.date,
    revenue: values.revenue,
    sourceVisitId: visitId,
  };
}

function syncLinkedReferralForVisitLocal(visitId, values) {
  const existingReferral = findLinkedReferralByVisitId(visitId);
  if (!canUseReferralInVisitForm()) {
    return existingReferral ? { referral: existingReferral } : null;
  }

  const referralValues = buildLinkedReferralValues(visitId, values);
  if (!referralValues) {
    if (existingReferral) {
      state.referrals = state.referrals.filter((item) => item.id !== existingReferral.id);
      return { removed: true };
    }
    return null;
  }

  if (existingReferral) {
    existingReferral.referrerId = referralValues.referrerId;
    existingReferral.referredCustomerId = referralValues.referredCustomerId;
    existingReferral.referredName = "";
    existingReferral.productId = referralValues.productId;
    existingReferral.date = referralValues.date;
    existingReferral.revenue = referralValues.revenue;
    existingReferral.sourceVisitId = referralValues.sourceVisitId;
    return { referral: existingReferral };
  }

  const referralRecord = {
    id: createId("ref"),
    referrerId: referralValues.referrerId,
    referredCustomerId: referralValues.referredCustomerId,
    referredName: "",
    productId: referralValues.productId,
    date: referralValues.date,
    revenue: referralValues.revenue,
    occurrence: 0,
    rate: 0,
    commission: 0,
    sourceVisitId: referralValues.sourceVisitId,
    createdAt: new Date().toISOString(),
  };

  state.referrals.unshift(referralRecord);
  return { referral: referralRecord };
}

async function syncLinkedReferralForVisitRemote(visitId, values) {
  if (!canUseReferralInVisitForm()) {
    return findLinkedReferralByVisitId(visitId) ? { referral: findLinkedReferralByVisitId(visitId) } : null;
  }

  const existingReferral = findLinkedReferralByVisitId(visitId);
  const referralValues = buildLinkedReferralValues(visitId, values);

  if (!referralValues) {
    if (existingReferral) {
      await apiRequest(`/referrals/${encodeURIComponent(existingReferral.id)}`, {
        method: "DELETE",
      });
      return { removed: true };
    }
    return null;
  }

  if (existingReferral) {
    await apiRequest(`/referrals/${encodeURIComponent(existingReferral.id)}`, {
      method: "PATCH",
      body: referralValues,
    });
    return { referralId: existingReferral.id };
  }

  const payload = await apiRequest("/referrals", {
    method: "POST",
    body: referralValues,
  });

  return { referralId: payload?.referral?.id || "" };
}

function formatVisitWorkflowMessage(visit, referral) {
  if (!visit) {
    return "Đã ghi nhận giao dịch dịch vụ.";
  }

  const messageParts = [formatVisitMessage(visit)];
  if (referral?.referrerId) {
    messageParts.push(
      `Hoa hồng giới thiệu: ${formatMoney(referral.commission)} cho ${getReferrerName(referral.referrerId)}.`,
    );
  }

  return messageParts.join(" ");
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
  refs.visitSubmitBtn.textContent = editing
    ? "Lưu chỉnh sửa giao dịch dịch vụ"
    : "Lưu giao dịch + tính voucher / hoa hồng";
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
  const referrerId = canUseReferralInVisitForm()
    ? resolveReferrerId(refs.visitReferrer, refs.visitReferrerOptions)
    : "";
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

  const memberIds = new Set(getMemberUsers().map((user) => user.id));
  if (referrerId && !memberIds.has(referrerId)) {
    refs.visitResult.textContent = "Người giới thiệu phải là tài khoản thành viên do quản trị viên tạo.";
    return null;
  }

  return { customerId, productId, referrerId: referrerId || "", date, revenue };
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
  const linkedReferral = findLinkedReferralByVisitId(visit.id);
  if (refs.visitReferrer) {
    refs.visitReferrer.value = linkedReferral?.referrerId ? getReferrerName(linkedReferral.referrerId) : "";
  }
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
  state.referrals = state.referrals.filter((item) => item.sourceVisitId !== visitId);
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
    await apiRequest(`/visits/${encodeURIComponent(visitId)}`, {
      method: "DELETE",
    });
    await syncFromServer({ preserveTab: true, silent: true });
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
    const referralOutcome = syncLinkedReferralForVisitLocal(editingVisitId, values);
    normalizeAllRecords();
    saveState();
    const savedVisit = state.visits.find((item) => item.id === editingVisitId);
    const savedReferral = findLinkedReferralByVisitId(editingVisitId);
    resetVisitFormState();
    refs.visitResult.textContent = savedVisit
      ? `Đã cập nhật. ${formatVisitWorkflowMessage(savedVisit, referralOutcome?.removed ? null : savedReferral)}`
      : "Đã cập nhật giao dịch tích điểm.";
    showModal(refs.visitResult.textContent);
    renderVisits();
    renderReferrals();
    renderReport();
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
  syncLinkedReferralForVisitLocal(visitRecord.id, values);
  normalizeAllRecords();
  const savedVisit = state.visits.find((item) => item.id === visitRecord.id);
  const savedReferral = findLinkedReferralByVisitId(visitRecord.id);
  saveState();

  refs.visitRevenue.value = "";
  refs.visitResult.textContent = savedVisit
    ? formatVisitWorkflowMessage(savedVisit, savedReferral)
    : "Đã ghi nhận giao dịch tích điểm.";
  showModal(refs.visitResult.textContent);
  renderVisits();
  renderReferrals();
  renderReport();
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
      await apiRequest(`/visits/${encodeURIComponent(editingVisitId)}`, {
        method: "PATCH",
        body: values,
      });
      await syncLinkedReferralForVisitRemote(editingVisitId, values);
      await syncFromServer({ preserveTab: true, silent: true });
      const savedVisit = state.visits.find((item) => item.id === editingVisitId);
      const savedReferral = findLinkedReferralByVisitId(editingVisitId);
      resetVisitFormState();
      refs.visitResult.textContent = savedVisit
        ? `Đã cập nhật. ${formatVisitWorkflowMessage(savedVisit, savedReferral)}`
        : "Đã cập nhật giao dịch tích điểm.";
      showModal(refs.visitResult.textContent);
      renderVisits();
      renderReferrals();
      renderReport();
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
    const visitId = payload?.visit?.id || "";
    if (visitId) {
      await syncLinkedReferralForVisitRemote(visitId, values);
    }
    await syncFromServer({ preserveTab: true, silent: true });

    const savedVisit = state.visits.find((item) => item.id === visitId) || payload?.visit;
    const savedReferral = findLinkedReferralByVisitId(visitId);
    refs.visitRevenue.value = "";
    refs.visitResult.textContent = savedVisit
      ? formatVisitWorkflowMessage(savedVisit, savedReferral)
      : "Đã ghi nhận giao dịch tích điểm.";
    showModal(refs.visitResult.textContent);
    renderVisits();
    renderReferrals();
    renderReport();
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

function syncFinanceFormForRole() {
  const currentUser = getCurrentUser();
  const hasFinance = hasFeaturePermission(currentUser, "finance");
  const canFundMode = hasFinance && canGrantFinanceToMembers(currentUser);
  const adminMode = hasFinance && isAdmin(currentUser);
  const expenseMode = hasFinance && currentUser && !canFundMode;
  const allowInputType = canFundMode && adminMode;
  const rawType = normalizeFinanceTransactionType(refs.financeType?.value);
  const hasTypeTouched = refs.financeType?.dataset?.touched === "true";
  const selectedType = allowInputType ? (hasTypeTouched ? rawType || FINANCE_TYPE_OUT : FINANCE_TYPE_OUT) : FINANCE_TYPE_OUT;
  const isInputMode = selectedType === FINANCE_TYPE_IN;
  const isOutputMode = selectedType === FINANCE_TYPE_OUT;
  const selectedTargetUserId = canFundMode && isOutputMode ? resolveFinanceUserId() : "";
  const isTransferOut = Boolean(selectedTargetUserId && currentUser && selectedTargetUserId !== currentUser.id);

  if (refs.financeOpenExpenseBtn) {
    refs.financeOpenExpenseBtn.classList.toggle("hidden", !expenseMode);
  }
  if (refs.financeCancelBtn) {
    refs.financeCancelBtn.classList.toggle("hidden", !expenseMode || !state.financeExpenseFormOpen);
  }
  if (refs.financeAdminStaffPanel) {
    refs.financeAdminStaffPanel.classList.toggle("hidden", !adminMode);
  }
  if (refs.financeAdminReportPanel) {
    refs.financeAdminReportPanel.classList.toggle("hidden", !hasFinance);
  }
  if (refs.financeReportUserGroup) {
    refs.financeReportUserGroup.classList.toggle("hidden", !adminMode);
  }
  if (refs.financeReportUser) {
    refs.financeReportUser.disabled = !adminMode;
  }

  if (refs.financeUserGroup) {
    refs.financeUserGroup.classList.toggle("hidden", !canFundMode || !isOutputMode);
  }
  if (refs.financeUser) {
    refs.financeUser.disabled = !canFundMode || !isOutputMode;
    if (!canFundMode || !isOutputMode) {
      refs.financeUser.value = "";
    }
  }

  if (refs.financeTypeGroup) {
    refs.financeTypeGroup.classList.toggle("hidden", !canFundMode || !adminMode);
  }
  if (refs.financeType) {
    if (!allowInputType) {
      refs.financeType.dataset.touched = "";
    }
    refs.financeType.value = selectedType;
    refs.financeType.disabled = !canFundMode;
  }

  if (refs.financeCategoryGroup) {
    refs.financeCategoryGroup.classList.toggle("hidden", !(expenseMode || (canFundMode && isOutputMode && !isTransferOut)));
  }
  if (refs.financeCategory) {
    const allowOutputFields = expenseMode || (canFundMode && isOutputMode && !isTransferOut);
    refs.financeCategory.disabled = !allowOutputFields;
    if (!allowOutputFields) {
      refs.financeCategory.value = "ADS";
    } else if (!normalizeFinanceExpenseCategory(refs.financeCategory.value)) {
      refs.financeCategory.value = "ADS";
    }
  }

  if (refs.financeReceiptGroup) {
    refs.financeReceiptGroup.classList.toggle("hidden", !(expenseMode || (canFundMode && isOutputMode && !isTransferOut)));
  }
  if (refs.financeReceipt) {
    const allowOutputFields = expenseMode || (canFundMode && isOutputMode && !isTransferOut);
    refs.financeReceipt.disabled = !allowOutputFields;
    if (!allowOutputFields) {
      clearFinanceReceiptSelection();
    } else {
      renderFinanceReceiptPreview();
    }
  }

  if (refs.financeSubmitBtn) {
    if (selectedType === FINANCE_TYPE_IN) {
      refs.financeSubmitBtn.textContent = "Nạp tiền vào ví của bạn";
    } else if (canFundMode && isTransferOut) {
      refs.financeSubmitBtn.textContent = "Chuyển tiền cho nhân viên";
    } else {
      refs.financeSubmitBtn.textContent = "Lưu khoản xuất";
    }
  }

  if (refs.financeForm) {
    if (!hasFinance) {
      refs.financeForm.classList.add("hidden");
    } else if (canFundMode) {
      refs.financeForm.classList.remove("hidden");
    } else {
      refs.financeForm.classList.toggle("hidden", !state.financeExpenseFormOpen);
    }
  }
}

function renderFinanceUserOptions() {
  if (!refs.financeUserOptions) return;

  const currentUser = getCurrentUser();
  const members = getMemberUsers();
  const selectableUsers = getFinanceSelectableUsers(currentUser);
  const previousValue = refs.financeUser?.value || "";
  const previousReportUserId = refs.financeReportUser?.value || "";

  refs.financeUserOptions.innerHTML = selectableUsers
    .map(
      (member) =>
        `<option data-id="${escapeHtml(member.id)}" value="${escapeHtml(getFinanceUserLabel(member))}"></option>`,
    )
    .join("");

  if (refs.financeReportUser) {
    refs.financeReportUser.innerHTML = [
      '<option value="">Tất cả nhân viên</option>',
      ...members.map(
        (member) =>
          `<option value="${escapeHtml(member.id)}">${escapeHtml(member.fullName)} (${escapeHtml(member.username)})</option>`,
      ),
    ].join("");
    const hasPrevious = members.some((item) => item.id === previousReportUserId);
    refs.financeReportUser.value = hasPrevious ? previousReportUserId : "";
  }

  if (refs.financeUser) {
    if (canGrantFinanceToMembers(currentUser)) {
      const resolvedPreviousUserId = resolveFinanceUserIdByValue(previousValue, selectableUsers);
      const selectedUser = selectableUsers.find((item) => item.id === resolvedPreviousUserId);
      refs.financeUser.value = selectedUser ? getFinanceUserLabel(selectedUser) : "";
    } else {
      refs.financeUser.value = "";
      state.financeSelectedUserId = "";
    }
  }

  if (isAdmin(currentUser) && members.length > 0) {
    const stillValid = members.some((item) => item.id === state.financeSelectedUserId);
    if (!stillValid) {
      state.financeSelectedUserId = members[0].id;
    }
  }

  syncFinanceFormForRole();
}

function readFinanceFormValues() {
  if (!ensureFeature("finance", refs.financeResult)) return null;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    refs.financeResult.textContent = "Vui lòng đăng nhập để thao tác ví nội bộ.";
    return null;
  }

  const type = normalizeFinanceTransactionType(refs.financeType?.value);
  const amount = unformatNumber(refs.financeAmount?.value || "");
  const transactionDate = String(refs.financeDate?.value || "").trim();
  const category = normalizeFinanceExpenseCategory(refs.financeCategory?.value || "");
  const noteInput = refs.financeNote?.value || "";
  const normalizedNote = normalizeFinanceNoteText(noteInput);
  const adjustment = isAdjustmentFinanceNote(normalizedNote);
  const note = adjustment ? normalizeAdjustmentFinanceNote(normalizedNote) : normalizedNote;

  if (type !== FINANCE_TYPE_IN && type !== FINANCE_TYPE_OUT) {
    refs.financeResult.textContent = "Loại giao dịch không hợp lệ.";
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    refs.financeResult.textContent = "Số tiền phải lớn hơn 0.";
    return null;
  }

  if (transactionDate && !isValidDay(transactionDate)) {
    refs.financeResult.textContent = "Ngày giao dịch không hợp lệ.";
    return null;
  }

  if (!note) {
    refs.financeResult.textContent = "Vui lòng nhập nội dung mô tả giao dịch (ghi rõ nếu là điều chỉnh).";
    return null;
  }

  let userId = currentUser.id;
  const canFund = canGrantFinanceToMembers(currentUser);
  const selectedMemberId = canFund ? resolveFinanceUserId() : "";
  const isTransferOut = canFund && type === FINANCE_TYPE_OUT && selectedMemberId && selectedMemberId !== currentUser.id;

  if (canFund) {
    if (type === FINANCE_TYPE_IN) {
      if (!isAdmin(currentUser)) {
        refs.financeResult.textContent = "Chỉ quản trị viên được nạp thêm tiền vào ví của chính mình.";
        return null;
      }
      userId = currentUser.id;
    } else {
      if (!isTransferOut && !category) {
        refs.financeResult.textContent = "Vui lòng chọn danh mục xuất (Ads, Vận hành hoặc Khác).";
        return null;
      }

      if (isTransferOut) {
        const exists = getMemberUsers().some((item) => item.id === selectedMemberId);
        if (!exists) {
          refs.financeResult.textContent = "Tài khoản ví không hợp lệ.";
          return null;
        }
      }

      const currentBalance = getFinanceBalanceByUserId(currentUser.id);
      if (amount > currentBalance) {
        refs.financeResult.textContent = "Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT.";
        return null;
      }
      userId = isTransferOut ? selectedMemberId : currentUser.id;
    }
  } else {
    if (type !== FINANCE_TYPE_OUT) {
      refs.financeResult.textContent = "Tài khoản này chỉ được ghi nhận giao dịch XUẤT.";
      return null;
    }

    if (!category) {
      refs.financeResult.textContent = "Vui lòng chọn danh mục xuất (Ads, Vận hành hoặc Khác).";
      return null;
    }

    userId = currentUser.id;

    const currentBalance = getFinanceBalanceByUserId(userId);
    if (amount > currentBalance) {
      refs.financeResult.textContent = "Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT.";
      return null;
    }
  }

  const receiptImage =
    state.financePendingReceipt && state.financePendingReceipt.dataUrl
      ? {
          name: state.financePendingReceipt.name || "hoa-don",
          dataUrl: state.financePendingReceipt.dataUrl,
          contentType: state.financePendingReceipt.type || "",
          size: Number(state.financePendingReceipt.size || 0),
        }
      : null;

  return {
    userId,
    type,
    amount,
    transactionDate,
    note,
    adjustment,
    isTransferOut,
    transferTargetUserId: isTransferOut ? selectedMemberId : "",
    category: type === FINANCE_TYPE_OUT && !isTransferOut ? category : "",
    receiptImage: type === FINANCE_TYPE_OUT && !isTransferOut ? receiptImage : null,
  };
}

function formatFinanceResultMessage(transaction, options = {}) {
  if (!transaction) return "Đã ghi nhận giao dịch tài chính.";

  const walletName = getUserDisplayName(transaction.userId);
  const balance =
    Number.isFinite(Number(options.balanceOverride)) ? Number(options.balanceOverride) : getFinanceBalanceByUserId(transaction.userId);
  const typeLabel = getFinanceTypeLabel(transaction.type);
  const transferRole = String(transaction.transferRole || transaction.transfer_role || "")
    .trim()
    .toUpperCase();
  const relatedMemberLabel = getFinanceRelatedMemberDisplay(transaction, { emptyLabel: "" });

  if (transferRole === "OUT" && relatedMemberLabel) {
    return `Đã ghi nhận ${typeLabel.toUpperCase()} ${formatMoney(transaction.amount)} từ ${walletName} sang ${relatedMemberLabel}. Số tồn hiện tại của ${walletName}: ${formatMoney(balance)}.`;
  }

  if (transferRole === "IN" && relatedMemberLabel) {
    return `Đã ghi nhận ${typeLabel.toUpperCase()} ${formatMoney(transaction.amount)} vào ${walletName} từ ${relatedMemberLabel}. Số tồn hiện tại của ${walletName}: ${formatMoney(balance)}.`;
  }

  return `Đã ghi nhận ${typeLabel.toUpperCase()} ${formatMoney(transaction.amount)} cho ${walletName}. Số tồn hiện tại: ${formatMoney(balance)}.`;
}

function getFinanceTotalsForUser(userId) {
  const rows = state.financeTransactions.filter((item) => item.userId === userId);
  const nhap = rows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_IN)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const xuat = rows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  return {
    rows,
    nhap,
    xuat,
    ton: nhap - xuat,
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toLocalDayKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatLocalDay(dayKey) {
  if (!dayKey || dayKey.length < 10) return "-";
  const [year, month, day] = dayKey.split("-");
  return `${day}/${month}/${year}`;
}

function getWeekStartByDayKey(dayKey) {
  const date = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return date;
}

function toLocalWeekKey(dayKey) {
  const weekStart = getWeekStartByDayKey(dayKey);
  if (!weekStart) return "";
  return `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`;
}

function formatLocalWeek(weekKey) {
  const start = getWeekStartByDayKey(weekKey);
  if (!start) return "-";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}/${start.getFullYear()}`;
  const endLabel = `${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}/${end.getFullYear()}`;
  return `${startLabel} - ${endLabel}`;
}

function toLocalMonthKey(dayKey) {
  if (!dayKey || dayKey.length < 7) return "";
  return dayKey.slice(0, 7);
}

function formatLocalMonth(monthKey) {
  if (!monthKey || monthKey.length < 7) return "-";
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

function buildFinanceReportBucket(dayKey, groupBy) {
  if (groupBy === "week") {
    const key = toLocalWeekKey(dayKey);
    return {
      key,
      label: formatLocalWeek(key),
      sortKey: key,
    };
  }

  if (groupBy === "month") {
    const key = toLocalMonthKey(dayKey);
    return {
      key,
      label: formatLocalMonth(key),
      sortKey: key,
    };
  }

  return {
    key: dayKey,
    label: formatLocalDay(dayKey),
    sortKey: dayKey,
  };
}

function readFinanceReportFilters(options = {}) {
  const forcedUserId = typeof options.forceUserId === "string" ? options.forceUserId : "";
  const userId = forcedUserId || refs.financeReportUser?.value || "";
  const fromDate = refs.financeReportFrom?.value || "";
  const toDate = refs.financeReportTo?.value || "";
  const groupBy = refs.financeReportGroup?.value || "day";
  const validGroupBy = ["day", "week", "month"].includes(groupBy) ? groupBy : "day";

  const validFrom = fromDate ? isValidDay(fromDate) : true;
  const validTo = toDate ? isValidDay(toDate) : true;
  const rangeError = !validFrom || !validTo || (fromDate && toDate && fromDate > toDate);

  return {
    userId,
    forcedUserId,
    fromDate,
    toDate,
    groupBy: validGroupBy,
    rangeError,
  };
}

function renderAdminFinanceReport(allRows, members, options = {}) {
  if (!refs.financeReportSummary || !refs.financeReportTableBody) return;

  const filters = readFinanceReportFilters({ forceUserId: options.forceUserId || "" });
  const memberIdSet = new Set(members.map((item) => item.id));
  const userId = filters.forcedUserId ? filters.forcedUserId : memberIdSet.has(filters.userId) ? filters.userId : "";

  if (!filters.forcedUserId && refs.financeReportUser && refs.financeReportUser.value !== userId) {
    refs.financeReportUser.value = userId;
  }

  if (filters.rangeError) {
    refs.financeReportSummary.innerHTML = `
      <div class="summary-chip">
        <p>Trạng thái</p>
        <strong>Khoảng thời gian không hợp lệ</strong>
      </div>
    `;
    refs.financeReportTableBody.innerHTML = '<tr><td class="empty-cell" colspan="5">Vui lòng kiểm tra lại ngày lọc.</td></tr>';
    return;
  }

  const filteredRows = allRows.filter((item) => {
    if (userId && item.userId !== userId) return false;
    const dayKey = toLocalDayKey(item.createdAt || item.timestamp);
    if (!dayKey) return false;
    if (filters.fromDate && dayKey < filters.fromDate) return false;
    if (filters.toDate && dayKey > filters.toDate) return false;
    return true;
  });

  const totalNhap = filteredRows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_IN)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalXuat = filteredRows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalTon = totalNhap - totalXuat;

  refs.financeReportSummary.innerHTML = `
    <div class="summary-chip">
      <p>Tổng nhập (lọc)</p>
      <strong>${formatMoney(totalNhap)}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng xuất (lọc)</p>
      <strong>${formatMoney(totalXuat)}</strong>
    </div>
    <div class="summary-chip">
      <p>Tổng tồn (lọc)</p>
      <strong>${formatMoney(totalTon)}</strong>
    </div>
    <div class="summary-chip">
      <p>Số giao dịch</p>
      <strong>${filteredRows.length}</strong>
    </div>
  `;

  const grouped = new Map();
  filteredRows.forEach((item) => {
    const dayKey = toLocalDayKey(item.createdAt || item.timestamp);
    if (!dayKey) return;
    const bucket = buildFinanceReportBucket(dayKey, filters.groupBy);
    if (!bucket.key) return;

    if (!grouped.has(bucket.key)) {
      grouped.set(bucket.key, {
        label: bucket.label,
        sortKey: bucket.sortKey,
        nhap: 0,
        xuat: 0,
        count: 0,
      });
    }

    const row = grouped.get(bucket.key);
    if (normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_IN) row.nhap += item.amount || 0;
    if (normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT) row.xuat += item.amount || 0;
    row.count += 1;
  });

  const rows = Array.from(grouped.values()).sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
  if (rows.length === 0) {
    refs.financeReportTableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="5">Không có giao dịch phù hợp bộ lọc.</td></tr>';
    return;
  }

  refs.financeReportTableBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${formatMoney(row.nhap)}</td>
        <td>${formatMoney(row.xuat)}</td>
        <td>${formatMoney(row.nhap - row.xuat)}</td>
        <td>${row.count}</td>
      </tr>
    `,
    )
    .join("");
}

function setFinanceTableHead(headers) {
  if (!refs.financeTableHead) return;
  refs.financeTableHead.innerHTML = `<tr>${headers.map((title) => `<th>${escapeHtml(title)}</th>`).join("")}</tr>`;
}

function renderMemberFinance(currentUser) {
  const canFund = canGrantFinanceToMembers(currentUser);
  const totals = getFinanceTotalsForUser(currentUser.id);
  const allRows = [...totals.rows].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const recentExpenses = filterFinanceHistoryRows(
    [...totals.rows]
      .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
  ).slice(0, 50);
  setFinanceVisibleRows(recentExpenses);
  if (refs.financeExportCsvBtn) refs.financeExportCsvBtn.classList.remove("hidden");

  if (refs.financeRoleDesc) {
    refs.financeRoleDesc.textContent = canFund
      ? "Bạn được phân quyền cấp tiền cho nhân viên. Dữ liệu hiển thị trong tab này vẫn là số liệu ví của chính bạn."
      : "Nhập giao dịch xuất của chính bạn, xem số tồn hiện tại và các khoản xuất gần nhất.";
  }
  if (refs.financeHistoryTitle) {
    refs.financeHistoryTitle.textContent = "Khoản xuất gần nhất";
  }
  if (refs.financeBalance) {
    refs.financeBalance.textContent = `Số tồn hiện tại: ${formatMoney(totals.ton)}. Tổng đã xuất: ${formatMoney(totals.xuat)}.`;
  }
  if (refs.financeSummary) {
    refs.financeSummary.innerHTML = `
      <div class="summary-chip">
        <p>Số tồn hiện tại</p>
        <strong>${formatMoney(totals.ton)}</strong>
      </div>
      <div class="summary-chip">
        <p>Tổng đã xuất</p>
        <strong>${formatMoney(totals.xuat)}</strong>
      </div>
    `;
  }
  if (refs.financeReportTitle) {
    refs.financeReportTitle.textContent = "Báo cáo cá nhân realtime";
  }
  if (refs.financeReportDesc) {
    refs.financeReportDesc.textContent = "Thống kê NHẬP/XUẤT/TỒN của ví bạn theo ngày, tuần hoặc tháng.";
  }
  renderAdminFinanceReport(allRows, [currentUser], { forceUserId: currentUser.id });

  setFinanceTableHead(["Thời gian", "Nhân viên", "Danh mục", "Số tiền", "Nội dung", "Hóa đơn"]);
  if (recentExpenses.length === 0) {
    refs.financeTableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="6">Không có khoản xuất phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  refs.financeTableBody.innerHTML = recentExpenses
    .map(
      (item) => `
      <tr>
        <td>${new Date(item.createdAt || Date.now()).toLocaleString("vi-VN")}</td>
        <td>${escapeHtml(getFinanceRelatedMemberDisplay(item, { currentUserId: currentUser.id, selfLabel: "Tự xuất" }))}</td>
        <td>${escapeHtml(getFinanceExpenseCategoryLabel(item.category))}</td>
        <td>${formatMoney(item.amount || 0)}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td>${formatFinanceAttachmentCell(item)}</td>
      </tr>
    `,
    )
    .join("");
}

function renderAdminFinance() {
  const allRows = [...state.financeTransactions].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const totalNhap = allRows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_IN)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalXuat = allRows
    .filter((item) => normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT)
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalTon = totalNhap - totalXuat;
  if (refs.financeExportCsvBtn) refs.financeExportCsvBtn.classList.remove("hidden");

  if (refs.financeRoleDesc) {
    refs.financeRoleDesc.textContent = "Dashboard tổng hợp tài chính, cấp tiền cho nhân viên và xem lịch sử giao dịch theo từng người.";
  }
  if (refs.financeSummary) {
    refs.financeSummary.innerHTML = `
      <div class="summary-chip">
        <p>Tổng đã nhập</p>
        <strong>${formatMoney(totalNhap)}</strong>
      </div>
      <div class="summary-chip">
        <p>Tổng đã xuất</p>
        <strong>${formatMoney(totalXuat)}</strong>
      </div>
      <div class="summary-chip">
        <p>Tổng tồn</p>
        <strong>${formatMoney(totalTon)}</strong>
      </div>
    `;
  }
  if (refs.financeBalance) {
    refs.financeBalance.textContent = `Toàn hệ thống: NHẬP ${formatMoney(totalNhap)} | XUẤT ${formatMoney(totalXuat)} | TỒN ${formatMoney(totalTon)}.`;
  }
  if (refs.financeReportTitle) {
    refs.financeReportTitle.textContent = "Báo cáo realtime";
  }
  if (refs.financeReportDesc) {
    refs.financeReportDesc.textContent = "Lọc theo nhân viên và khoảng thời gian, sau đó xem tổng hợp theo ngày/tuần/tháng.";
  }

  const members = getMemberUsers();
  renderAdminFinanceReport(allRows, members);

  if (refs.financeStaffBody) {
    if (members.length === 0) {
      refs.financeStaffBody.innerHTML = '<tr><td class="empty-cell" colspan="5">Chưa có tài khoản nhân viên.</td></tr>';
    } else {
      refs.financeStaffBody.innerHTML = members
        .map((member) => {
          const totals = getFinanceTotalsForUser(member.id);
          const selectedClass = member.id === state.financeSelectedUserId ? "finance-selected-row" : "";
          return `
            <tr class="${selectedClass} finance-selectable-row" data-user-id="${escapeHtml(member.id)}">
              <td>${escapeHtml(member.fullName)} (${escapeHtml(member.username)})</td>
              <td>${formatMoney(totals.nhap)}</td>
              <td>${formatMoney(totals.xuat)}</td>
              <td>${formatMoney(totals.ton)}</td>
              <td><button type="button" class="secondary-btn table-btn finance-view-history-btn" data-user-id="${escapeHtml(member.id)}">Xem lịch sử</button></td>
            </tr>
          `;
        })
        .join("");
    }
  }

  if (!members.some((item) => item.id === state.financeSelectedUserId)) {
    state.financeSelectedUserId = members[0]?.id || "";
  }

  if (!state.financeSelectedUserId) {
    setFinanceVisibleRows([]);
    if (refs.financeHistoryTitle) {
      refs.financeHistoryTitle.textContent = "Lịch sử giao dịch";
    }
    setFinanceTableHead([
      "Thời gian",
      "Loại",
      "Danh mục",
      "Số tiền",
      "Người thực hiện",
      "Nhân viên liên quan",
      "Nội dung",
      "Hóa đơn",
    ]);
    refs.financeTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Chọn nhân viên để xem lịch sử giao dịch.</td></tr>';
    return;
  }

  const selectedUser = members.find((item) => item.id === state.financeSelectedUserId);
  if (refs.financeHistoryTitle) {
    refs.financeHistoryTitle.textContent = selectedUser
      ? `Lịch sử giao dịch: ${selectedUser.fullName} (${selectedUser.username})`
      : "Lịch sử giao dịch";
  }

  const userRows = filterFinanceHistoryRows(allRows.filter((item) => item.userId === state.financeSelectedUserId));
  setFinanceVisibleRows(userRows);
  setFinanceTableHead([
    "Thời gian",
    "Loại",
    "Danh mục",
    "Số tiền",
    "Người thực hiện",
    "Nhân viên liên quan",
    "Nội dung",
    "Hóa đơn",
  ]);
  if (userRows.length === 0) {
    refs.financeTableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="8">Không có giao dịch phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  refs.financeTableBody.innerHTML = userRows
    .map(
      (item) => `
      <tr>
        <td>${new Date(item.createdAt || Date.now()).toLocaleString("vi-VN")}</td>
        <td>${escapeHtml(getFinanceTypeLabel(item.type))}</td>
        <td>${escapeHtml(getFinanceExpenseCategoryLabel(item.category))}</td>
        <td>${formatMoney(item.amount || 0)}</td>
        <td>${escapeHtml(getUserDisplayName(item.createdBy || item.created_by))}</td>
        <td>${escapeHtml(getFinanceRelatedMemberDisplay(item, { emptyLabel: "-" }))}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td>${formatFinanceAttachmentCell(item)}</td>
      </tr>
    `,
    )
    .join("");
}

function addFinanceTransaction() {
  if (runtime.remoteMode) {
    void addFinanceTransactionRemote();
    return;
  }

  const currentUser = getCurrentUser();
  const values = readFinanceFormValues();
  if (!values || !currentUser) return;

  const createdAt = buildFinanceCreatedAt(values.transactionDate);
  if (!createdAt) {
    refs.financeResult.textContent = "Ngày giao dịch không hợp lệ.";
    return;
  }
  let resultTransaction = null;
  if (values.isTransferOut && values.transferTargetUserId) {
    const transferId = createId("ftr");
    const inRecord = {
      id: createId("fin"),
      userId: values.transferTargetUserId,
      type: FINANCE_TYPE_IN,
      amount: values.amount,
      category: "",
      note: values.note,
      isAdjustment: false,
      adjustmentOf: "",
      transferId,
      transferRole: "IN",
      transferCounterpartyUserId: currentUser.id,
      receiptImageDataUrl: "",
      receiptImageName: "",
      createdBy: currentUser.id,
      created_by: currentUser.id,
      createdAt,
      timestamp: createdAt,
    };
    const outRecord = {
      id: createId("fin"),
      userId: currentUser.id,
      type: FINANCE_TYPE_OUT,
      amount: values.amount,
      category: "",
      note: values.note,
      isAdjustment: false,
      adjustmentOf: "",
      transferId,
      transferRole: "OUT",
      transferCounterpartyUserId: values.transferTargetUserId,
      receiptImageDataUrl: "",
      receiptImageName: "",
      createdBy: currentUser.id,
      created_by: currentUser.id,
      createdAt,
      timestamp: createdAt,
    };
    state.financeTransactions.unshift(inRecord);
    state.financeTransactions.unshift(outRecord);
    resultTransaction = outRecord;
  } else {
    const record = {
      id: createId("fin"),
      userId: values.userId,
      type: values.type,
      amount: values.amount,
      category: values.category || "",
      note: values.note,
      isAdjustment: Boolean(values.adjustment),
      adjustmentOf: "",
      transferId: "",
      transferRole: "",
      transferCounterpartyUserId: "",
      receiptImageDataUrl: values.receiptImage?.dataUrl || "",
      receiptImageName: values.receiptImage?.name || "",
      createdBy: currentUser.id,
      created_by: currentUser.id,
      createdAt,
      timestamp: createdAt,
    };
    state.financeTransactions.unshift(record);
    resultTransaction = record;
  }
  normalizeAllRecords();
  saveState();

  refs.financeAmount.value = "";
  if (refs.financeDate) refs.financeDate.value = "";
  if (refs.financeCategory) refs.financeCategory.value = "ADS";
  refs.financeNote.value = "";
  clearFinanceReceiptSelection();
  state.financeExpenseFormOpen = false;
  state.financeSelectedUserId = values.transferTargetUserId || values.userId;
  refs.financeResult.textContent = formatFinanceResultMessage(resultTransaction);
  showModal(refs.financeResult.textContent);
  renderFinance();
}

async function addFinanceTransactionRemote() {
  const values = readFinanceFormValues();
  if (!values) return;

  try {
    const payload = await apiRequest("/finance/transactions", {
      method: "POST",
      body: values,
    });

    if (Array.isArray(payload?.financeTransactions)) {
      state.financeTransactions = payload.financeTransactions;
      normalizeAllRecords();
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    const savedTransaction =
      state.financeTransactions.find((item) => item.id === payload?.transaction?.id) || payload?.transaction || null;

    refs.financeAmount.value = "";
    if (refs.financeDate) refs.financeDate.value = "";
    if (refs.financeCategory) refs.financeCategory.value = "ADS";
    refs.financeNote.value = "";
    clearFinanceReceiptSelection();
    state.financeExpenseFormOpen = false;
    state.financeSelectedUserId = values.transferTargetUserId || values.userId;
    refs.financeResult.textContent = formatFinanceResultMessage(savedTransaction, {
      balanceOverride: payload?.targetBalance,
    });
    showModal(refs.financeResult.textContent);
    renderFinance();
  } catch (error) {
    handleRemoteActionError(error, refs.financeResult, "Không thể ghi nhận giao dịch tài chính.");
  }
}

function renderFinance() {
  if (!refs.financeTableBody || !refs.financeSummary || !refs.financeBalance) return;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    setFinanceVisibleRows([]);
    clearFinanceReceiptSelection();
    if (refs.financeRoleDesc) refs.financeRoleDesc.textContent = "Vui lòng đăng nhập để dùng tính năng tài chính.";
    refs.financeBalance.textContent = "Vui lòng đăng nhập.";
    refs.financeSummary.innerHTML = "";
    setFinanceTableHead(["Thông tin"]);
    refs.financeTableBody.innerHTML = '<tr><td class="empty-cell">Vui lòng đăng nhập.</td></tr>';
    if (refs.financeAdminStaffPanel) refs.financeAdminStaffPanel.classList.add("hidden");
    if (refs.financeAdminReportPanel) refs.financeAdminReportPanel.classList.add("hidden");
    if (refs.financeExportCsvBtn) refs.financeExportCsvBtn.classList.add("hidden");
    return;
  }

  syncFinanceFormForRole();

  if (!hasFeaturePermission(currentUser, "finance")) {
    setFinanceVisibleRows([]);
    clearFinanceReceiptSelection();
    if (refs.financeRoleDesc) refs.financeRoleDesc.textContent = "Bạn chưa có quyền truy cập tính năng tài chính.";
    refs.financeBalance.textContent = "Bạn chưa có quyền truy cập tính năng tài chính.";
    refs.financeSummary.innerHTML = "";
    setFinanceTableHead(["Thông tin"]);
    refs.financeTableBody.innerHTML = '<tr><td class="empty-cell">Bạn chưa có quyền xem dữ liệu tài chính.</td></tr>';
    if (refs.financeAdminStaffPanel) refs.financeAdminStaffPanel.classList.add("hidden");
    if (refs.financeAdminReportPanel) refs.financeAdminReportPanel.classList.add("hidden");
    if (refs.financeExportCsvBtn) refs.financeExportCsvBtn.classList.add("hidden");
    return;
  }

  if (isAdmin(currentUser)) {
    renderAdminFinance();
    return;
  }

  renderMemberFinance(currentUser);
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
      referrals: Boolean(refs.permVisits.checked),
      referralsEdit: Boolean(refs.permVisitsEdit.checked),
      referralsDelete: Boolean(refs.permVisitsDelete.checked),
      finance: Boolean(refs.permFinance.checked),
      financeFund: Boolean(refs.permFinanceFund.checked),
      dataCleanup: Boolean(refs.permDataCleanup.checked),
      backupData: Boolean(refs.permBackupData.checked),
      changePassword: Boolean(refs.permChangePassword.checked),
      reports: Boolean(refs.permReports.checked),
      reportsAll: Boolean(refs.permReportsAll.checked),
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
  renderFinanceUserOptions();
  renderFinance();
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
          referrals: Boolean(refs.permVisits.checked),
          referralsEdit: Boolean(refs.permVisitsEdit.checked),
          referralsDelete: Boolean(refs.permVisitsDelete.checked),
          finance: Boolean(refs.permFinance.checked),
          financeFund: Boolean(refs.permFinanceFund.checked),
          dataCleanup: Boolean(refs.permDataCleanup.checked),
          backupData: Boolean(refs.permBackupData.checked),
          changePassword: Boolean(refs.permChangePassword.checked),
          reports: Boolean(refs.permReports.checked),
          reportsAll: Boolean(refs.permReportsAll.checked),
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
    renderFinanceUserOptions();
    renderFinance();
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

function handleUserTableChange(event) {
  const input = event.target.closest(".permission-toggle");
  if (!input) return;

  const permissionKey = input.dataset.permission || "";
  if (!["visits", "visitsEdit", "visitsDelete"].includes(permissionKey)) {
    return;
  }

  syncMemberRowServicePermissions(input.closest("tr"));
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
  renderFinanceUserOptions();
  renderFinance();
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
  renderFinanceUserOptions();
  renderCustomers();
  renderProducts();
  renderVisits();
  renderReferrals();
  renderReport();
  renderFinance();
  renderUserAccounts();
}

function renderCustomerOptions() {
  const prevVisitValue = refs.visitCustomer.value;
  const prevReferredValue = refs.referredCustomer.value;
  const prevReportCustomerValue = refs.reportCustomerSearch?.value;
  const options = state.customers
    .map(
      (customer) =>
        `<option data-id="${escapeHtml(customer.id)}" value="${escapeHtml(customer.name)}${customer.phone ? ` - ${escapeHtml(customer.phone)}` : ""}"></option>`,
    )
    .join("");

  refs.visitCustomerOptions.innerHTML = options;
  refs.referredCustomerOptions.innerHTML = options;
  if (refs.reportCustomerSearchOptions) {
    refs.reportCustomerSearchOptions.innerHTML = options;
  }

  refs.visitCustomer.value = prevVisitValue;
  refs.referredCustomer.value = prevReferredValue;
  if (refs.reportCustomerSearch) {
    refs.reportCustomerSearch.value = prevReportCustomerValue || "";
  }
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
  const prevVisitReferrerValue = refs.visitReferrer?.value;
  const options = getMemberUsers()
    .map(
      (member) =>
        `<option data-id="${escapeHtml(member.id)}" value="${escapeHtml(member.fullName)} (${escapeHtml(member.username)})"></option>`,
    )
    .join("");

  refs.referrerUserOptions.innerHTML = options;
  if (refs.visitReferrerOptions) {
    refs.visitReferrerOptions.innerHTML = options;
  }

  refs.referrerUser.value = prevReferrerValue;
  if (refs.visitReferrer) {
    refs.visitReferrer.value = prevVisitReferrerValue || "";
  }
  renderVisitReferralField();
}

function renderVisitReferralField() {
  if (!refs.visitReferrerGroup || !refs.visitReferrer) return;
  const canUseReferral = canUseReferralInVisitForm();
  refs.visitReferrerGroup.classList.toggle("hidden", !canUseReferral);
  if (!canUseReferral) {
    refs.visitReferrer.value = "";
  }
}

function syncMemberCreateServicePermissions() {
  if (!refs.permReferrals || !refs.permReferralsEdit || !refs.permReferralsDelete) return;
  refs.permReferrals.checked = Boolean(refs.permVisits.checked);
  refs.permReferralsEdit.checked = Boolean(refs.permVisitsEdit.checked);
  refs.permReferralsDelete.checked = Boolean(refs.permVisitsDelete.checked);
}

function syncMemberRowServicePermissions(row) {
  if (!row) return;
  const visitToggle = row.querySelector('input.permission-toggle[data-permission="visits"]');
  const visitEditToggle = row.querySelector('input.permission-toggle[data-permission="visitsEdit"]');
  const visitDeleteToggle = row.querySelector('input.permission-toggle[data-permission="visitsDelete"]');
  const referralToggle = row.querySelector('input.permission-toggle[data-permission="referrals"]');
  const referralEditToggle = row.querySelector('input.permission-toggle[data-permission="referralsEdit"]');
  const referralDeleteToggle = row.querySelector('input.permission-toggle[data-permission="referralsDelete"]');

  if (visitToggle && referralToggle) {
    referralToggle.checked = visitToggle.checked;
  }
  if (visitEditToggle && referralEditToggle) {
    referralEditToggle.checked = visitEditToggle.checked;
  }
  if (visitDeleteToggle && referralDeleteToggle) {
    referralDeleteToggle.checked = visitDeleteToggle.checked;
  }
}

function renderCustomers() {
  const currentUser = getCurrentUser();
  const canEdit = canEditCustomerInfo(currentUser);
  const canDelete = canDeleteCustomer(currentUser);

  const query = normalizeTextValue(refs.customerSearch?.value || "");
  const rows = state.customers
    .filter((item) => {
      if (!query) return true;
      const haystack = normalizeTextValue(
        `${item.name || ""} ${item.phone || ""} ${item.email || ""} ${item.note || ""}`,
      );
      return haystack.includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

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
        <td>${escapeHtml(item.name)}</td>
        <td class="truncate">${escapeHtml(item.phone || "-")}</td>
        <td class="truncate">${escapeHtml(item.email || "-")}</td>
        <td class="truncate">${escapeHtml(item.note || "-")}</td>
        <td>${new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
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
    if (refs.reportVisitSummary) refs.reportVisitSummary.innerHTML = "";
    refs.reportTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Vui lòng đăng nhập.</td></tr>';
    if (refs.reportVisitTableBody) {
      refs.reportVisitTableBody.innerHTML =
        '<tr><td class="empty-cell" colspan="7">Vui lòng đăng nhập.</td></tr>';
    }
    renderReportCustomerHistory(true);
    return;
  }

  const selectedMonth = refs.reportMonthFilter.value;
  const query = normalizeTextValue(refs.reportSearch?.value || "");
  const canSeeAllReports = isAdmin(currentUser) || Boolean(currentUser.permissions?.reportsAll);
  let filtered = state.referrals.filter((item) => item.referrerId);

  if (!canSeeAllReports) {
    filtered = filtered.filter((item) => item.referrerId === currentUser.id);
  }

  if (selectedMonth) {
    filtered = filtered.filter((item) => monthOf(item.date) === selectedMonth);
  }

  if (query) {
    filtered = filtered.filter((item) => {
      const refName = normalizeTextValue(getReferrerName(item.referrerId));
      const cust = normalizeTextValue(getReferredCustomerDisplay(item));
      return refName.includes(query) || cust.includes(query);
    });
  }

  if (refs.reportSearchOptions) {
    const options = [];
    const names = new Set();
    filtered.forEach((item) => {
      const refName = getReferrerName(item.referrerId);
      if (refName && !names.has(refName)) {
        names.add(refName);
        options.push(`<option value="${escapeHtml(refName)}"></option>`);
      }
      const custName = getReferredCustomerDisplay(item);
      if (custName && !names.has(custName)) {
        names.add(custName);
        options.push(`<option value="${escapeHtml(custName)}"></option>`);
      }
    });
    refs.reportSearchOptions.innerHTML = options.join("");
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

  // Voucher (visits) summary: chỉ hiển thị khi có quyền reportsAll hoặc admin
  if (canSeeAllReports) {
    const visitMonthFiltered = selectedMonth
      ? state.visits.filter((v) => monthOf(v.date) === selectedMonth)
      : state.visits;
    const visitFiltered = query
      ? visitMonthFiltered.filter((v) => normalizeTextValue(getCustomerName(v.customerId)).includes(query))
      : visitMonthFiltered;

    const visitRows = [...visitFiltered].sort(sortByLatest);
    if (refs.reportVisitTableBody) {
      if (visitRows.length === 0) {
        refs.reportVisitTableBody.innerHTML =
          '<tr><td class="empty-cell" colspan="7">Chưa có dữ liệu tích điểm phù hợp tháng lọc.</td></tr>';
      } else {
        refs.reportVisitTableBody.innerHTML = visitRows
          .map(
            (item) => `
          <tr>
            <td>${formatDate(item.date)}</td>
            <td>${escapeHtml(getCustomerName(item.customerId))}</td>
            <td>${escapeHtml(getProductName(item.productId))}</td>
            <td>Lần ${item.occurrence}</td>
            <td>${formatPercent(item.rate)}</td>
            <td>${formatMoney(item.revenue)}</td>
            <td>${formatMoney(item.voucher)}</td>
          </tr>
        `,
          )
          .join("");
      }
    }

    if (refs.reportVisitSummary) {
      const totalVisitRevenue = visitFiltered.reduce((sum, item) => sum + item.revenue, 0);
      const totalVoucher = visitFiltered.reduce((sum, item) => sum + item.voucher, 0);
      refs.reportVisitSummary.innerHTML = `
        <div class="summary-chip">
          <p>Số lượt tích điểm</p>
          <strong>${visitFiltered.length}</strong>
        </div>
        <div class="summary-chip">
          <p>Tổng doanh thu</p>
          <strong>${formatMoney(totalVisitRevenue)}</strong>
        </div>
        <div class="summary-chip">
          <p>Tổng voucher tích điểm</p>
          <strong>${formatMoney(totalVoucher)}</strong>
        </div>
      `;
    }
  } else {
    if (refs.reportVisitTableBody) {
      refs.reportVisitTableBody.innerHTML =
        '<tr><td class="empty-cell" colspan="7">Bạn chưa được cấp quyền xem tổng hợp tích điểm voucher.</td></tr>';
    }
    if (refs.reportVisitSummary) {
      refs.reportVisitSummary.innerHTML = "";
    }
  }

  renderReportCustomerHistory(false);
}

function renderReportCustomerHistory(skipUserCheck = false) {
  if (!refs.reportCustomerHistoryBody || !refs.reportCustomerSearch) return;
  const currentUser = getCurrentUser();
  if (!skipUserCheck && !currentUser) {
    refs.reportCustomerHistoryBody.innerHTML =
      '<tr><td class="empty-cell" colspan="8">Vui lòng đăng nhập.</td></tr>';
    return;
  }

  const customerId = resolveReportCustomerId();
  if (!customerId) {
    refs.reportCustomerHistoryBody.innerHTML =
      '<tr><td class="empty-cell" colspan="8">Chọn khách hàng để xem lịch sử dịch vụ.</td></tr>';
    return;
  }

  const entries = buildCustomerHistoryEntries(customerId);
  if (entries.length === 0) {
    refs.reportCustomerHistoryBody.innerHTML =
      '<tr><td class="empty-cell" colspan="8">Chưa có giao dịch cho khách này.</td></tr>';
    return;
  }

  const rows = entries
    .map(
      (item) => `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${escapeHtml(getCustomerName(customerId))}</td>
        <td>${escapeHtml(item.product)}</td>
        <td>Lần ${item.occurrence}</td>
        <td>${formatPercent(item.rate)}</td>
        <td>${formatMoney(item.revenue)}</td>
        <td>${formatMoney(item.value)}</td>
        <td>${item.type}</td>
      </tr>
    `,
    )
    .join("");

  refs.reportCustomerHistoryBody.innerHTML = rows;
}

function showCustomerHistory(customerId) {
  if (!customerId || !refs.historyContent) return;
  const customer = state.customers.find((item) => item.id === customerId);
  const title = customer ? `Lịch sử dịch vụ của ${customer.name}` : "Lịch sử dịch vụ";
  if (refs.historyTitle) {
    refs.historyTitle.textContent = title;
  }

  const combined = buildCustomerHistoryEntries(customerId);

  if (combined.length === 0) {
    refs.historyContent.innerHTML = "<p>Chưa có giao dịch cho khách này.</p>";
    showHistoryModal();
    return;
  }

  const rows = combined
    .map(
      (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(item.product)}</td>
          <td>Lần ${item.occurrence}</td>
          <td>${formatPercent(item.rate)}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.value)}</td>
          <td>${item.type}</td>
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
          <th>Giá trị</th>
          <th>Loại</th>
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
      '<tr><td class="empty-cell" colspan="25">Chỉ quản trị viên được xem danh sách tài khoản.</td></tr>';
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
      const serviceAccess = permissions.visits || permissions.referrals;
      const serviceEdit = permissions.visitsEdit || permissions.referralsEdit;
      const serviceDelete = permissions.visitsDelete || permissions.referralsDelete;
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
            <td class="hidden">Toàn quyền</td>
            <td class="hidden">Toàn quyền</td>
            <td class="hidden">Toàn quyền</td>
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
          ${renderPermissionCheckbox(user.id, "visits", serviceAccess)}
          ${renderPermissionCheckbox(user.id, "visitsEdit", serviceEdit)}
          ${renderPermissionCheckbox(user.id, "visitsDelete", serviceDelete)}
          ${renderPermissionCheckbox(user.id, "finance", permissions.finance)}
          ${renderPermissionCheckbox(user.id, "financeFund", permissions.financeFund)}
          ${renderPermissionCheckbox(user.id, "referrals", serviceAccess, "hidden")}
          ${renderPermissionCheckbox(user.id, "referralsEdit", serviceEdit, "hidden")}
          ${renderPermissionCheckbox(user.id, "referralsDelete", serviceDelete, "hidden")}
          ${renderPermissionCheckbox(user.id, "dataCleanup", permissions.dataCleanup)}
          ${renderPermissionCheckbox(user.id, "backupData", permissions.backupData)}
          <td><input type="checkbox" class="lock-toggle" data-user-id="${escapeHtml(user.id)}" ${user.locked ? "checked" : ""} /></td>
          ${renderPermissionCheckbox(user.id, "changePassword", permissions.changePassword)}
          ${renderPermissionCheckbox(user.id, "reports", permissions.reports)}
          ${renderPermissionCheckbox(user.id, "reportsAll", permissions.reportsAll)}
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

function renderPermissionCheckbox(userId, key, checked, cellClass = "") {
  return `<td class="${escapeHtml(cellClass)}"><input type="checkbox" class="permission-toggle" data-user-id="${escapeHtml(
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
  state.financeTransactions = Array.isArray(state.financeTransactions)
    ? state.financeTransactions
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const type = normalizeFinanceTransactionType(item.type);
          const amount = Number(item.amount || 0);
          const note = typeof item.note === "string" ? item.note : "";
          const category = normalizeFinanceExpenseCategory(item.category);
          const receiptImageDataUrl =
            typeof item.receiptImageDataUrl === "string"
              ? item.receiptImageDataUrl
              : typeof item.receipt_image_data_url === "string"
                ? item.receipt_image_data_url
                : typeof item.receiptImage?.dataUrl === "string"
                  ? item.receiptImage.dataUrl
                  : "";
          const receiptImageName =
            typeof item.receiptImageName === "string"
              ? item.receiptImageName
              : typeof item.receipt_image_name === "string"
                ? item.receipt_image_name
                : typeof item.receiptImage?.name === "string"
                  ? item.receiptImage.name
                  : "";
          const safeReceiptImageDataUrl = isFinanceReceiptDataUrl(receiptImageDataUrl) ? receiptImageDataUrl : "";
          const safeReceiptImageName = safeReceiptImageDataUrl ? String(receiptImageName || "").slice(0, 120) : "";
          const adjustmentOf =
            typeof item.adjustmentOf === "string"
              ? item.adjustmentOf
              : typeof item.adjustment_of === "string"
                ? item.adjustment_of
                : "";
          const transferId =
            typeof item.transferId === "string"
              ? item.transferId
              : typeof item.transfer_id === "string"
                ? item.transfer_id
                : "";
          const transferRoleRaw =
            typeof item.transferRole === "string"
              ? item.transferRole
              : typeof item.transfer_role === "string"
                ? item.transfer_role
                : "";
          const transferRoleNormalized = String(transferRoleRaw || "")
            .trim()
            .toUpperCase();
          const transferRole = transferRoleNormalized === "IN" || transferRoleNormalized === "OUT" ? transferRoleNormalized : "";
          const transferCounterpartyUserId =
            typeof item.transferCounterpartyUserId === "string"
              ? item.transferCounterpartyUserId
              : typeof item.transfer_counterparty_user_id === "string"
                ? item.transfer_counterparty_user_id
                : typeof item.counterpartyUserId === "string"
                  ? item.counterpartyUserId
                  : "";
          const isAdjustment = Boolean(item.isAdjustment || item.adjustment) || Boolean(adjustmentOf) || isAdjustmentFinanceNote(note);
          const createdBy =
            typeof item.createdBy === "string"
              ? item.createdBy
              : typeof item.created_by === "string"
                ? item.created_by
                : "";
          const createdAt =
            typeof item.createdAt === "string"
              ? item.createdAt
              : typeof item.timestamp === "string"
                ? item.timestamp
                : new Date().toISOString();
          return {
            id: typeof item.id === "string" && item.id ? item.id : createId("fin"),
            userId: typeof item.userId === "string" ? item.userId : "",
            type,
            amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
            category: type === FINANCE_TYPE_OUT ? category : "",
            note,
            isAdjustment,
            adjustmentOf,
            transferId,
            transferRole,
            transferCounterpartyUserId,
            receiptImageDataUrl: type === FINANCE_TYPE_OUT ? safeReceiptImageDataUrl : "",
            receiptImageName: type === FINANCE_TYPE_OUT ? safeReceiptImageName : "",
            createdBy,
            created_by: createdBy,
            createdAt,
            timestamp: createdAt,
          };
        })
        .filter((item) => item.userId && item.type && item.amount > 0)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    : [];

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
    if (typeof item.sourceVisitId !== "string") item.sourceVisitId = "";

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
