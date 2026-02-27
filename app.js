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
  users: "manageUsers",
};

const MEMBER_PERMISSION_KEYS = ["customers", "customerEdit", "products", "visits", "referrals", "reports"];

const state = {
  customers: [],
  products: [],
  visits: [],
  referrals: [],
  users: [],
  currentUserId: null,
  editingCustomerId: null,
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
  productFormResult: document.getElementById("product-form-result"),
  productTableBody: document.getElementById("product-table-body"),

  visitForm: document.getElementById("visit-form"),
  visitCustomer: document.getElementById("visit-customer"),
  visitProduct: document.getElementById("visit-product"),
  visitDate: document.getElementById("visit-date"),
  visitRevenue: document.getElementById("visit-revenue"),
  visitResult: document.getElementById("visit-result"),
  visitTableBody: document.getElementById("visit-table-body"),
  visitMonthFilter: document.getElementById("visit-month-filter"),
  visitSummary: document.getElementById("visit-summary"),

  referralForm: document.getElementById("referral-form"),
  referrerUser: document.getElementById("referrer-user"),
  referredCustomer: document.getElementById("referred-customer"),
  referralProduct: document.getElementById("referral-product"),
  referralDate: document.getElementById("referral-date"),
  referralRevenue: document.getElementById("referral-revenue"),
  referralResult: document.getElementById("referral-result"),
  referralTableBody: document.getElementById("referral-table-body"),
  referralMonthFilter: document.getElementById("referral-month-filter"),
  referralSummary: document.getElementById("referral-summary"),

  reportMonthFilter: document.getElementById("report-month-filter"),
  reportSummary: document.getElementById("report-summary"),
  reportTableBody: document.getElementById("report-table-body"),

  memberForm: document.getElementById("member-form"),
  memberFullName: document.getElementById("member-full-name"),
  memberUsername: document.getElementById("member-username"),
  memberPassword: document.getElementById("member-password"),
  permCustomers: document.getElementById("perm-customers"),
  permCustomerEdit: document.getElementById("perm-customer-edit"),
  permProducts: document.getElementById("perm-products"),
  permVisits: document.getElementById("perm-visits"),
  permReferrals: document.getElementById("perm-referrals"),
  permReports: document.getElementById("perm-reports"),
  memberFormResult: document.getElementById("member-form-result"),
  userTableBody: document.getElementById("user-table-body"),
};

async function initialize() {
  renderRuntimeMode();
  setDefaultDates();
  setDefaultMemberPermissionInputs();
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

  refs.visitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addVisit();
  });

  refs.referralForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addReferral();
  });

  refs.visitMonthFilter.addEventListener("change", renderVisits);
  refs.referralMonthFilter.addEventListener("change", renderReferrals);
  refs.reportMonthFilter.addEventListener("change", renderReport);

  refs.memberForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addMemberAccount();
  });

  refs.userTableBody.addEventListener("click", handleUserTableClick);
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  refs.visitDate.value = today;
  refs.referralDate.value = today;
  refs.visitMonthFilter.value = thisMonth;
  refs.referralMonthFilter.value = thisMonth;
  refs.reportMonthFilter.value = thisMonth;
}

function setDefaultMemberPermissionInputs() {
  refs.permCustomers.checked = false;
  refs.permCustomerEdit.checked = false;
  refs.permProducts.checked = false;
  refs.permVisits.checked = false;
  refs.permReferrals.checked = false;
  refs.permReports.checked = true;
}

function renderRuntimeMode() {
  if (!refs.runtimeMode) return;

  refs.runtimeMode.textContent = runtime.remoteMode ? "Chế độ: Server dùng chung" : "Chế độ: Local 1 máy";
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
    visits: false,
    referrals: false,
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
    visits: Boolean(source.visits ?? defaults.visits),
    referrals: Boolean(source.referrals ?? defaults.referrals),
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
    permissions:
      role === "admin"
        ? { customers: true, customerEdit: true, products: true, visits: true, referrals: true, reports: true }
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
      permissions: { customers: true, customerEdit: true, products: true, visits: true, referrals: true, reports: true },
      createdAt: new Date().toISOString(),
    });
  }

  state.users = state.users.map((user) => {
    if (user.role !== "admin") return user;

    return {
      ...user,
      permissions: { customers: true, customerEdit: true, products: true, visits: true, referrals: true, reports: true },
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
  if (!user) {
    state.editingCustomerId = null;
    setCustomerFormMode(false);

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

  const roleLabel = isAdmin(user) ? "Admin" : "Nhân viên";
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
    throw new Error("File CSV trống.");
  }

  const headers = table[0].map((item) => normalizeHeader(item));
  const indexOf = (aliases) => headers.findIndex((item) => aliases.includes(item));

  const nameIndex = indexOf(["name", "ten", "hoten", "fullname", "customername"]);
  const phoneIndex = indexOf(["phone", "sdt", "sodienthoai", "dienthoai", "mobile"]);
  const emailIndex = indexOf(["email"]);
  const noteIndex = indexOf(["note", "ghichu"]);

  if (nameIndex < 0) {
    throw new Error("Thiếu cột bắt buộc `name` (hoặc `ten`) trong file CSV.");
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
  refs.customerImportResult.textContent = "Đã tải file mẫu CSV khách hàng.";
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
  refs.customerImportResult.textContent = `Đã xuất ${state.customers.length} khách hàng ra file CSV.`;
}

async function importCustomersFromFile() {
  if (!ensureFeature("customers", refs.customerImportResult)) return;

  const file = refs.customerImportFile.files?.[0];
  if (!file) {
    refs.customerImportResult.textContent = "Vui lòng chọn file CSV trước khi nhập dữ liệu.";
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
    refs.customerImportResult.textContent = `Đã nhập ${parsed.rows.length} khách hàng từ CSV. Bỏ qua ${parsed.skippedCount} dòng không hợp lệ.`;
  } catch (error) {
    refs.customerImportResult.textContent = error.message || "Không thể nhập dữ liệu từ file CSV.";
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
    refs.customerImportResult.textContent = `Đã nhập ${importedCount} khách hàng từ CSV. Bỏ qua ${totalSkipped} dòng không hợp lệ.`;
  } catch (error) {
    handleRemoteActionError(error, refs.customerImportResult, "Không thể nhập dữ liệu khách hàng từ CSV.");
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
    refs.customerFormResult.textContent = "Chỉ admin mới có quyền xoá khách hàng.";
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
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.customerFormResult, "Không thể xoá khách hàng.");
  }
}

function addProduct() {
  if (runtime.remoteMode) {
    void addProductRemote();
    return;
  }

  if (!ensureFeature("products", refs.productFormResult)) return;

  const name = refs.productName.value.trim();
  const code = refs.productCode.value.trim();
  const defaultPrice = Number(refs.productDefaultPrice.value || 0);
  const note = refs.productNote.value.trim();

  if (!name) {
    refs.productFormResult.textContent = "Vui lòng nhập tên sản phẩm / dịch vụ.";
    return;
  }

  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    refs.productFormResult.textContent = "Giá gợi ý không hợp lệ.";
    return;
  }

  const product = {
    id: createId("prd"),
    name,
    code,
    defaultPrice,
    note,
    createdAt: new Date().toISOString(),
  };

  state.products.unshift(product);
  saveState();

  refs.productForm.reset();
  refs.productFormResult.textContent = `Đã thêm sản phẩm/dịch vụ: ${name}.`;
  renderAll();
}

async function addProductRemote() {
  if (!ensureFeature("products", refs.productFormResult)) return;

  const name = refs.productName.value.trim();
  const code = refs.productCode.value.trim();
  const defaultPrice = Number(refs.productDefaultPrice.value || 0);
  const note = refs.productNote.value.trim();

  if (!name) {
    refs.productFormResult.textContent = "Vui lòng nhập tên sản phẩm / dịch vụ.";
    return;
  }

  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    refs.productFormResult.textContent = "Giá gợi ý không hợp lệ.";
    return;
  }

  try {
    const payload = await apiRequest("/products", {
      method: "POST",
      body: { name, code, defaultPrice, note },
    });

    if (payload?.product) {
      state.products.unshift(payload.product);
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    refs.productForm.reset();
    refs.productFormResult.textContent = `Đã thêm sản phẩm/dịch vụ: ${name}.`;
    renderAll();
  } catch (error) {
    handleRemoteActionError(error, refs.productFormResult, "Không thể thêm sản phẩm/dịch vụ.");
  }
}

function addVisit() {
  if (runtime.remoteMode) {
    void addVisitRemote();
    return;
  }

  if (!ensureFeature("visits", refs.visitResult)) return;

  if (state.customers.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận lượt đến.";
    return;
  }

  if (state.products.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giao dịch.";
    return;
  }

  const customerId = refs.visitCustomer.value;
  const productId = refs.visitProduct.value;
  const date = refs.visitDate.value;
  const revenue = Number(refs.visitRevenue.value || 0);

  if (!customerId || !productId || !date || revenue <= 0) {
    refs.visitResult.textContent = "Vui lòng nhập đủ khách hàng, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return;
  }

  const validCustomer = state.customers.some((item) => item.id === customerId);
  const validProduct = state.products.some((item) => item.id === productId);

  if (!validCustomer || !validProduct) {
    refs.visitResult.textContent = "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.";
    return;
  }

  const visitMonth = monthOf(date);
  const visitRecord = {
    id: createId("visit"),
    customerId,
    productId,
    date,
    revenue,
    occurrence: 0,
    rate: 0,
    voucher: 0,
    createdAt: new Date().toISOString(),
  };

  state.visits.unshift(visitRecord);
  normalizeVisitMonth(customerId, visitMonth);
  const savedVisit = state.visits.find((item) => item.id === visitRecord.id);

  saveState();
  refs.visitRevenue.value = "";

  refs.visitResult.textContent = `${getCustomerName(customerId)} - ${getProductName(productId)} - lần ${savedVisit.occurrence} trong tháng ${visitMonth}: ${formatPercent(savedVisit.rate)} | Voucher tích điểm: ${formatMoney(savedVisit.voucher)}.`;
  renderVisits();
}

async function addVisitRemote() {
  if (!ensureFeature("visits", refs.visitResult)) return;

  if (state.customers.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận lượt đến.";
    return;
  }

  if (state.products.length === 0) {
    refs.visitResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giao dịch.";
    return;
  }

  const customerId = refs.visitCustomer.value;
  const productId = refs.visitProduct.value;
  const date = refs.visitDate.value;
  const revenue = Number(refs.visitRevenue.value || 0);

  if (!customerId || !productId || !date || revenue <= 0) {
    refs.visitResult.textContent = "Vui lòng nhập đủ khách hàng, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return;
  }

  try {
    const payload = await apiRequest("/visits", {
      method: "POST",
      body: { customerId, productId, date, revenue },
    });

    if (Array.isArray(payload?.visits)) {
      state.visits = payload.visits;
      normalizeAllRecords();
    } else if (payload?.visit) {
      state.visits.unshift(payload.visit);
      normalizeVisitMonth(customerId, monthOf(date));
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    const savedVisit = state.visits.find((item) => item.id === payload?.visit?.id) || payload?.visit;
    refs.visitRevenue.value = "";

    if (savedVisit) {
      refs.visitResult.textContent = `${getCustomerName(customerId)} - ${getProductName(productId)} - lần ${savedVisit.occurrence} trong tháng ${monthOf(date)}: ${formatPercent(savedVisit.rate)} | Voucher tích điểm: ${formatMoney(savedVisit.voucher)}.`;
    } else {
      refs.visitResult.textContent = "Đã ghi nhận giao dịch tích điểm.";
    }

    renderVisits();
  } catch (error) {
    handleRemoteActionError(error, refs.visitResult, "Không thể ghi nhận giao dịch tích điểm.");
  }
}

function addReferral() {
  if (runtime.remoteMode) {
    void addReferralRemote();
    return;
  }

  if (!ensureFeature("referrals", refs.referralResult)) return;

  if (state.customers.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận giới thiệu.";
    return;
  }

  if (state.products.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giới thiệu.";
    return;
  }

  const referrerId = refs.referrerUser.value;
  const referredCustomerId = refs.referredCustomer.value;
  const productId = refs.referralProduct.value;
  const date = refs.referralDate.value;
  const revenue = Number(refs.referralRevenue.value || 0);

  if (!referredCustomerId || !productId || !date || revenue <= 0) {
    refs.referralResult.textContent = "Vui lòng nhập đủ khách được giới thiệu, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return;
  }

  const memberIds = new Set(getMemberUsers().map((user) => user.id));
  if (referrerId && !memberIds.has(referrerId)) {
    refs.referralResult.textContent = "Người giới thiệu phải là tài khoản thành viên do admin tạo.";
    return;
  }

  const validCustomer = state.customers.some((item) => item.id === referredCustomerId);
  const validProduct = state.products.some((item) => item.id === productId);

  if (!validCustomer || !validProduct) {
    refs.referralResult.textContent = "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.";
    return;
  }

  const referralMonth = monthOf(date);
  const referralRecord = {
    id: createId("ref"),
    referrerId: referrerId || "",
    referredCustomerId,
    referredName: "",
    productId,
    date,
    revenue,
    occurrence: 0,
    rate: 0,
    commission: 0,
    createdAt: new Date().toISOString(),
  };

  state.referrals.unshift(referralRecord);

  if (referrerId) {
    normalizeReferralMonth(referrerId, referralMonth);
  }

  const savedReferral = state.referrals.find((item) => item.id === referralRecord.id);

  saveState();
  refs.referralRevenue.value = "";
  refs.referredCustomer.value = "";

  const referredCustomerName = getCustomerName(referredCustomerId);
  const productName = getProductName(productId);

  if (!referrerId) {
    refs.referralResult.textContent = `Đã ghi nhận giao dịch cho ${referredCustomerName} - ${productName} (không có người giới thiệu). Hoa hồng: ${formatMoney(0)}.`;
  } else {
    refs.referralResult.textContent = `${getReferrerName(referrerId)} - ${referredCustomerName} - ${productName} - lần giới thiệu ${savedReferral.occurrence} trong tháng ${referralMonth}: ${formatPercent(savedReferral.rate)} | Hoa hồng: ${formatMoney(savedReferral.commission)}.`;
  }

  renderReferrals();
  renderReport();
}

async function addReferralRemote() {
  if (!ensureFeature("referrals", refs.referralResult)) return;

  if (state.customers.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo khách hàng trước khi ghi nhận giới thiệu.";
    return;
  }

  if (state.products.length === 0) {
    refs.referralResult.textContent = "Bạn cần tạo sản phẩm/dịch vụ trước khi ghi nhận giới thiệu.";
    return;
  }

  const referrerId = refs.referrerUser.value;
  const referredCustomerId = refs.referredCustomer.value;
  const productId = refs.referralProduct.value;
  const date = refs.referralDate.value;
  const revenue = Number(refs.referralRevenue.value || 0);

  if (!referredCustomerId || !productId || !date || revenue <= 0) {
    refs.referralResult.textContent = "Vui lòng nhập đủ khách được giới thiệu, sản phẩm/dịch vụ, ngày và doanh thu > 0.";
    return;
  }

  const memberIds = new Set(getMemberUsers().map((user) => user.id));
  if (referrerId && !memberIds.has(referrerId)) {
    refs.referralResult.textContent = "Người giới thiệu phải là tài khoản thành viên do admin tạo.";
    return;
  }

  try {
    const payload = await apiRequest("/referrals", {
      method: "POST",
      body: { referrerId, referredCustomerId, productId, date, revenue },
    });

    if (Array.isArray(payload?.referrals)) {
      state.referrals = payload.referrals;
      normalizeAllRecords();
    } else if (payload?.referral) {
      state.referrals.unshift(payload.referral);
      if (referrerId) {
        normalizeReferralMonth(referrerId, monthOf(date));
      }
    } else {
      await syncFromServer({ preserveTab: true, silent: true });
    }

    const savedReferral = state.referrals.find((item) => item.id === payload?.referral?.id) || payload?.referral;

    refs.referralRevenue.value = "";
    refs.referredCustomer.value = "";

    const referredCustomerName = getCustomerName(referredCustomerId);
    const productName = getProductName(productId);

    if (!referrerId) {
      refs.referralResult.textContent = `Đã ghi nhận giao dịch cho ${referredCustomerName} - ${productName} (không có người giới thiệu). Hoa hồng: ${formatMoney(0)}.`;
    } else if (savedReferral) {
      refs.referralResult.textContent = `${getReferrerName(referrerId)} - ${referredCustomerName} - ${productName} - lần giới thiệu ${savedReferral.occurrence} trong tháng ${monthOf(date)}: ${formatPercent(savedReferral.rate)} | Hoa hồng: ${formatMoney(savedReferral.commission)}.`;
    } else {
      refs.referralResult.textContent = "Đã ghi nhận giao dịch hoa hồng.";
    }

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
    refs.memberFormResult.textContent = "Chỉ admin mới có quyền tạo tài khoản nhân viên.";
    return;
  }

  const fullName = refs.memberFullName.value.trim();
  const username = refs.memberUsername.value.trim();
  const password = refs.memberPassword.value;

  if (!fullName || !username || !password) {
    refs.memberFormResult.textContent = "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.";
    return;
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    refs.memberFormResult.textContent = "Tên đăng nhập chỉ chứa chữ, số và các ký tự . _ -.";
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
      visits: Boolean(refs.permVisits.checked),
      referrals: Boolean(refs.permReferrals.checked),
      reports: Boolean(refs.permReports.checked),
    },
    createdAt: new Date().toISOString(),
  };

  state.users.push(member);
  saveState();

  refs.memberForm.reset();
  setDefaultMemberPermissionInputs();
  refs.memberFormResult.textContent = `Đã tạo tài khoản ${username}.`;

  renderUserAccounts();
  renderReferrerOptions();
}

async function addMemberAccountRemote() {
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) {
    refs.memberFormResult.textContent = "Chỉ admin mới có quyền tạo tài khoản nhân viên.";
    return;
  }

  const fullName = refs.memberFullName.value.trim();
  const username = refs.memberUsername.value.trim();
  const password = refs.memberPassword.value;

  if (!fullName || !username || !password) {
    refs.memberFormResult.textContent = "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.";
    return;
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    refs.memberFormResult.textContent = "Tên đăng nhập chỉ chứa chữ, số và các ký tự . _ -.";
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
          visits: Boolean(refs.permVisits.checked),
          referrals: Boolean(refs.permReferrals.checked),
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

  member.permissions = buildMemberPermissions(nextPermissions);
  saveState();

  refs.memberFormResult.textContent = `Đã cập nhật quyền cho ${member.username}.`;
  renderUserAccounts();
}

async function handleUserTableClickRemote(event) {
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

  try {
    const payload = await apiRequest(`/users/${encodeURIComponent(userId)}/permissions`, {
      method: "PATCH",
      body: { permissions: nextPermissions },
    });

    if (payload?.user) {
      member.permissions = buildMemberPermissions(payload.user.permissions);
    } else {
      member.permissions = buildMemberPermissions(nextPermissions);
    }

    refs.memberFormResult.textContent = `Đã cập nhật quyền cho ${member.username}.`;
    renderUserAccounts();
  } catch (error) {
    handleRemoteActionError(error, refs.memberFormResult, "Không thể cập nhật quyền tài khoản.");
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
  const defaultOption = '<option value="">-- Chọn khách hàng --</option>';
  const options = state.customers
    .map(
      (customer) =>
        `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.phone ? ` - ${escapeHtml(customer.phone)}` : ""}</option>`,
    )
    .join("");

  refs.visitCustomer.innerHTML = defaultOption + options;
  refs.referredCustomer.innerHTML = defaultOption + options;

  if (state.customers.some((item) => item.id === prevVisitValue)) {
    refs.visitCustomer.value = prevVisitValue;
  }

  if (state.customers.some((item) => item.id === prevReferredValue)) {
    refs.referredCustomer.value = prevReferredValue;
  }
}

function renderProductOptions() {
  const prevVisitProduct = refs.visitProduct.value;
  const prevReferralProduct = refs.referralProduct.value;
  const defaultOption = '<option value="">-- Chọn sản phẩm/dịch vụ --</option>';
  const options = state.products
    .map(
      (product) =>
        `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}${product.code ? ` (${escapeHtml(product.code)})` : ""}</option>`,
    )
    .join("");

  refs.visitProduct.innerHTML = defaultOption + options;
  refs.referralProduct.innerHTML = defaultOption + options;

  if (state.products.some((item) => item.id === prevVisitProduct)) {
    refs.visitProduct.value = prevVisitProduct;
  }

  if (state.products.some((item) => item.id === prevReferralProduct)) {
    refs.referralProduct.value = prevReferralProduct;
  }
}

function renderReferrerOptions() {
  const prevReferrerValue = refs.referrerUser.value;
  const defaultOption = '<option value="">-- Để trống / không có người giới thiệu --</option>';
  const options = getMemberUsers()
    .map(
      (member) =>
        `<option value="${escapeHtml(member.id)}">${escapeHtml(member.fullName)} (${escapeHtml(member.username)})</option>`,
    )
    .join("");

  refs.referrerUser.innerHTML = defaultOption + options;

  if (getMemberUsers().some((item) => item.id === prevReferrerValue)) {
    refs.referrerUser.value = prevReferrerValue;
  }
}

function renderCustomers() {
  const currentUser = getCurrentUser();
  const canEdit = canEditCustomerInfo(currentUser);
  const canDelete = canDeleteCustomer(currentUser);

  if (state.customers.length === 0) {
    refs.customerTableBody.innerHTML = '<tr><td class="empty-cell" colspan="6">Chưa có khách hàng nào.</td></tr>';
    return;
  }

  refs.customerTableBody.innerHTML = state.customers
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
  if (state.products.length === 0) {
    refs.productTableBody.innerHTML = '<tr><td class="empty-cell" colspan="5">Chưa có sản phẩm/dịch vụ nào.</td></tr>';
    return;
  }

  refs.productTableBody.innerHTML = state.products
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.code || "-")}</td>
        <td>${item.defaultPrice > 0 ? formatMoney(item.defaultPrice) : "-"}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td>${new Date(item.createdAt).toLocaleString("vi-VN")}</td>
      </tr>
    `,
    )
    .join("");
}

function renderVisits() {
  const selectedMonth = refs.visitMonthFilter.value;
  const filtered = selectedMonth ? state.visits.filter((item) => monthOf(item.date) === selectedMonth) : state.visits;
  const rows = [...filtered].sort(sortByLatest);

  if (rows.length === 0) {
    refs.visitTableBody.innerHTML = '<tr><td class="empty-cell" colspan="7">Chưa có giao dịch phù hợp tháng lọc.</td></tr>';
  } else {
    refs.visitTableBody.innerHTML = rows
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
  const selectedMonth = refs.referralMonthFilter.value;
  const filtered = selectedMonth
    ? state.referrals.filter((item) => monthOf(item.date) === selectedMonth)
    : state.referrals;
  const rows = [...filtered].sort(sortByLatest);

  if (rows.length === 0) {
    refs.referralTableBody.innerHTML = '<tr><td class="empty-cell" colspan="8">Chưa có giao dịch phù hợp tháng lọc.</td></tr>';
  } else {
    refs.referralTableBody.innerHTML = rows
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(getReferrerName(item.referrerId))}</td>
          <td>${escapeHtml(getReferredCustomerDisplay(item))}</td>
          <td>${escapeHtml(getProductName(item.productId))}</td>
          <td>${item.referrerId ? `Lần ${item.occurrence}` : "-"}</td>
          <td>${item.referrerId ? formatPercent(item.rate) : "0%"}</td>
          <td>${formatMoney(item.revenue)}</td>
          <td>${formatMoney(item.commission)}</td>
        </tr>
      `,
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

function renderUserAccounts() {
  const currentUser = getCurrentUser();
  if (!isAdmin(currentUser)) {
    refs.userTableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="10">Chỉ admin được xem danh sách tài khoản.</td></tr>';
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

      if (user.role === "admin") {
        return `
          <tr>
            <td>${escapeHtml(user.fullName)} (Admin)</td>
            <td>${escapeHtml(user.username)}</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>Toàn quyền</td>
            <td>-</td>
            <td>${createdAt}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="customers"
              ${permissions.customers ? "checked" : ""}
            />
          </td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="customerEdit"
              ${permissions.customerEdit ? "checked" : ""}
            />
          </td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="products"
              ${permissions.products ? "checked" : ""}
            />
          </td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="visits"
              ${permissions.visits ? "checked" : ""}
            />
          </td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="referrals"
              ${permissions.referrals ? "checked" : ""}
            />
          </td>
          <td>
            <input
              type="checkbox"
              class="permission-toggle"
              data-user-id="${escapeHtml(user.id)}"
              data-permission="reports"
              ${permissions.reports ? "checked" : ""}
            />
          </td>
          <td>
            <button type="button" class="secondary-btn table-btn save-permissions-btn" data-user-id="${escapeHtml(user.id)}">Lưu</button>
          </td>
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
