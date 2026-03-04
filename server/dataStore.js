const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const persistListeners = [];

const DEFAULT_ADMIN_USERNAME = process.env.AHA_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.AHA_ADMIN_PASSWORD || "admin123";
const FINANCE_LEDGER_SECRET =
  process.env.AHA_FINANCE_LEDGER_SECRET ||
  process.env.SESSION_SECRET ||
  `${DEFAULT_ADMIN_USERNAME}:${DEFAULT_ADMIN_PASSWORD}:finance-ledger`;
const FINANCE_LEDGER_GENESIS = "GENESIS";
const FINANCE_LOG_DOMAIN = "finance";
const MAX_SYSTEM_AUDIT_LOGS = 20000;
const ADJUSTMENT_NOTE_PREFIX = "[ĐIỀU CHỈNH]";
const MAX_FINANCE_RECEIPT_DATA_URL_LENGTH = 4 * 1024 * 1024;
const FINANCE_EXPENSE_CATEGORIES = new Set(["ADS", "OPERATIONS", "OTHER"]);
const FINANCE_TYPE_IN = "NHAP";
const FINANCE_TYPE_OUT = "XUAT";
let lastFinanceIntegrityAlertKey = "";

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
  finance: true,
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

function buildFinanceCreatedAt(transactionDate) {
  const now = new Date();
  if (!transactionDate) {
    return now.toISOString();
  }

  if (!isValidDay(transactionDate)) {
    return "";
  }

  const timePart = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const createdAt = `${transactionDate}T${timePart}`;
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "" : createdAt;
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
    finance: false,
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
    finance: Boolean(source.finance ?? defaults.finance),
    reports: Boolean(source.reports ?? defaults.reports),
    reportsAll: Boolean(source.reportsAll ?? defaults.reportsAll),
    dataCleanup: Boolean(source.dataCleanup ?? defaults.dataCleanup),
    backupData: Boolean(source.backupData ?? defaults.backupData),
    changePassword: Boolean(source.changePassword ?? defaults.changePassword),
  };
}

function normalizeTextValue(value) {
  return String(value || "").trim();
}

function isAdjustmentNote(note) {
  const normalized = String(note || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return normalized.includes("điều chỉnh") || normalized.includes("dieu chinh");
}

function normalizeAdjustmentNote(note) {
  const normalized = normalizeTextValue(note);
  if (!normalized) {
    return `${ADJUSTMENT_NOTE_PREFIX} Điều chỉnh số liệu.`;
  }

  if (isAdjustmentNote(normalized)) {
    return normalized;
  }

  return `${ADJUSTMENT_NOTE_PREFIX} ${normalized}`;
}

function normalizeFinanceExpenseCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "ADS") return "ADS";
  if (normalized === "OPERATIONS") return "OPERATIONS";
  if (normalized === "OTHER") return "OTHER";
  return "";
}

function normalizeFinanceTransactionType(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "THU" || normalized === FINANCE_TYPE_IN) return FINANCE_TYPE_IN;
  if (normalized === "CHI" || normalized === FINANCE_TYPE_OUT) return FINANCE_TYPE_OUT;
  return "";
}

function isValidFinanceReceiptDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return false;
  const normalized = dataUrl.trim();
  if (!normalized) return false;
  if (!normalized.startsWith("data:image/")) return false;
  if (!normalized.includes(";base64,")) return false;
  if (normalized.length > MAX_FINANCE_RECEIPT_DATA_URL_LENGTH) return false;
  return true;
}

function normalizeFinanceReceiptInput(rawReceipt) {
  const receipt = rawReceipt && typeof rawReceipt === "object" ? rawReceipt : {};

  const dataUrlCandidate =
    typeof receipt.dataUrl === "string"
      ? receipt.dataUrl
      : typeof receipt.receiptImageDataUrl === "string"
        ? receipt.receiptImageDataUrl
        : typeof rawReceipt === "string"
          ? rawReceipt
          : "";
  const dataUrl = typeof dataUrlCandidate === "string" ? dataUrlCandidate.trim() : "";
  if (!dataUrl) {
    return {
      receiptImageDataUrl: "",
      receiptImageName: "",
    };
  }

  if (!isValidFinanceReceiptDataUrl(dataUrl)) {
    throw httpError(400, "Ảnh hóa đơn không hợp lệ hoặc vượt quá dung lượng cho phép.");
  }

  const nameCandidate =
    typeof receipt.name === "string"
      ? receipt.name
      : typeof receipt.receiptImageName === "string"
        ? receipt.receiptImageName
        : "hoa-don";
  const name = normalizeTextValue(nameCandidate).slice(0, 180) || "hoa-don";

  return {
    receiptImageDataUrl: dataUrl,
    receiptImageName: name,
  };
}

function buildFinanceLedgerPayload(transaction, previousHash) {
  return JSON.stringify({
    id: transaction.id || "",
    userId: transaction.userId || "",
    type: transaction.type || "",
    amount: Number(transaction.amount) || 0,
    category: transaction.category || "",
    note: transaction.note || "",
    receiptImageDataUrl: transaction.receiptImageDataUrl || "",
    receiptImageName: transaction.receiptImageName || "",
    createdBy: transaction.createdBy || "",
    createdAt: transaction.createdAt || "",
    isAdjustment: Boolean(transaction.isAdjustment),
    adjustmentOf: transaction.adjustmentOf || "",
    previousHash: previousHash || FINANCE_LEDGER_GENESIS,
  });
}

function signFinanceLedgerEntry(transaction, previousHash) {
  const payload = buildFinanceLedgerPayload(transaction, previousHash);
  return crypto.createHmac("sha256", FINANCE_LEDGER_SECRET).update(payload).digest("hex");
}

function appendSystemAuditLog(entry) {
  if (!Array.isArray(state.systemAuditLogs)) {
    state.systemAuditLogs = [];
  }

  const details =
    entry?.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? clone(entry.details) : {};

  const record = {
    id: createId("audit"),
    domain:
      typeof entry?.domain === "string" && entry.domain.trim()
        ? entry.domain.trim().toLowerCase()
        : "system",
    action:
      typeof entry?.action === "string" && entry.action.trim()
        ? entry.action.trim().toUpperCase()
        : "UNKNOWN_ACTION",
    actorId: typeof entry?.actorId === "string" ? entry.actorId : "",
    walletUserId: typeof entry?.walletUserId === "string" ? entry.walletUserId : "",
    transactionId: typeof entry?.transactionId === "string" ? entry.transactionId : "",
    createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    details,
  };

  state.systemAuditLogs.unshift(record);
  if (state.systemAuditLogs.length > MAX_SYSTEM_AUDIT_LOGS) {
    state.systemAuditLogs.length = MAX_SYSTEM_AUDIT_LOGS;
  }

  return record;
}

function applyFinanceLedgerIntegrity(transactions) {
  const rows = Array.isArray(transactions) ? transactions : [];
  if (rows.length === 0) {
    return {
      migratedLegacyLedger: false,
      invalidCount: 0,
      invalidTransactionIds: [],
    };
  }

  const hasAnyIntegrity = rows.some(
    (item) =>
      typeof item.integrityHash === "string" &&
      item.integrityHash &&
      typeof item.integrityPrevHash === "string" &&
      item.integrityPrevHash,
  );

  let invalidCount = 0;
  const invalidTransactionIds = [];

  if (!hasAnyIntegrity) {
    let expectedPrevHash = FINANCE_LEDGER_GENESIS;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      row.integrityPrevHash = expectedPrevHash;
      row.integrityHash = signFinanceLedgerEntry(row, expectedPrevHash);
      row.integrityVersion = 1;
      row.integrityValid = true;
      expectedPrevHash = row.integrityHash;
    }

    return {
      migratedLegacyLedger: true,
      invalidCount: 0,
      invalidTransactionIds,
    };
  }

  let expectedPrevHash = FINANCE_LEDGER_GENESIS;
  let chainBroken = false;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const prevHash = typeof row.integrityPrevHash === "string" ? row.integrityPrevHash : "";
    const rowHash = typeof row.integrityHash === "string" ? row.integrityHash : "";
    const expectedHash = signFinanceLedgerEntry(row, expectedPrevHash);

    const validRow = !chainBroken && prevHash === expectedPrevHash && rowHash === expectedHash;
    row.integrityVersion = 1;
    row.integrityValid = validRow;

    if (!validRow) {
      invalidCount += 1;
      invalidTransactionIds.push(row.id);
      chainBroken = true;
    }

    if (rowHash) {
      expectedPrevHash = rowHash;
    }
  }

  return {
    migratedLegacyLedger: false,
    invalidCount,
    invalidTransactionIds,
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

  state.systemAuditLogs = Array.isArray(state.systemAuditLogs)
    ? state.systemAuditLogs
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : createId("audit"),
          domain:
            typeof item.domain === "string" && item.domain.trim()
              ? item.domain.trim().toLowerCase()
              : "system",
          action:
            typeof item.action === "string" && item.action.trim()
              ? item.action.trim().toUpperCase()
              : "UNKNOWN_ACTION",
          actorId: typeof item.actorId === "string" ? item.actorId : "",
          walletUserId:
            typeof item.walletUserId === "string"
              ? item.walletUserId
              : typeof item.userId === "string"
                ? item.userId
                : "",
          transactionId:
            typeof item.transactionId === "string"
              ? item.transactionId
              : typeof item.targetId === "string"
                ? item.targetId
                : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          details:
            item.details && typeof item.details === "object" && !Array.isArray(item.details) ? item.details : {},
        }))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, MAX_SYSTEM_AUDIT_LOGS)
    : [];

  let shouldResetFinanceIntegrity = false;
  state.financeTransactions = Array.isArray(state.financeTransactions)
    ? state.financeTransactions
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const typeRaw = typeof item.type === "string" ? item.type.trim().toUpperCase() : "";
          const type = normalizeFinanceTransactionType(typeRaw);
          if (typeRaw === "THU" || typeRaw === "CHI") {
            shouldResetFinanceIntegrity = true;
          }
          const amount = Number(item.amount || 0);
          const userId = typeof item.userId === "string" ? item.userId : "";
          const rawNote = typeof item.note === "string" ? item.note : "";
          const rawCategory = normalizeFinanceExpenseCategory(item.category);
          const category = type === FINANCE_TYPE_OUT ? rawCategory : "";
          const rawReceiptImageDataUrl =
            typeof item.receiptImageDataUrl === "string"
              ? item.receiptImageDataUrl
              : typeof item.receipt_image_data_url === "string"
                ? item.receipt_image_data_url
                : typeof item.receiptImage?.dataUrl === "string"
                  ? item.receiptImage.dataUrl
                  : "";
          const rawReceiptImageName =
            typeof item.receiptImageName === "string"
              ? item.receiptImageName
              : typeof item.receipt_image_name === "string"
                ? item.receipt_image_name
                : typeof item.receiptImage?.name === "string"
                  ? item.receiptImage.name
                  : "";
          const receiptImageDataUrl =
            type === FINANCE_TYPE_OUT && isValidFinanceReceiptDataUrl(rawReceiptImageDataUrl)
              ? rawReceiptImageDataUrl.trim()
              : "";
          const receiptImageName = receiptImageDataUrl ? normalizeTextValue(rawReceiptImageName).slice(0, 180) || "hoa-don" : "";
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
          const adjustmentOf =
            typeof item.adjustmentOf === "string"
              ? item.adjustmentOf
              : typeof item.adjustment_of === "string"
                ? item.adjustment_of
                : "";
          const isAdjustment = Boolean(item.isAdjustment || item.adjustment) || Boolean(adjustmentOf) || isAdjustmentNote(rawNote);
          const noteBase = isAdjustment ? normalizeAdjustmentNote(rawNote) : normalizeTextValue(rawNote);
          const note = noteBase || "Không có mô tả";

          return {
            id: typeof item.id === "string" && item.id ? item.id : createId("fin"),
            userId,
            type,
            amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
            category,
            note,
            isAdjustment,
            adjustmentOf,
            receiptImageDataUrl,
            receiptImageName,
            createdBy,
            created_by: createdBy,
            createdAt,
            timestamp: createdAt,
            integrityPrevHash:
              shouldResetFinanceIntegrity || typeof item.integrityPrevHash !== "string" ? "" : item.integrityPrevHash,
            integrityHash: shouldResetFinanceIntegrity || typeof item.integrityHash !== "string" ? "" : item.integrityHash,
            integrityVersion: Number(item.integrityVersion) > 0 ? Number(item.integrityVersion) : 1,
            integrityValid: true,
          };
        })
        .filter((item) => item.userId && item.type && item.amount > 0)
    : [];

  if (shouldResetFinanceIntegrity && state.financeTransactions.length > 0) {
    state.financeTransactions = state.financeTransactions.map((item) => ({
      ...item,
      integrityPrevHash: "",
      integrityHash: "",
    }));
  }

  const financeLedgerResult = applyFinanceLedgerIntegrity(state.financeTransactions);
  if (financeLedgerResult.invalidCount > 0) {
    const alertKey = financeLedgerResult.invalidTransactionIds.join("|");
    if (alertKey && alertKey !== lastFinanceIntegrityAlertKey) {
      appendSystemAuditLog({
        domain: FINANCE_LOG_DOMAIN,
        action: "FINANCE_LEDGER_TAMPER_DETECTED",
        actorId: "system",
        details: {
          invalidCount: financeLedgerResult.invalidCount,
          invalidTransactionIds: financeLedgerResult.invalidTransactionIds,
        },
      });
      lastFinanceIntegrityAlertKey = alertKey;
    }
  } else {
    lastFinanceIntegrityAlertKey = "";
  }

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
    financeTransactions: [],
    systemAuditLogs: [],
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
      financeTransactions: Array.isArray(parsed.financeTransactions) ? parsed.financeTransactions : [],
      systemAuditLogs: Array.isArray(parsed.systemAuditLogs)
        ? parsed.systemAuditLogs
        : Array.isArray(parsed.auditLogs)
          ? parsed.auditLogs
          : [],
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

function getValidFinanceTransactions() {
  return state.financeTransactions.filter((item) => item.integrityValid !== false);
}

function getFinanceIntegrityStatus() {
  const invalidTransactions = state.financeTransactions.filter((item) => item.integrityValid === false);
  return {
    ok: invalidTransactions.length === 0,
    invalidCount: invalidTransactions.length,
    invalidTransactionIds: invalidTransactions.map((item) => item.id),
  };
}

function getFinanceTransactionsForClient(requestUser) {
  if (!hasFeaturePermission(requestUser, "finance")) {
    return [];
  }

  const validTransactions = getValidFinanceTransactions();

  if (requestUser.role === "admin") {
    return validTransactions;
  }

  return validTransactions.filter((item) => item.userId === requestUser.id);
}

function getFinanceBalanceForUser(userId) {
  if (!userId) return 0;
  return getValidFinanceTransactions().reduce((sum, item) => {
    if (item.userId !== userId) return sum;
    if (normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_IN) return sum + item.amount;
    if (normalizeFinanceTransactionType(item.type) === FINANCE_TYPE_OUT) return sum - item.amount;
    return sum;
  }, 0);
}

function getFinanceAuditLogsForClient(requestUser, options = {}) {
  assertFeaturePermission(requestUser, "finance");

  const limitRaw = Number(options.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 1000) : 200;
  const financeLogs = state.systemAuditLogs.filter((item) => item.domain === FINANCE_LOG_DOMAIN);

  if (requestUser.role === "admin") {
    return financeLogs.slice(0, limit);
  }

  return financeLogs
    .filter((item) => item.actorId === requestUser.id || item.walletUserId === requestUser.id)
    .slice(0, limit);
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
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
    users: clone(getUsersForClient(requestUser)),
    financeIntegrity:
      requestUser.role === "admin"
        ? clone(getFinanceIntegrityStatus())
        : {
            ok: true,
            invalidCount: 0,
            invalidTransactionIds: [],
          },
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

function addFinanceTransaction(requestUser, input) {
  assertFeaturePermission(requestUser, "finance");

  const integrityStatus = getFinanceIntegrityStatus();
  if (!integrityStatus.ok) {
    throw httpError(
      409,
      "Phát hiện dữ liệu tài chính không toàn vẹn. Tạm khóa ghi giao dịch mới để tránh gian lận số liệu.",
    );
  }

  const type = normalizeFinanceTransactionType(input?.type);
  const amount = Number(input?.amount || 0);
  const transactionDate = typeof input?.transactionDate === "string" ? input.transactionDate.trim() : "";
  const category = normalizeFinanceExpenseCategory(input?.category);
  const rawNote = typeof input?.note === "string" ? input.note : "";
  const requestedUserId = typeof input?.userId === "string" ? input.userId : "";
  const requestedAdjustmentOf = typeof input?.adjustmentOf === "string" ? input.adjustmentOf.trim() : "";
  const requestedAdjustmentFlag = Boolean(input?.adjustment || input?.isAdjustment);
  const receiptInputRaw =
    input?.receiptImage && typeof input.receiptImage === "object"
      ? input.receiptImage
      : {
          dataUrl:
            typeof input?.receiptImageDataUrl === "string"
              ? input.receiptImageDataUrl
              : typeof input?.receipt_image_data_url === "string"
                ? input.receipt_image_data_url
                : "",
          name:
            typeof input?.receiptImageName === "string"
              ? input.receiptImageName
              : typeof input?.receipt_image_name === "string"
              ? input.receipt_image_name
                : "",
        };
  let receipt = { receiptImageDataUrl: "", receiptImageName: "" };

  if (type !== FINANCE_TYPE_IN && type !== FINANCE_TYPE_OUT) {
    throw httpError(400, "Loại giao dịch không hợp lệ. Chỉ chấp nhận NHẬP hoặc XUẤT.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(400, "Số tiền phải lớn hơn 0.");
  }

  if (transactionDate && !isValidDay(transactionDate)) {
    throw httpError(400, "Ngày giao dịch không hợp lệ.");
  }

  let isAdjustment = requestedAdjustmentFlag || Boolean(requestedAdjustmentOf) || isAdjustmentNote(rawNote);
  let note = normalizeTextValue(rawNote);
  if (!note) {
    throw httpError(400, "Vui lòng nhập nội dung mô tả giao dịch.");
  }
  if (note.length > 500) {
    throw httpError(400, "Nội dung mô tả tối đa 500 ký tự.");
  }
  if (isAdjustment) {
    note = normalizeAdjustmentNote(note);
  }

  let targetUserId = requestUser.id;

  if (requestUser.role === "admin") {
    if (type !== FINANCE_TYPE_IN) {
      throw httpError(403, "Quản trị viên chỉ được tạo giao dịch NHẬP.");
    }

    if (!requestedUserId) {
      throw httpError(400, "Vui lòng chọn tài khoản thành viên cần ghi nhận ví.");
    }

    const targetUser = state.users.find((item) => item.id === requestedUserId && item.role === "member");
    if (!targetUser) {
      throw httpError(400, "Tài khoản ví không hợp lệ.");
    }

    targetUserId = targetUser.id;
  } else {
    if (type !== FINANCE_TYPE_OUT) {
      throw httpError(403, "Nhân viên chỉ được tạo giao dịch XUẤT.");
    }

    if (!FINANCE_EXPENSE_CATEGORIES.has(category)) {
      throw httpError(400, "Danh mục xuất không hợp lệ. Chỉ chấp nhận Ads, Vận hành hoặc Khác.");
    }

    if (requestedUserId && requestedUserId !== requestUser.id) {
      throw httpError(403, "Bạn chỉ được ghi nhận giao dịch cho ví của chính mình.");
    }

    const currentBalance = getFinanceBalanceForUser(targetUserId);
    if (amount > currentBalance) {
      throw httpError(409, "Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT.");
    }
  }

  if (type === FINANCE_TYPE_OUT) {
    receipt = normalizeFinanceReceiptInput(receiptInputRaw);
  }

  let adjustmentOf = "";
  if (requestedAdjustmentOf) {
    const reference = state.financeTransactions.find((item) => item.id === requestedAdjustmentOf);
    if (!reference || reference.integrityValid === false) {
      throw httpError(400, "Không tìm thấy giao dịch gốc hợp lệ để điều chỉnh.");
    }
    if (reference.userId !== targetUserId) {
      throw httpError(400, "Giao dịch điều chỉnh phải áp dụng cho cùng một ví nhân viên.");
    }
    adjustmentOf = reference.id;
    isAdjustment = true;
    note = normalizeAdjustmentNote(note);
  }

  const createdAt = buildFinanceCreatedAt(transactionDate);
  if (!createdAt) {
    throw httpError(400, "Ngày giao dịch không hợp lệ.");
  }
  const previousHash = state.financeTransactions[0]?.integrityHash || FINANCE_LEDGER_GENESIS;
  const transaction = {
    id: createId("fin"),
    userId: targetUserId,
    type,
    amount,
    category: type === FINANCE_TYPE_OUT ? category : "",
    note,
    isAdjustment,
    adjustmentOf,
    receiptImageDataUrl: type === FINANCE_TYPE_OUT ? receipt.receiptImageDataUrl : "",
    receiptImageName: type === FINANCE_TYPE_OUT ? receipt.receiptImageName : "",
    createdBy: requestUser.id,
    created_by: requestUser.id,
    createdAt,
    timestamp: createdAt,
    integrityPrevHash: previousHash,
    integrityVersion: 1,
  };
  transaction.integrityHash = signFinanceLedgerEntry(transaction, previousHash);
  transaction.integrityValid = true;

  state.financeTransactions.unshift(transaction);
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_TRANSACTION_CREATED",
    actorId: requestUser.id,
    walletUserId: targetUserId,
    transactionId: transaction.id,
    createdAt,
    details: {
      type,
      amount,
      category: transaction.category || "",
      note,
      isAdjustment,
      adjustmentOf: adjustmentOf || "",
      hasReceiptImage: Boolean(transaction.receiptImageDataUrl),
    },
  });
  persist();

  return {
    transaction: clone(transaction),
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
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
  addFinanceTransaction,
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
  getFinanceAuditLogsForClient,
  getFinanceIntegrityStatus,
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
