const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const DEFAULT_ADMIN_USERNAME = process.env.AHA_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.AHA_ADMIN_PASSWORD || "admin123";

const ADMIN_PERMISSIONS = {
  customers: true,
  customerEdit: true,
  products: true,
  visits: true,
  referrals: true,
  reports: true,
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
    visits: false,
    referrals: false,
    reports: true,
  };
}

function buildMemberPermissions(rawPermissions) {
  const defaults = defaultMemberPermissions();
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
    permissions: user.role === "admin" ? { ...ADMIN_PERMISSIONS } : buildMemberPermissions(user.permissions),
    createdAt: user.createdAt,
  };
}

function hasFeaturePermission(user, featureKey) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (featureKey === "manageUsers") return false;
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
    visits: hasFeaturePermission(requestUser, "visits") ? clone(state.visits) : [],
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
    throw httpError(403, "Chỉ admin mới có quyền xoá khách hàng.");
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

function addReferral(requestUser, input) {
  assertFeaturePermission(requestUser, "referrals");

  const referrerId = typeof input?.referrerId === "string" ? input.referrerId : "";
  const referredCustomerId = typeof input?.referredCustomerId === "string" ? input.referredCustomerId : "";
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
      throw httpError(400, "Người giới thiệu phải là tài khoản thành viên do admin tạo.");
    }
  }

  const referral = {
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

function createMemberAccount(requestUser, input) {
  assertFeaturePermission(requestUser, "manageUsers");

  const fullName = typeof input?.fullName === "string" ? input.fullName.trim() : "";
  const username = typeof input?.username === "string" ? input.username.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const permissions = buildMemberPermissions(input?.permissions);

  if (!fullName || !username || !password) {
    throw httpError(400, "Vui lòng nhập đầy đủ họ tên, tên đăng nhập và mật khẩu.");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    throw httpError(400, "Tên đăng nhập chỉ chứa chữ, số và các ký tự . _ -.");
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
  persist();

  return clone(safeUser(member));
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
  addReferral,
  addVisit,
  findUserById,
  findUserByUsername,
  getBootstrapForUser,
  hasFeaturePermission,
  httpError,
  safeUser,
  updateMemberPermissions,
  verifyPassword,
};
