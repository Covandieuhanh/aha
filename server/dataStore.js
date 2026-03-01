const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const persistListeners = [];

const DEFAULT_ADMIN_USERNAME = process.env.AHA_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.AHA_ADMIN_PASSWORD || "admin123";

const ADMIN_PERMISSIONS = {
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
  reports: true,
  reportsAll: true,
  dataCleanup: true,
  backupData: true,
  changePassword: true,
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
}

function monthOf(dateValue) {
  return typeof dateValue === "string" ? dateValue.slice(0, 7) : "";
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

function getRateByOccurrence(occurrence) {
  const step = Math.min(Math.max(Number(occurrence) || 0, 1), 10);
  return step * 0.05;
}

function sortByDateThenCreatedAtAsc(a, b) {
  const byDate = (a.date || "").localeCompare(b.date || "");
  if (byDate !== 0) return byDate;
  return (a.createdAt || "").localeCompare(b.createdAt || "");
}

function defaultMemberPermissions() {
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
    reports: true,
    reportsAll: false,
    dataCleanup: false,
    backupData: false,
    changePassword: false,
  };
}

function buildMemberPermissions(rawPermissions) {
  const defaults = defaultMemberPermissions();
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
    reports: Boolean(source.reports ?? defaults.reports),
    reportsAll: Boolean(source.reportsAll ?? defaults.reportsAll),
    dataCleanup: Boolean(source.dataCleanup ?? defaults.dataCleanup),
    backupData: Boolean(source.backupData ?? defaults.backupData),
    changePassword: Boolean(source.changePassword ?? defaults.changePassword),
  };
}

function ensureDataDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeVisitMonth(state, customerId, targetMonth) {
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

function normalizeReferralMonth(state, referrerId, targetMonth) {
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

function normalizeAllRecords(state) {
  state.customers = Array.isArray(state.customers)
    ? state.customers
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : createId("cus"),
          name: typeof item.name === "string" ? item.name.trim() : "",
          phone: typeof item.phone === "string" ? item.phone.trim() : "",
          email: typeof item.email === "string" ? item.email.trim() : "",
          note: typeof item.note === "string" ? item.note : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        }))
        .filter((item) => item.name)
    : [];

  state.products = Array.isArray(state.products)
    ? state.products
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : createId("prd"),
          name: typeof item.name === "string" ? item.name.trim() : "",
          code: typeof item.code === "string" ? item.code.trim() : "",
          defaultPrice: Number(item.defaultPrice) > 0 ? Number(item.defaultPrice) : 0,
          note: typeof item.note === "string" ? item.note : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        }))
        .filter((item) => item.name)
    : [];

  state.visits = Array.isArray(state.visits)
    ? state.visits
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : createId("visit"),
          customerId: typeof item.customerId === "string" ? item.customerId : "",
          productId: typeof item.productId === "string" ? item.productId : "",
          date: typeof item.date === "string" ? item.date : "",
          revenue: Number(item.revenue) > 0 ? Number(item.revenue) : 0,
          occurrence: Number(item.occurrence) > 0 ? Number(item.occurrence) : 0,
          rate: Number(item.rate) > 0 ? Number(item.rate) : 0,
          voucher: Number(item.voucher) > 0 ? Number(item.voucher) : 0,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        }))
        .filter((item) => item.customerId && item.productId && item.date && item.revenue > 0)
    : [];

  state.referrals = Array.isArray(state.referrals)
    ? state.referrals
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : createId("ref"),
          referrerId: typeof item.referrerId === "string" ? item.referrerId : "",
          referredCustomerId: typeof item.referredCustomerId === "string" ? item.referredCustomerId : "",
          referredName: typeof item.referredName === "string" ? item.referredName : "",
          sourceVisitId: typeof item.sourceVisitId === "string" ? item.sourceVisitId : "",
          productId: typeof item.productId === "string" ? item.productId : "",
          date: typeof item.date === "string" ? item.date : "",
          revenue: Number(item.revenue) > 0 ? Number(item.revenue) : 0,
          occurrence: Number(item.occurrence) > 0 ? Number(item.occurrence) : 0,
          rate: Number(item.rate) > 0 ? Number(item.rate) : 0,
          commission: Number(item.commission) > 0 ? Number(item.commission) : 0,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        }))
        .filter((item) => item.referredCustomerId && item.productId && item.date && item.revenue > 0)
    : [];

  state.pushSubscriptions = Array.isArray(state.pushSubscriptions)
    ? state.pushSubscriptions
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const endpoint = typeof item.endpoint === "string" ? item.endpoint.trim() : "";
          const userId = typeof item.userId === "string" ? item.userId : "";
          const p256dh = typeof item?.keys?.p256dh === "string" ? item.keys.p256dh : "";
          const auth = typeof item?.keys?.auth === "string" ? item.keys.auth : "";

          return {
            id: typeof item.id === "string" && item.id ? item.id : createId("push"),
            userId,
            endpoint,
            keys: { p256dh, auth },
            ua: typeof item.ua === "string" ? item.ua.slice(0, 180) : "",
            createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
            lastActiveAt:
              typeof item.lastActiveAt === "string"
                ? item.lastActiveAt
                : typeof item.createdAt === "string"
                  ? item.createdAt
                  : new Date().toISOString(),
          };
        })
        .filter((item) => item.endpoint && item.userId && item.keys?.p256dh && item.keys?.auth)
    : [];

  const visitGroups = new Set(state.visits.map((item) => `${item.customerId}|${monthOf(item.date)}`));
  visitGroups.forEach((groupKey) => {
    const [customerId, targetMonth] = groupKey.split("|");
    normalizeVisitMonth(state, customerId, targetMonth);
  });

  const referralGroups = new Set(
    state.referrals.filter((item) => item.referrerId).map((item) => `${item.referrerId}|${monthOf(item.date)}`),
  );
  referralGroups.forEach((groupKey) => {
    const [referrerId, targetMonth] = groupKey.split("|");
    normalizeReferralMonth(state, referrerId, targetMonth);
  });
}

function normalizeUser(user) {
  const role = user && user.role === "admin" ? "admin" : "member";
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  const fullName = typeof user?.fullName === "string" ? user.fullName.trim() : "";
  const legacyPassword = typeof user?.password === "string" ? user.password : "";

  let passwordHash = typeof user?.passwordHash === "string" ? user.passwordHash : "";
  if (!passwordHash && legacyPassword) {
    passwordHash = bcrypt.hashSync(legacyPassword, 10);
  }

  if (role === "admin" && !passwordHash) {
    passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
  }

  if (role === "member" && !passwordHash) {
    passwordHash = bcrypt.hashSync(createId("tmp"), 10);
  }

  return {
    id: typeof user?.id === "string" && user.id ? user.id : createId("user"),
    username,
    fullName: fullName || (role === "admin" ? "Quản trị Aha" : "Thành viên"),
    role,
    locked: Boolean(user?.locked) && role !== "admin",
    permissions: role === "admin" ? { ...ADMIN_PERMISSIONS } : buildMemberPermissions(user?.permissions),
    passwordHash,
    createdAt: typeof user?.createdAt === "string" ? user.createdAt : new Date().toISOString(),
  };
}

function ensureAdminAccount(state) {
  state.users = Array.isArray(state.users) ? state.users.map(normalizeUser) : [];

  const hasAdmin = state.users.some((item) => item.role === "admin");
  if (!hasAdmin) {
    state.users.unshift({
      id: "user-admin-default",
      username: DEFAULT_ADMIN_USERNAME,
      fullName: "Quản trị Aha",
      role: "admin",
      locked: false,
      permissions: { ...ADMIN_PERMISSIONS },
      passwordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      createdAt: new Date().toISOString(),
    });
  }

  state.users = state.users.map((user) => {
    if (user.role !== "admin") return user;

    return {
      ...user,
      username: user.username || DEFAULT_ADMIN_USERNAME,
      passwordHash: user.passwordHash || bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      locked: false,
      permissions: { ...ADMIN_PERMISSIONS },
    };
  });
}

function createInitialState() {
  return {
    customers: [],
    products: [],
    visits: [],
    referrals: [],
    users: [],
    pushSubscriptions: [],
  };
}

function readStateFromDisk() {
  ensureDataDirectory();

  if (!fs.existsSync(DATA_FILE)) {
    return createInitialState();
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) return createInitialState();

    const parsed = JSON.parse(raw);
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      visits: Array.isArray(parsed.visits) ? parsed.visits : [],
      referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      pushSubscriptions: Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [],
    };
  } catch (error) {
    return createInitialState();
  }
}

function writeStateToDisk(state) {
  ensureDataDirectory();
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
}

let state = readStateFromDisk();
normalizeAllRecords(state);
ensureAdminAccount(state);
writeStateToDisk(state);

function persist() {
  writeStateToDisk(state);

  if (persistListeners.length > 0) {
    persistListeners.forEach((listener) => {
      try {
        listener({
          dataFile: DATA_FILE,
          changedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[AHA] Persist listener failed:", error);
      }
    });
  }
}

function addPersistListener(listener) {
  if (typeof listener !== "function") return () => {};
  persistListeners.push(listener);

  return () => {
    const index = persistListeners.indexOf(listener);
    if (index >= 0) {
      persistListeners.splice(index, 1);
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    locked: Boolean(user.locked),
    permissions: user.role === "admin" ? { ...ADMIN_PERMISSIONS } : buildMemberPermissions(user.permissions),
    createdAt: user.createdAt,
  };
}

function hasFeaturePermission(user, featureKey) {
  if (!user) return false;
  if (user.role === "admin") return true;
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

function findUserById(userId) {
  return state.users.find((item) => item.id === userId) || null;
}

function findUserByUsername(username) {
  if (!username) return null;
  const lowered = String(username).trim().toLowerCase();
  return state.users.find((item) => item.username.toLowerCase() === lowered) || null;
}

function upsertPushSubscription(userId, subscription, ua) {
  if (!userId) {
    throw httpError(400, "Thiếu thông tin người dùng cho đăng ký thông báo.");
  }

  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint.trim() : "";
  const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
  const auth = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    throw httpError(400, "Thiếu dữ liệu đăng ký push (endpoint hoặc keys).");
  }

  const normalized = {
    id: createId("push"),
    userId,
    endpoint,
    keys: { p256dh, auth },
    ua: typeof ua === "string" ? ua.slice(0, 180) : "",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const existingIndex = state.pushSubscriptions.findIndex((item) => item.endpoint === endpoint);
  if (existingIndex >= 0) {
    const current = state.pushSubscriptions[existingIndex];
    state.pushSubscriptions[existingIndex] = {
      ...current,
      ...normalized,
      id: current.id,
      createdAt: current.createdAt,
    };
    persist();
    return clone(state.pushSubscriptions[existingIndex]);
  }

  state.pushSubscriptions.push(normalized);
  persist();
  return clone(normalized);
}

function getPushSubscriptionsForUser(userId) {
  if (!userId) return [];
  return state.pushSubscriptions.filter((item) => item.userId === userId).map(clone);
}

function removePushSubscriptionByEndpoint(endpoint) {
  if (!endpoint) return false;
  const before = state.pushSubscriptions.length;
  state.pushSubscriptions = state.pushSubscriptions.filter((item) => item.endpoint !== endpoint);
  if (state.pushSubscriptions.length !== before) {
    persist();
    return true;
  }
  return false;
}

function clearPushSubscriptions() {
  if (state.pushSubscriptions.length === 0) return;
  state.pushSubscriptions = [];
  persist();
}

function verifyPassword(user, password) {
  if (!user || typeof password !== "string") return false;
  return bcrypt.compareSync(password, user.passwordHash);
}

function getUsersForClient(requestUser) {
  if (requestUser.role === "admin") {
    return state.users.map(safeUser);
  }

  return state.users
    .filter((item) => item.role === "member")
    .map((item) => {
      const user = safeUser(item);
      if (item.id !== requestUser.id) {
        return {
          ...user,
          permissions: defaultMemberPermissions(),
        };
      }

      return user;
    });
}

function getReferralsForClient(requestUser) {
  if (requestUser.role === "admin") {
    return state.referrals;
  }

  if (hasFeaturePermission(requestUser, "reportsAll")) {
    return state.referrals;
  }

  if (hasFeaturePermission(requestUser, "referrals")) {
    return state.referrals;
  }

  if (hasFeaturePermission(requestUser, "reports")) {
    return state.referrals.filter((item) => item.referrerId === requestUser.id);
  }

  return [];
}

function getBootstrapForUser(requestUser) {
  const canSeeCustomers =
    hasFeaturePermission(requestUser, "customers") ||
    hasFeaturePermission(requestUser, "visits") ||
    hasFeaturePermission(requestUser, "referrals") ||
    hasFeaturePermission(requestUser, "reports");

  const canSeeProducts =
    hasFeaturePermission(requestUser, "products") ||
    hasFeaturePermission(requestUser, "visits") ||
    hasFeaturePermission(requestUser, "referrals") ||
    hasFeaturePermission(requestUser, "reports");

  return {
    currentUser: safeUser(requestUser),
    customers: canSeeCustomers ? clone(state.customers) : [],
    products: canSeeProducts ? clone(state.products) : [],
    visits:
      hasFeaturePermission(requestUser, "visits") || hasFeaturePermission(requestUser, "reportsAll")
        ? clone(state.visits)
        : [],
    referrals: clone(getReferralsForClient(requestUser)),
    users: clone(getUsersForClient(requestUser)),
  };
}

function assertFeaturePermission(user, featureKey) {
  if (!hasFeaturePermission(user, featureKey)) {
    throw httpError(403, "Bạn không có quyền thực hiện thao tác này.");
  }
}

function canEditCustomerInfo(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(user.permissions?.customerEdit);
}

function addCustomer(requestUser, input) {
  assertFeaturePermission(requestUser, "customers");

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const note = typeof input?.note === "string" ? input.note : "";

  if (!name) {
    throw httpError(400, "Vui lòng nhập tên khách hàng.");
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
  persist();

  return clone(customer);
}

function importCustomers(requestUser, rowsInput) {
  assertFeaturePermission(requestUser, "customers");

  if (!Array.isArray(rowsInput)) {
    throw httpError(400, "Dữ liệu import không hợp lệ.");
  }

  if (rowsInput.length > 5000) {
    throw httpError(400, "Tối đa 5000 dòng cho một lần import.");
  }

  let skippedCount = 0;
  const importedRows = [];

  rowsInput.forEach((raw) => {
    if (!raw || typeof raw !== "object") {
      skippedCount += 1;
      return;
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    const note = typeof raw.note === "string" ? raw.note : "";

    if (!name) {
      skippedCount += 1;
      return;
    }

    importedRows.push({
      id: createId("cus"),
      name,
      phone,
      email,
      note,
      createdAt: new Date().toISOString(),
    });
  });

  if (importedRows.length === 0) {
    throw httpError(400, "Không có dòng dữ liệu khách hàng hợp lệ để nhập.");
  }

  state.customers = [...importedRows, ...state.customers];
  persist();

  return {
    importedCount: importedRows.length,
    skippedCount,
    customers: clone(state.customers),
  };
}

function updateCustomer(requestUser, customerId, input) {
  assertFeaturePermission(requestUser, "customers");

  if (!canEditCustomerInfo(requestUser)) {
    throw httpError(403, "Bạn không có quyền sửa thông tin khách hàng.");
  }

  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) {
    throw httpError(404, "Không tìm thấy khách hàng cần chỉnh sửa.");
  }

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const note = typeof input?.note === "string" ? input.note : "";

  if (!name) {
    throw httpError(400, "Vui lòng nhập tên khách hàng.");
  }

  customer.name = name;
  customer.phone = phone;
  customer.email = email;
  customer.note = note;

  persist();
  return clone(customer);
}

function deleteCustomer(requestUser, customerId) {
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên mới có quyền xoá khách hàng.");
  }

  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) {
    throw httpError(404, "Không tìm thấy khách hàng cần xoá.");
  }

  const beforeVisits = state.visits.length;
  const beforeReferrals = state.referrals.length;

  state.customers = state.customers.filter((item) => item.id !== customerId);
  state.visits = state.visits.filter((item) => item.customerId !== customerId);
  state.referrals = state.referrals.filter((item) => item.referredCustomerId !== customerId);
  normalizeAllRecords(state);
  persist();

  return {
    deletedCustomerId: customerId,
    deletedCustomerName: customer.name,
    removedVisits: beforeVisits - state.visits.length,
    removedReferrals: beforeReferrals - state.referrals.length,
  };
}

function addProduct(requestUser, input) {
  assertFeaturePermission(requestUser, "products");

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const code = typeof input?.code === "string" ? input.code.trim() : "";
  const defaultPrice = Number(input?.defaultPrice || 0);
  const note = typeof input?.note === "string" ? input.note : "";

  if (!name) {
    throw httpError(400, "Vui lòng nhập tên sản phẩm / dịch vụ.");
  }

  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    throw httpError(400, "Giá gợi ý không hợp lệ.");
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
  persist();

  return clone(product);
}

function updateProduct(requestUser, productId, input) {
  assertFeaturePermission(requestUser, "products");
  assertFeaturePermission(requestUser, "productsEdit");

  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    throw httpError(404, "Không tìm thấy sản phẩm/dịch vụ cần chỉnh sửa.");
  }

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const code = typeof input?.code === "string" ? input.code.trim() : "";
  const defaultPrice = Number(input?.defaultPrice || 0);
  const note = typeof input?.note === "string" ? input.note : "";

  if (!name) {
    throw httpError(400, "Vui lòng nhập tên sản phẩm / dịch vụ.");
  }

  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    throw httpError(400, "Giá gợi ý không hợp lệ.");
  }

  product.name = name;
  product.code = code;
  product.defaultPrice = defaultPrice;
  product.note = note;
  persist();

  return clone(product);
}

function deleteProduct(requestUser, productId) {
  assertFeaturePermission(requestUser, "products");
  assertFeaturePermission(requestUser, "productsDelete");

  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    throw httpError(404, "Không tìm thấy sản phẩm/dịch vụ cần xoá.");
  }

  const usedInVisits = state.visits.filter((item) => item.productId === productId).length;
  const usedInReferrals = state.referrals.filter((item) => item.productId === productId).length;
  if (usedInVisits > 0 || usedInReferrals > 0) {
    throw httpError(
      409,
      `Không thể xoá vì sản phẩm/dịch vụ đang được dùng ở ${usedInVisits} lượt voucher và ${usedInReferrals} lượt hoa hồng.`,
    );
  }

  state.products = state.products.filter((item) => item.id !== productId);
  persist();

  return {
    deletedProductId: productId,
    deletedProductName: product.name,
    products: clone(state.products),
  };
}

function addVisit(requestUser, input) {
  assertFeaturePermission(requestUser, "visits");

  const customerId = typeof input?.customerId === "string" ? input.customerId : "";
  const productId = typeof input?.productId === "string" ? input.productId : "";
  const date = typeof input?.date === "string" ? input.date : "";
  const revenue = Number(input?.revenue || 0);

  if (!customerId || !productId || !date || revenue <= 0) {
    throw httpError(400, "Vui lòng nhập đủ khách hàng, sản phẩm/dịch vụ, ngày và doanh thu > 0.");
  }

  const hasCustomer = state.customers.some((item) => item.id === customerId);
  const hasProduct = state.products.some((item) => item.id === productId);

  if (!hasCustomer || !hasProduct) {
    throw httpError(400, "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.");
  }

  const visit = {
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

  state.visits.unshift(visit);
  normalizeVisitMonth(state, customerId, monthOf(date));
  persist();

  const savedVisit = state.visits.find((item) => item.id === visit.id) || visit;
  return {
    visit: clone(savedVisit),
    visits: clone(state.visits),
  };
}

function updateVisit(requestUser, visitId, input) {
  assertFeaturePermission(requestUser, "visits");
  assertFeaturePermission(requestUser, "visitsEdit");

  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) {
    throw httpError(404, "Không tìm thấy giao dịch tích điểm cần chỉnh sửa.");
  }

  const customerId = typeof input?.customerId === "string" ? input.customerId : "";
  const productId = typeof input?.productId === "string" ? input.productId : "";
  const date = typeof input?.date === "string" ? input.date : "";
  const revenue = Number(input?.revenue || 0);

  if (!customerId || !productId || !date || revenue <= 0) {
    throw httpError(400, "Vui lòng nhập đủ khách hàng, sản phẩm/dịch vụ, ngày và doanh thu > 0.");
  }

  const hasCustomer = state.customers.some((item) => item.id === customerId);
  const hasProduct = state.products.some((item) => item.id === productId);
  if (!hasCustomer || !hasProduct) {
    throw httpError(400, "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.");
  }

  visit.customerId = customerId;
  visit.productId = productId;
  visit.date = date;
  visit.revenue = revenue;

  normalizeAllRecords(state);
  persist();

  const savedVisit = state.visits.find((item) => item.id === visitId) || visit;
  return {
    visit: clone(savedVisit),
    visits: clone(state.visits),
  };
}

function deleteVisit(requestUser, visitId) {
  assertFeaturePermission(requestUser, "visits");
  assertFeaturePermission(requestUser, "visitsDelete");

  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) {
    throw httpError(404, "Không tìm thấy giao dịch tích điểm cần xoá.");
  }

  state.visits = state.visits.filter((item) => item.id !== visitId);
  state.referrals = state.referrals.filter((item) => item.sourceVisitId !== visitId);
  normalizeAllRecords(state);
  persist();

  return {
    deletedVisitId: visitId,
    visits: clone(state.visits),
  };
}

function addReferral(requestUser, input) {
  assertFeaturePermission(requestUser, "referrals");

  const referrerId = typeof input?.referrerId === "string" ? input.referrerId : "";
  const referredCustomerId = typeof input?.referredCustomerId === "string" ? input.referredCustomerId : "";
  const sourceVisitId = typeof input?.sourceVisitId === "string" ? input.sourceVisitId : "";
  const productId = typeof input?.productId === "string" ? input.productId : "";
  const date = typeof input?.date === "string" ? input.date : "";
  const revenue = Number(input?.revenue || 0);

  if (!referredCustomerId || !productId || !date || revenue <= 0) {
    throw httpError(400, "Vui lòng nhập đủ khách được giới thiệu, sản phẩm/dịch vụ, ngày và doanh thu > 0.");
  }

  const hasCustomer = state.customers.some((item) => item.id === referredCustomerId);
  const hasProduct = state.products.some((item) => item.id === productId);

  if (!hasCustomer || !hasProduct) {
    throw httpError(400, "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.");
  }

  if (referrerId) {
    const referrer = state.users.find((item) => item.id === referrerId && item.role === "member");
    if (!referrer) {
      throw httpError(400, "Người giới thiệu phải là tài khoản thành viên do quản trị viên tạo.");
    }
  }

  const referral = {
    id: createId("ref"),
    referrerId: referrerId || "",
    referredCustomerId,
    referredName: "",
    sourceVisitId,
    productId,
    date,
    revenue,
    occurrence: 0,
    rate: 0,
    commission: 0,
    createdAt: new Date().toISOString(),
  };

  state.referrals.unshift(referral);

  if (referrerId) {
    normalizeReferralMonth(state, referrerId, monthOf(date));
  }

  persist();

  const savedReferral = state.referrals.find((item) => item.id === referral.id) || referral;
  return {
    referral: clone(savedReferral),
    referrals: clone(state.referrals),
  };
}

function updateReferral(requestUser, referralId, input) {
  assertFeaturePermission(requestUser, "referrals");
  assertFeaturePermission(requestUser, "referralsEdit");

  const referral = state.referrals.find((item) => item.id === referralId);
  if (!referral) {
    throw httpError(404, "Không tìm thấy giao dịch hoa hồng cần chỉnh sửa.");
  }

  const referrerId = typeof input?.referrerId === "string" ? input.referrerId : "";
  const referredCustomerId = typeof input?.referredCustomerId === "string" ? input.referredCustomerId : "";
  const sourceVisitId = typeof input?.sourceVisitId === "string" ? input.sourceVisitId : referral.sourceVisitId || "";
  const productId = typeof input?.productId === "string" ? input.productId : "";
  const date = typeof input?.date === "string" ? input.date : "";
  const revenue = Number(input?.revenue || 0);

  if (!referredCustomerId || !productId || !date || revenue <= 0) {
    throw httpError(400, "Vui lòng nhập đủ khách được giới thiệu, sản phẩm/dịch vụ, ngày và doanh thu > 0.");
  }

  const hasCustomer = state.customers.some((item) => item.id === referredCustomerId);
  const hasProduct = state.products.some((item) => item.id === productId);

  if (!hasCustomer || !hasProduct) {
    throw httpError(400, "Khách hàng hoặc sản phẩm/dịch vụ không hợp lệ.");
  }

  if (referrerId) {
    const referrer = state.users.find((item) => item.id === referrerId && item.role === "member");
    if (!referrer) {
      throw httpError(400, "Người giới thiệu phải là tài khoản thành viên do quản trị viên tạo.");
    }
  }

  referral.referrerId = referrerId || "";
  referral.referredCustomerId = referredCustomerId;
  referral.referredName = "";
  referral.sourceVisitId = sourceVisitId;
  referral.productId = productId;
  referral.date = date;
  referral.revenue = revenue;

  normalizeAllRecords(state);
  persist();

  const savedReferral = state.referrals.find((item) => item.id === referralId) || referral;
  return {
    referral: clone(savedReferral),
    referrals: clone(state.referrals),
  };
}

function deleteReferral(requestUser, referralId) {
  assertFeaturePermission(requestUser, "referrals");
  assertFeaturePermission(requestUser, "referralsDelete");

  const referral = state.referrals.find((item) => item.id === referralId);
  if (!referral) {
    throw httpError(404, "Không tìm thấy giao dịch hoa hồng cần xoá.");
  }

  state.referrals = state.referrals.filter((item) => item.id !== referralId);
  normalizeAllRecords(state);
  persist();

  return {
    deletedReferralId: referralId,
    referrals: clone(state.referrals),
  };
}

function purgeDataByDateRange(requestUser, input) {
  assertFeaturePermission(requestUser, "dataCleanup");

  const fromDate = typeof input?.fromDate === "string" ? input.fromDate : "";
  const toDate = typeof input?.toDate === "string" ? input.toDate : "";

  if (!isValidDay(fromDate) || !isValidDay(toDate)) {
    throw httpError(400, "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc hợp lệ.");
  }

  if (fromDate > toDate) {
    throw httpError(400, "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
  }

  const rawScopes = input?.scopes && typeof input.scopes === "object" ? input.scopes : {};
  const scopes = {
    customers: rawScopes.customers !== false,
    products: rawScopes.products !== false,
    visits: rawScopes.visits !== false,
    referrals: rawScopes.referrals !== false,
    members: Boolean(rawScopes.members),
  };

  if (!scopes.customers && !scopes.products && !scopes.visits && !scopes.referrals && !scopes.members) {
    throw httpError(400, "Vui lòng chọn ít nhất một nhóm dữ liệu để xoá.");
  }

  const summary = {
    fromDate,
    toDate,
    removedCustomers: 0,
    removedProducts: 0,
    removedVisits: 0,
    removedReferrals: 0,
    removedMembers: 0,
  };

  if (scopes.members) {
    const removableMemberIds = state.users
      .filter(
        (item) =>
          item.role === "member" &&
          item.id !== requestUser.id &&
          isDayInRange(dayOf(item.createdAt), fromDate, toDate),
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

  if (scopes.customers) {
    const removableCustomerIds = state.customers
      .filter((item) => isDayInRange(dayOf(item.createdAt), fromDate, toDate))
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

  if (scopes.products) {
    const removableProductIds = state.products
      .filter((item) => isDayInRange(dayOf(item.createdAt), fromDate, toDate))
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

  if (scopes.visits) {
    const beforeVisits = state.visits.length;
    state.visits = state.visits.filter((item) => !isDayInRange(dayOf(item.date), fromDate, toDate));
    summary.removedVisits += beforeVisits - state.visits.length;
  }

  if (scopes.referrals) {
    const beforeReferrals = state.referrals.length;
    state.referrals = state.referrals.filter((item) => !isDayInRange(dayOf(item.date), fromDate, toDate));
    summary.removedReferrals += beforeReferrals - state.referrals.length;
  }

  normalizeAllRecords(state);
  persist();

  return {
    summary,
    remaining: {
      customers: state.customers.length,
      products: state.products.length,
      visits: state.visits.length,
      referrals: state.referrals.length,
      members: state.users.filter((item) => item.role === "member").length,
    },
  };
}

function changeCurrentUserPassword(requestUser, input) {
  assertFeaturePermission(requestUser, "changePassword");

  const currentPassword = typeof input?.currentPassword === "string" ? input.currentPassword : "";
  const nextPassword = typeof input?.nextPassword === "string" ? input.nextPassword : "";

  if (!currentPassword || !nextPassword) {
    throw httpError(400, "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
  }

  if (nextPassword.length < 6) {
    throw httpError(400, "Mật khẩu mới tối thiểu 6 ký tự.");
  }

  if (!bcrypt.compareSync(currentPassword, requestUser.passwordHash)) {
    throw httpError(401, "Mật khẩu hiện tại không đúng.");
  }

  const user = state.users.find((item) => item.id === requestUser.id);
  if (!user) {
    throw httpError(404, "Không tìm thấy tài khoản cần đổi mật khẩu.");
  }

  user.passwordHash = bcrypt.hashSync(nextPassword, 10);
  persist();

  return { updatedUserId: user.id };
}

function createMemberAccount(requestUser, input) {
  assertFeaturePermission(requestUser, "manageUsers");

  const fullName = typeof input?.fullName === "string" ? input.fullName.trim() : "";
  const username = typeof input?.username === "string" ? input.username.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const permissions = buildMemberPermissions(input?.permissions);

  if (!fullName || !username || !password) {
    throw httpError(400, "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.");
  }

  if (!/^[0-9]{8,15}$/.test(username)) {
    throw httpError(400, "Tên đăng nhập phải là số điện thoại 8-15 chữ số.");
  }

  if (password.length < 6) {
    throw httpError(400, "Mật khẩu tối thiểu 6 ký tự.");
  }

  const duplicated = state.users.some((user) => user.username.toLowerCase() === username.toLowerCase());
  if (duplicated) {
    throw httpError(409, "Tên đăng nhập đã tồn tại.");
  }

  const member = {
    id: createId("user"),
    fullName,
    username,
    role: "member",
    permissions,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
  };

  state.users.push(member);
  persist();

  return clone(safeUser(member));
}

function updateMemberPermissions(requestUser, memberId, permissionsInput) {
  assertFeaturePermission(requestUser, "manageUsers");

  const member = state.users.find((item) => item.id === memberId && item.role === "member");
  if (!member) {
    throw httpError(404, "Không tìm thấy tài khoản thành viên.");
  }

  member.permissions = buildMemberPermissions(permissionsInput);
  if (typeof permissionsInput?.locked !== "undefined") {
    member.locked = Boolean(permissionsInput.locked);
  }
  persist();

  return clone(safeUser(member));
}

function deleteMemberAccount(requestUser, memberId) {
  assertFeaturePermission(requestUser, "manageUsers");

  const member = state.users.find((item) => item.id === memberId && item.role === "member");
  if (!member) {
    throw httpError(404, "Không tìm thấy tài khoản thành viên.");
  }

  state.users = state.users.filter((item) => item.id !== memberId);
  state.referrals = state.referrals.map((item) => {
    if (item.referrerId === memberId) {
      return { ...item, referrerId: "", occurrence: 0, rate: 0, commission: 0 };
    }
    return item;
  });

  normalizeAllRecords(state);
  persist();

  return { removed: true };
}

function resetMemberPassword(requestUser, memberId, nextPassword) {
  assertFeaturePermission(requestUser, "manageUsers");
  if (typeof nextPassword !== "string" || nextPassword.length < 6) {
    throw httpError(400, "Mật khẩu mới phải có tối thiểu 6 ký tự.");
  }

  const member = state.users.find((item) => item.id === memberId && item.role === "member");
  if (!member) {
    throw httpError(404, "Không tìm thấy tài khoản thành viên.");
  }

  member.passwordHash = bcrypt.hashSync(nextPassword, 10);
  persist();
  return { updatedUserId: member.id };
}

module.exports = {
  DEFAULT_ADMIN_USERNAME,
  buildMemberPermissions,
  createMemberAccount,
  addCustomer,
  importCustomers,
  updateCustomer,
  deleteCustomer,
  addProduct,
  updateProduct,
  deleteProduct,
  addReferral,
  updateReferral,
  deleteReferral,
  purgeDataByDateRange,
  addVisit,
  updateVisit,
  deleteVisit,
  changeCurrentUserPassword,
  addPersistListener,
  DATA_FILE,
  findUserById,
  findUserByUsername,
  deleteMemberAccount,
  resetMemberPassword,
  getBootstrapForUser,
  hasFeaturePermission,
  httpError,
  safeUser,
  updateMemberPermissions,
  verifyPassword,
  upsertPushSubscription,
  getPushSubscriptionsForUser,
  removePushSubscriptionByEndpoint,
  clearPushSubscriptions,
};
