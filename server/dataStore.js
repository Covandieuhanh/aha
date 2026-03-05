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
const MAX_FINANCE_SUBCATEGORY_LENGTH = 80;
const DEFAULT_FINANCE_EXPENSE_CATEGORIES = [
  { code: "ADS", name: "Ads" },
  { code: "OPERATIONS", name: "Vận hành" },
  { code: "OTHER", name: "Khác" },
];
const FINANCE_TYPE_IN = "NHAP";
const FINANCE_TYPE_OUT = "XUAT";
const INVENTORY_AREA_WAREHOUSE = "KHO";
const INVENTORY_AREA_SPA = "SPA";
const INVENTORY_TYPE_IN = "NHAP";
const INVENTORY_TYPE_OUT = "XUAT";
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
  inventory: true,
  inventoryWarehouseIn: true,
  inventoryWarehouseOut: true,
  inventorySpaIn: true,
  inventorySpaOut: true,
  finance: true,
  financeFund: true,
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
    inventory: false,
    inventoryWarehouseIn: false,
    inventoryWarehouseOut: false,
    inventorySpaIn: false,
    inventorySpaOut: false,
    finance: false,
    financeFund: false,
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
    inventory: Boolean(source.inventory ?? defaults.inventory),
    inventoryWarehouseIn: Boolean(source.inventoryWarehouseIn ?? defaults.inventoryWarehouseIn),
    inventoryWarehouseOut: Boolean(source.inventoryWarehouseOut ?? defaults.inventoryWarehouseOut),
    inventorySpaIn: Boolean(source.inventorySpaIn ?? defaults.inventorySpaIn),
    inventorySpaOut: Boolean(source.inventorySpaOut ?? defaults.inventorySpaOut),
    finance: Boolean(source.finance ?? defaults.finance),
    financeFund: Boolean(source.financeFund ?? defaults.financeFund),
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

function normalizeInventoryArea(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === INVENTORY_AREA_WAREHOUSE) return INVENTORY_AREA_WAREHOUSE;
  if (normalized === INVENTORY_AREA_SPA) return INVENTORY_AREA_SPA;
  return "";
}

function normalizeInventoryType(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === INVENTORY_TYPE_IN) return INVENTORY_TYPE_IN;
  if (normalized === INVENTORY_TYPE_OUT) return INVENTORY_TYPE_OUT;
  return "";
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
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return normalized;
}

function normalizeFinanceSubCategory(value) {
  return normalizeTextValue(value).slice(0, MAX_FINANCE_SUBCATEGORY_LENGTH);
}

function extractFinanceSubCategoryFromNote(note) {
  const raw = String(note || "");
  if (!raw.trim()) return "";
  const match =
    raw.match(/(?:^|\|)\s*hạng\s*mục\s*:\s*([^|\n\r]+)/i) || raw.match(/(?:^|\|)\s*hang\s*muc\s*:\s*([^|\n\r]+)/i);
  if (!match) return "";
  return normalizeFinanceSubCategory(match[1]);
}

function findFinanceCategory(categories, code) {
  const normalizedCode = normalizeFinanceExpenseCategory(code);
  if (!normalizedCode) return null;
  const rows = Array.isArray(categories) ? categories : [];
  return rows.find((item) => item.code === normalizedCode) || null;
}

function resolveFinanceExpenseCategoryCode(value, categories, options = {}) {
  const normalizedCode = normalizeFinanceExpenseCategory(value);
  if (!normalizedCode) return "";
  const category = findFinanceCategory(categories, normalizedCode);
  if (!category) return "";
  if (options.allowInactive) return normalizedCode;
  return category.active ? normalizedCode : "";
}

function buildFinanceCategoryCodeFromName(name, existingCodes = new Set()) {
  const baseCode = normalizeFinanceExpenseCategory(name) || "CATEGORY";
  let candidate = baseCode;
  let index = 1;
  while (existingCodes.has(candidate)) {
    candidate = `${baseCode}_${index}`;
    index += 1;
  }
  return candidate;
}

function getFinanceDefaultCategoryName(code) {
  const normalizedCode = normalizeFinanceExpenseCategory(code);
  if (!normalizedCode) return "Danh mục";
  const matchedDefault = DEFAULT_FINANCE_EXPENSE_CATEGORIES.find((item) => item.code === normalizedCode);
  return matchedDefault?.name || normalizedCode;
}

function normalizeFinanceExpenseCategories(rawCategories, options = {}) {
  const source = Array.isArray(rawCategories) ? rawCategories : [];
  const nowIso = options.now || new Date().toISOString();
  const normalized = [];
  const seenCodes = new Set();

  source.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const code = normalizeFinanceExpenseCategory(item.code || item.id || item.value || item.key || item.name || "");
    if (!code || seenCodes.has(code)) return;

    const name = normalizeTextValue(item.name || item.label || item.displayName || getFinanceDefaultCategoryName(code));
    normalized.push({
      code,
      name: name || getFinanceDefaultCategoryName(code),
      active: item.active !== false,
      createdBy: typeof item.createdBy === "string" ? item.createdBy : typeof item.created_by === "string" ? item.created_by : "",
      created_by:
        typeof item.createdBy === "string"
          ? item.createdBy
          : typeof item.created_by === "string"
            ? item.created_by
            : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : nowIso,
      timestamp: typeof item.createdAt === "string" ? item.createdAt : nowIso,
      updatedBy: typeof item.updatedBy === "string" ? item.updatedBy : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
      deletedBy: typeof item.deletedBy === "string" ? item.deletedBy : "",
      deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : "",
    });
    seenCodes.add(code);
  });

  DEFAULT_FINANCE_EXPENSE_CATEGORIES.forEach((item) => {
    if (seenCodes.has(item.code)) return;
    normalized.push({
      code: item.code,
      name: item.name,
      active: true,
      createdBy: "system",
      created_by: "system",
      createdAt: nowIso,
      timestamp: nowIso,
      updatedBy: "",
      updatedAt: "",
      deletedBy: "",
      deletedAt: "",
    });
    seenCodes.add(item.code);
  });

  return normalized.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "vi");
  });
}

function ensureFinanceCategoryCodes(state, codes, options = {}) {
  const nowIso = options.now || new Date().toISOString();
  const actorId = typeof options.actorId === "string" ? options.actorId : "";
  const seen = new Set((Array.isArray(state.financeExpenseCategories) ? state.financeExpenseCategories : []).map((item) => item.code));

  let hasChanges = false;
  (Array.isArray(codes) ? codes : []).forEach((codeCandidate) => {
    const code = normalizeFinanceExpenseCategory(codeCandidate);
    if (!code || seen.has(code)) return;
    state.financeExpenseCategories.push({
      code,
      name: getFinanceDefaultCategoryName(code),
      active: true,
      createdBy: actorId,
      created_by: actorId,
      createdAt: nowIso,
      timestamp: nowIso,
      updatedBy: "",
      updatedAt: "",
      deletedBy: "",
      deletedAt: "",
    });
    seen.add(code);
    hasChanges = true;
  });

  if (hasChanges) {
    state.financeExpenseCategories = normalizeFinanceExpenseCategories(state.financeExpenseCategories, { now: nowIso });
  }
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
  const integrityVersion = Number(transaction.integrityVersion) > 0 ? Number(transaction.integrityVersion) : 1;
  const payload = {
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
  };
  if (integrityVersion >= 2) {
    payload.transferId = transaction.transferId || "";
    payload.transferRole = transaction.transferRole || "";
    payload.transferCounterpartyUserId = transaction.transferCounterpartyUserId || "";
  }
  return JSON.stringify(payload);
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

  state.inventoryTransactions = Array.isArray(state.inventoryTransactions)
    ? state.inventoryTransactions
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const itemName =
            typeof item.itemName === "string"
              ? item.itemName.trim()
              : typeof item.name === "string"
                ? item.name.trim()
                : "";
          const area = normalizeInventoryArea(item.area || item.zone || item.location);
          const type = normalizeInventoryType(item.type);
          const quantity = Number(item.quantity || item.amount || 0);
          const note = typeof item.note === "string" ? item.note : "";
          const date = typeof item.date === "string" ? item.date.trim() : "";
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
          const transferCounterpartyArea = normalizeInventoryArea(
            item.transferCounterpartyArea || item.transfer_counterparty_area || item.counterpartyArea,
          );

          return {
            id: typeof item.id === "string" && item.id ? item.id : createId("inv"),
            itemName,
            area,
            type,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
            note,
            date,
            transferId,
            transferRole,
            transferCounterpartyArea,
            createdBy,
            created_by: createdBy,
            createdAt,
            timestamp: createdAt,
          };
        })
        .filter((item) => item.itemName && item.area && item.type && isValidDay(item.date) && item.quantity > 0)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
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

  state.financeExpenseCategories = normalizeFinanceExpenseCategories(state.financeExpenseCategories);
  const knownCategoryCodes = new Set(state.financeExpenseCategories.map((item) => item.code));

  let shouldResetFinanceIntegrity = false;
  const missingCategoryCodes = new Set();
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
          if (category && !knownCategoryCodes.has(category)) {
            missingCategoryCodes.add(category);
          }
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
          const transferId =
            typeof item.transferId === "string"
              ? item.transferId
              : typeof item.transfer_id === "string"
                ? item.transfer_id
                : "";
          const rawSubCategory =
            typeof item.subCategory === "string"
              ? item.subCategory
              : typeof item.sub_category === "string"
                ? item.sub_category
                : extractFinanceSubCategoryFromNote(rawNote);
          const subCategory =
            type === FINANCE_TYPE_OUT && !transferId ? normalizeFinanceSubCategory(rawSubCategory) : "";
          const adjustmentOf =
            typeof item.adjustmentOf === "string"
              ? item.adjustmentOf
              : typeof item.adjustment_of === "string"
                ? item.adjustment_of
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
          const isAdjustment = Boolean(item.isAdjustment || item.adjustment) || Boolean(adjustmentOf) || isAdjustmentNote(rawNote);
          const noteBase = isAdjustment ? normalizeAdjustmentNote(rawNote) : normalizeTextValue(rawNote);
          const note = noteBase || "Không có mô tả";

          return {
            id: typeof item.id === "string" && item.id ? item.id : createId("fin"),
            userId,
            type,
            amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
            category,
            subCategory,
            note,
            isAdjustment,
            adjustmentOf,
            transferId,
            transferRole,
            transferCounterpartyUserId,
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

  if (missingCategoryCodes.size > 0) {
    ensureFinanceCategoryCodes(state, Array.from(missingCategoryCodes), { actorId: "system" });
  }

  const transactionMap = new Map(state.financeTransactions.map((item) => [item.id, item]));
  const missingCategoryFromReclassCodes = new Set();
  state.financeCategoryReclassLogs = Array.isArray(state.financeCategoryReclassLogs)
    ? state.financeCategoryReclassLogs
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const transactionId = typeof item.transactionId === "string" ? item.transactionId : "";
          const transaction = transactionMap.get(transactionId);
          if (!transaction) return null;
          if (normalizeFinanceTransactionType(transaction.type) !== FINANCE_TYPE_OUT) return null;
          if (transaction.transferId) return null;

          const fromCategory = normalizeFinanceExpenseCategory(item.fromCategory || item.from_category || transaction.category);
          const toCategory = normalizeFinanceExpenseCategory(item.toCategory || item.to_category);
          if (!fromCategory || !toCategory || fromCategory === toCategory) return null;

          if (!knownCategoryCodes.has(fromCategory)) {
            missingCategoryFromReclassCodes.add(fromCategory);
          }
          if (!knownCategoryCodes.has(toCategory)) {
            missingCategoryFromReclassCodes.add(toCategory);
          }

          const reason = normalizeTextValue(item.reason || item.note || "");
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
            id: typeof item.id === "string" && item.id ? item.id : createId("frc"),
            transactionId,
            fromCategory,
            toCategory,
            reason,
            createdBy,
            created_by: createdBy,
            createdAt,
            timestamp: createdAt,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    : [];

  if (missingCategoryFromReclassCodes.size > 0) {
    ensureFinanceCategoryCodes(state, Array.from(missingCategoryFromReclassCodes), { actorId: "system" });
  }

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
    inventoryTransactions: [],
    financeTransactions: [],
    financeExpenseCategories: [],
    financeCategoryReclassLogs: [],
    systemAuditLogs: [],
    users: [],
    pushSubscriptions: [],
  };
}

function extractStateCollections(rawState) {
  const parsed = rawState && typeof rawState === "object" ? rawState : {};
  return {
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    products: Array.isArray(parsed.products) ? parsed.products : [],
    visits: Array.isArray(parsed.visits) ? parsed.visits : [],
    referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
    inventoryTransactions: Array.isArray(parsed.inventoryTransactions) ? parsed.inventoryTransactions : [],
    financeTransactions: Array.isArray(parsed.financeTransactions) ? parsed.financeTransactions : [],
    financeExpenseCategories: Array.isArray(parsed.financeExpenseCategories) ? parsed.financeExpenseCategories : [],
    financeCategoryReclassLogs: Array.isArray(parsed.financeCategoryReclassLogs) ? parsed.financeCategoryReclassLogs : [],
    systemAuditLogs: Array.isArray(parsed.systemAuditLogs)
      ? parsed.systemAuditLogs
      : Array.isArray(parsed.auditLogs)
        ? parsed.auditLogs
        : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
    pushSubscriptions: Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [],
  };
}

function summarizeState(snapshotState) {
  const safeState = snapshotState && typeof snapshotState === "object" ? snapshotState : {};
  return {
    customers: Array.isArray(safeState.customers) ? safeState.customers.length : 0,
    products: Array.isArray(safeState.products) ? safeState.products.length : 0,
    visits: Array.isArray(safeState.visits) ? safeState.visits.length : 0,
    referrals: Array.isArray(safeState.referrals) ? safeState.referrals.length : 0,
    inventoryTransactions: Array.isArray(safeState.inventoryTransactions) ? safeState.inventoryTransactions.length : 0,
    financeTransactions: Array.isArray(safeState.financeTransactions) ? safeState.financeTransactions.length : 0,
    financeExpenseCategories: Array.isArray(safeState.financeExpenseCategories) ? safeState.financeExpenseCategories.length : 0,
    financeCategoryReclassLogs: Array.isArray(safeState.financeCategoryReclassLogs)
      ? safeState.financeCategoryReclassLogs.length
      : 0,
    systemAuditLogs: Array.isArray(safeState.systemAuditLogs) ? safeState.systemAuditLogs.length : 0,
    users: Array.isArray(safeState.users) ? safeState.users.length : 0,
    pushSubscriptions: Array.isArray(safeState.pushSubscriptions) ? safeState.pushSubscriptions.length : 0,
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
      ...createInitialState(),
      ...extractStateCollections(parsed),
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

function getInventoryTransactionsForClient(requestUser) {
  if (!hasFeaturePermission(requestUser, "inventory")) {
    return [];
  }

  return state.inventoryTransactions;
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

function getFinanceExpenseCategoriesForClient(requestUser) {
  if (!hasFeaturePermission(requestUser, "finance")) {
    return [];
  }

  return state.financeExpenseCategories;
}

function getFinanceCategoryReclassLogsForClient(requestUser) {
  if (!hasFeaturePermission(requestUser, "finance")) {
    return [];
  }

  if (requestUser.role === "admin") {
    return state.financeCategoryReclassLogs;
  }

  const allowedTransactionIds = new Set(
    getFinanceTransactionsForClient(requestUser)
      .filter((item) => item.userId === requestUser.id)
      .map((item) => item.id),
  );

  return state.financeCategoryReclassLogs.filter((item) => allowedTransactionIds.has(item.transactionId));
}

function getLatestFinanceCategoryReclassMap() {
  const map = new Map();
  state.financeCategoryReclassLogs.forEach((item) => {
    if (!item?.transactionId) return;
    if (map.has(item.transactionId)) return;
    map.set(item.transactionId, item);
  });
  return map;
}

function getFinanceTransactionEffectiveCategoryCode(transaction, latestReclassMap = getLatestFinanceCategoryReclassMap()) {
  if (!transaction) return "";
  if (normalizeFinanceTransactionType(transaction.type) !== FINANCE_TYPE_OUT) return "";
  if (transaction.transferId) return "";
  const baseCategory = normalizeFinanceExpenseCategory(transaction.category);
  const reclass = latestReclassMap.get(transaction.id);
  if (!reclass) return baseCategory;
  return normalizeFinanceExpenseCategory(reclass.toCategory) || baseCategory;
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

function assertAdminFinanceMutationPermission(requestUser) {
  assertFeaturePermission(requestUser, "finance");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên được sửa hoặc xoá giao dịch tài chính.");
  }
}

function findFinanceTransactionById(transactionId) {
  const targetId = typeof transactionId === "string" ? transactionId.trim() : "";
  if (!targetId) {
    throw httpError(400, "Thiếu mã giao dịch.");
  }

  const transaction = state.financeTransactions.find((item) => item.id === targetId && item.integrityValid !== false);
  if (!transaction) {
    throw httpError(404, "Không tìm thấy giao dịch hợp lệ.");
  }

  return transaction;
}

function ensureMemberWalletTransaction(transaction) {
  const walletUser = state.users.find((item) => item.id === transaction.userId);
  if (!walletUser || walletUser.role !== "member") {
    throw httpError(403, "Chỉ được thao tác giao dịch thuộc ví nhân viên.");
  }
}

function applyTransactionDateToFinanceCreatedAt(currentCreatedAt, transactionDate) {
  const dayKey = typeof transactionDate === "string" ? transactionDate.trim() : "";
  if (!dayKey) {
    return currentCreatedAt;
  }

  if (!isValidDay(dayKey)) {
    return "";
  }

  const reference = new Date(currentCreatedAt || Date.now());
  const refDate = Number.isNaN(reference.getTime()) ? new Date() : reference;
  const timePart = `${String(refDate.getHours()).padStart(2, "0")}:${String(refDate.getMinutes()).padStart(2, "0")}:${String(
    refDate.getSeconds(),
  ).padStart(2, "0")}`;
  const createdAt = `${dayKey}T${timePart}`;
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "" : createdAt;
}

function assertFinanceBalancesNotNegative(transactions) {
  const balances = new Map();
  const rows = Array.isArray(transactions) ? transactions : [];

  rows.forEach((item) => {
    const userId = typeof item?.userId === "string" ? item.userId : "";
    if (!userId) return;
    const amount = Number(item.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const type = normalizeFinanceTransactionType(item.type);
    if (!type) return;

    const delta = type === FINANCE_TYPE_IN ? amount : -amount;
    balances.set(userId, (balances.get(userId) || 0) + delta);
  });

  const negativeEntry = Array.from(balances.entries()).find(([, balance]) => balance < 0);
  if (!negativeEntry) return;

  const [userId, balance] = negativeEntry;
  const user = state.users.find((item) => item.id === userId);
  const userLabel = user ? `${user.fullName} (${user.username})` : userId;
  throw httpError(
    409,
    `Không thể lưu thay đổi vì số tồn của ${userLabel} sẽ âm ${Math.abs(Math.round(balance)).toLocaleString("vi-VN")} VND.`,
  );
}

function rebuildFinanceLedgerIntegrity() {
  state.financeTransactions = state.financeTransactions.map((item) => ({
    ...item,
    integrityPrevHash: "",
    integrityHash: "",
    integrityVersion: 1,
    integrityValid: true,
  }));

  const result = applyFinanceLedgerIntegrity(state.financeTransactions);
  if (result.invalidCount > 0) {
    throw httpError(500, "Không thể tái tạo chuỗi toàn vẹn cho sổ giao dịch tài chính.");
  }
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
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    financeCategoryReclassLogs: clone(getFinanceCategoryReclassLogsForClient(requestUser)),
    inventoryTransactions: clone(getInventoryTransactionsForClient(requestUser)),
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

function canMutateInventoryByAreaAndType(user, area, type) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!hasFeaturePermission(user, "inventory")) return false;

  if (area === INVENTORY_AREA_WAREHOUSE && type === INVENTORY_TYPE_IN) {
    return Boolean(user.permissions?.inventoryWarehouseIn);
  }
  if (area === INVENTORY_AREA_WAREHOUSE && type === INVENTORY_TYPE_OUT) {
    return Boolean(user.permissions?.inventoryWarehouseOut);
  }
  if (area === INVENTORY_AREA_SPA && type === INVENTORY_TYPE_IN) {
    return Boolean(user.permissions?.inventorySpaIn);
  }
  if (area === INVENTORY_AREA_SPA && type === INVENTORY_TYPE_OUT) {
    return Boolean(user.permissions?.inventorySpaOut);
  }

  return false;
}

function assertInventoryMutationPermission(user, area, type) {
  assertFeaturePermission(user, "inventory");
  if (canMutateInventoryByAreaAndType(user, area, type)) return;
  throw httpError(403, "Bạn chưa được cấp quyền thực hiện nhập/xuất cho khu vực này.");
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

function addInventoryTransaction(requestUser, input) {
  assertFeaturePermission(requestUser, "inventory");

  const itemName = typeof input?.itemName === "string" ? input.itemName.trim() : "";
  const area = normalizeInventoryArea(input?.area);
  const type = normalizeInventoryType(input?.type);
  const quantity = Number(input?.quantity || 0);
  const note = typeof input?.note === "string" ? input.note : "";
  const date = typeof input?.date === "string" ? input.date.trim() : "";
  const transferTargetArea = normalizeInventoryArea(input?.transferTargetArea || input?.transferToArea || "");

  if (!itemName || !area || !type || !isValidDay(date) || !Number.isFinite(quantity) || quantity <= 0) {
    throw httpError(400, "Vui lòng nhập đầy đủ tên hàng, khu vực, loại giao dịch, ngày hợp lệ và số lượng > 0.");
  }

  if (area !== INVENTORY_AREA_WAREHOUSE && type === INVENTORY_TYPE_IN) {
    throw httpError(400, "Ngoài kho, khu vực chỉ được xuất. Nhập sẽ đi từ kho xuất.");
  }

  if (transferTargetArea && !(area === INVENTORY_AREA_WAREHOUSE && type === INVENTORY_TYPE_OUT)) {
    throw httpError(400, "Chỉ giao dịch Kho xuất mới được chọn khu vực nhận.");
  }

  if (transferTargetArea && transferTargetArea === INVENTORY_AREA_WAREHOUSE) {
    throw httpError(400, "Khu vực nhận phải khác Kho.");
  }

  assertInventoryMutationPermission(requestUser, area, type);
  if (transferTargetArea && !canMutateInventoryByAreaAndType(requestUser, transferTargetArea, INVENTORY_TYPE_IN)) {
    throw httpError(403, "Bạn chưa được cấp quyền nhập cho khu vực nhận hàng.");
  }

  const nowIso = new Date().toISOString();
  const transferId = transferTargetArea ? createId("invtf") : "";
  const transaction = {
    id: createId("inv"),
    itemName,
    area,
    type,
    quantity,
    note,
    date,
    transferId,
    transferRole: transferTargetArea ? "OUT" : "",
    transferCounterpartyArea: transferTargetArea || "",
    createdBy: requestUser.id,
    created_by: requestUser.id,
    createdAt: nowIso,
    timestamp: nowIso,
  };

  let linkedInTransaction = null;
  if (transferTargetArea) {
    linkedInTransaction = {
      id: createId("inv"),
      itemName,
      area: transferTargetArea,
      type: INVENTORY_TYPE_IN,
      quantity,
      note: note ? `[Từ kho] ${note}` : "[Từ kho]",
      date,
      transferId,
      transferRole: "IN",
      transferCounterpartyArea: INVENTORY_AREA_WAREHOUSE,
      createdBy: requestUser.id,
      created_by: requestUser.id,
      createdAt: nowIso,
      timestamp: nowIso,
    };
    state.inventoryTransactions.unshift(linkedInTransaction);
  }

  state.inventoryTransactions.unshift(transaction);
  persist();

  return {
    transaction: clone(transaction),
    linkedTransaction: linkedInTransaction ? clone(linkedInTransaction) : null,
    inventoryTransactions: clone(getInventoryTransactionsForClient(requestUser)),
  };
}

function updateInventoryTransaction(requestUser, transactionId, input) {
  assertFeaturePermission(requestUser, "inventory");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên mới có quyền chỉnh sửa lịch sử kho/spa.");
  }

  const targetId = typeof transactionId === "string" ? transactionId.trim() : "";
  if (!targetId) {
    throw httpError(400, "Thiếu mã giao dịch cần chỉnh sửa.");
  }

  const transaction = state.inventoryTransactions.find((item) => item.id === targetId);
  if (!transaction) {
    throw httpError(404, "Không tìm thấy giao dịch kho/spa.");
  }

  const itemName = typeof input?.itemName === "string" ? input.itemName.trim() : "";
  const quantity = Number(input?.quantity || 0);
  const date = typeof input?.date === "string" ? input.date.trim() : "";
  const note = typeof input?.note === "string" ? input.note.trim() : "";

  if (!itemName || !isValidDay(date) || !Number.isFinite(quantity) || quantity <= 0) {
    throw httpError(400, "Vui lòng nhập tên hàng, ngày hợp lệ và số lượng > 0.");
  }

  const transferId = typeof transaction.transferId === "string" ? transaction.transferId.trim() : "";
  const formatNoteByRole = (role, rawNote) => {
    const normalizedRole = String(role || "")
      .trim()
      .toUpperCase();
    if (normalizedRole === "IN") {
      return rawNote ? `[Từ kho] ${rawNote}` : "[Từ kho]";
    }
    return rawNote;
  };
  const applyToRow = (row) => {
    row.itemName = itemName;
    row.quantity = quantity;
    row.date = date;
    row.note = formatNoteByRole(row.transferRole, note);
  };

  if (!transferId) {
    applyToRow(transaction);
  } else {
    let hasApplied = false;
    state.inventoryTransactions.forEach((item) => {
      if (typeof item.transferId !== "string" || item.transferId.trim() !== transferId) return;
      applyToRow(item);
      hasApplied = true;
    });
    if (!hasApplied) {
      applyToRow(transaction);
    }
  }

  persist();

  return {
    transaction: clone(transaction),
    inventoryTransactions: clone(getInventoryTransactionsForClient(requestUser)),
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
  const category = resolveFinanceExpenseCategoryCode(input?.category, state.financeExpenseCategories, {
    allowInactive: false,
  });
  const rawSubCategory =
    typeof input?.subCategory === "string"
      ? input.subCategory
      : typeof input?.sub_category === "string"
        ? input.sub_category
        : "";
  const subCategory = normalizeFinanceSubCategory(rawSubCategory);
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

  const canFund = hasFeaturePermission(requestUser, "financeFund");
  const isTransferOut = type === FINANCE_TYPE_OUT && requestedUserId && requestedUserId !== requestUser.id;
  let transferTargetUserId = "";
  let walletUserId = requestUser.id;

  if (type === FINANCE_TYPE_IN) {
    if (requestUser.role !== "admin") {
      throw httpError(403, "Chỉ quản trị viên được nạp thêm tiền vào ví của chính mình.");
    }
    if (requestedUserId && requestedUserId !== requestUser.id) {
      throw httpError(400, "Giao dịch NHẬP chỉ áp dụng cho ví của chính bạn.");
    }
    walletUserId = requestUser.id;
  } else {
    if (isTransferOut) {
      if (!canFund) {
        throw httpError(403, "Bạn chưa có quyền cấp tiền cho nhân viên. Vui lòng liên hệ quản trị viên.");
      }

      const targetUser = state.users.find((item) => item.id === requestedUserId && item.role === "member");
      if (!targetUser) {
        throw httpError(400, "Tài khoản ví không hợp lệ.");
      }
      transferTargetUserId = targetUser.id;
    } else {
      if (!category) {
        throw httpError(400, "Danh mục xuất không hợp lệ hoặc đã ngừng sử dụng.");
      }
      if (requestedUserId && requestedUserId !== requestUser.id) {
        throw httpError(403, "Bạn chỉ được ghi nhận giao dịch cho ví của chính mình.");
      }
    }

    const currentBalance = getFinanceBalanceForUser(requestUser.id);
    if (amount > currentBalance) {
      throw httpError(409, "Số tồn hiện tại không đủ để thực hiện giao dịch XUẤT.");
    }
    walletUserId = requestUser.id;
  }

  if (type === FINANCE_TYPE_OUT && !isTransferOut) {
    receipt = normalizeFinanceReceiptInput(receiptInputRaw);
  }

  let adjustmentOf = "";
  if (isTransferOut && requestedAdjustmentOf) {
    throw httpError(400, "Chuyển tiền nội bộ không hỗ trợ adjustmentOf. Hãy tạo giao dịch điều chỉnh riêng.");
  }
  if (requestedAdjustmentOf) {
    const reference = state.financeTransactions.find((item) => item.id === requestedAdjustmentOf);
    if (!reference || reference.integrityValid === false) {
      throw httpError(400, "Không tìm thấy giao dịch gốc hợp lệ để điều chỉnh.");
    }
    if (reference.userId !== walletUserId) {
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
  const signTransaction = (payload, prevHash) => {
    const record = {
      id: createId("fin"),
      userId: payload.userId,
      type: payload.type,
      amount,
      category: payload.category || "",
      subCategory: payload.subCategory || "",
      note: payload.note || "",
      isAdjustment: Boolean(payload.isAdjustment),
      adjustmentOf: payload.adjustmentOf || "",
      transferId: payload.transferId || "",
      transferRole: payload.transferRole || "",
      transferCounterpartyUserId: payload.transferCounterpartyUserId || "",
      receiptImageDataUrl: payload.receiptImageDataUrl || "",
      receiptImageName: payload.receiptImageName || "",
      createdBy: requestUser.id,
      created_by: requestUser.id,
      createdAt,
      timestamp: createdAt,
      integrityPrevHash: prevHash,
      integrityVersion: 1,
    };
    record.integrityHash = signFinanceLedgerEntry(record, prevHash);
    record.integrityValid = true;
    return record;
  };

  let resultTransaction = null;
  if (isTransferOut && transferTargetUserId) {
    const transferId = createId("ftr");
    const inTransaction = signTransaction(
      {
        userId: transferTargetUserId,
        type: FINANCE_TYPE_IN,
        category: "",
        subCategory: "",
        note,
        isAdjustment: false,
        adjustmentOf: "",
        transferId,
        transferRole: "IN",
        transferCounterpartyUserId: requestUser.id,
      },
      previousHash,
    );
    const outTransaction = signTransaction(
      {
        userId: requestUser.id,
        type: FINANCE_TYPE_OUT,
        category: "",
        subCategory: "",
        note,
        isAdjustment: false,
        adjustmentOf: "",
        transferId,
        transferRole: "OUT",
        transferCounterpartyUserId: transferTargetUserId,
      },
      inTransaction.integrityHash,
    );
    state.financeTransactions.unshift(inTransaction);
    state.financeTransactions.unshift(outTransaction);
    resultTransaction = outTransaction;

    appendSystemAuditLog({
      domain: FINANCE_LOG_DOMAIN,
      action: "FINANCE_INTERNAL_TRANSFER_CREATED",
      actorId: requestUser.id,
      walletUserId: transferTargetUserId,
      transactionId: outTransaction.id,
      createdAt,
      details: {
        transferId,
        senderUserId: requestUser.id,
        receiverUserId: transferTargetUserId,
        debitTransactionId: outTransaction.id,
        creditTransactionId: inTransaction.id,
        amount,
        note,
      },
    });
  } else {
    const transaction = signTransaction(
      {
        userId: walletUserId,
        type,
        category: type === FINANCE_TYPE_OUT ? category : "",
        subCategory: type === FINANCE_TYPE_OUT ? subCategory : "",
        note,
        isAdjustment,
        adjustmentOf,
        transferId: "",
        transferRole: "",
        transferCounterpartyUserId: "",
        receiptImageDataUrl: type === FINANCE_TYPE_OUT ? receipt.receiptImageDataUrl : "",
        receiptImageName: type === FINANCE_TYPE_OUT ? receipt.receiptImageName : "",
      },
      previousHash,
    );
    state.financeTransactions.unshift(transaction);
    resultTransaction = transaction;

    appendSystemAuditLog({
      domain: FINANCE_LOG_DOMAIN,
      action: "FINANCE_TRANSACTION_CREATED",
      actorId: requestUser.id,
      walletUserId: walletUserId,
      transactionId: transaction.id,
      createdAt,
      details: {
        type,
        amount,
        category: transaction.category || "",
        subCategory: transaction.subCategory || "",
        note,
        isAdjustment,
        adjustmentOf: adjustmentOf || "",
        hasReceiptImage: Boolean(transaction.receiptImageDataUrl),
      },
    });
  }
  persist();

  return {
    transaction: clone(resultTransaction),
    targetBalance: resultTransaction ? getFinanceBalanceForUser(resultTransaction.userId) : 0,
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    financeCategoryReclassLogs: clone(getFinanceCategoryReclassLogsForClient(requestUser)),
  };
}

function updateFinanceTransaction(requestUser, transactionId, input) {
  assertAdminFinanceMutationPermission(requestUser);

  const transaction = findFinanceTransactionById(transactionId);
  ensureMemberWalletTransaction(transaction);

  const patchInput = input && typeof input === "object" ? input : {};
  const hasAmount = Object.prototype.hasOwnProperty.call(patchInput, "amount");
  const hasNote = Object.prototype.hasOwnProperty.call(patchInput, "note");
  const hasDate = Object.prototype.hasOwnProperty.call(patchInput, "transactionDate");
  const hasCategory = Object.prototype.hasOwnProperty.call(patchInput, "category");
  const hasSubCategory =
    Object.prototype.hasOwnProperty.call(patchInput, "subCategory") ||
    Object.prototype.hasOwnProperty.call(patchInput, "sub_category");
  if (!hasAmount && !hasNote && !hasDate && !hasCategory && !hasSubCategory) {
    throw httpError(400, "Vui lòng cung cấp ít nhất một trường cần cập nhật.");
  }

  const nextAmount = hasAmount ? Number(patchInput.amount || 0) : Number(transaction.amount || 0);
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw httpError(400, "Số tiền phải lớn hơn 0.");
  }

  const nextDateRaw = hasDate ? patchInput.transactionDate : dayOf(transaction.createdAt || transaction.timestamp || "");
  const nextCreatedAt = applyTransactionDateToFinanceCreatedAt(transaction.createdAt || transaction.timestamp || "", nextDateRaw);
  if (!nextCreatedAt) {
    throw httpError(400, "Ngày giao dịch không hợp lệ.");
  }

  const noteInput = hasNote ? patchInput.note : transaction.note;
  let nextNote = normalizeTextValue(noteInput);
  if (!nextNote) {
    throw httpError(400, "Vui lòng nhập nội dung mô tả giao dịch.");
  }
  if (nextNote.length > 500) {
    throw httpError(400, "Nội dung mô tả tối đa 500 ký tự.");
  }

  const shouldAdjust = Boolean(transaction.isAdjustment || transaction.adjustmentOf || isAdjustmentNote(nextNote));
  if (shouldAdjust) {
    nextNote = normalizeAdjustmentNote(nextNote);
  }
  const nextSubCategory = normalizeFinanceSubCategory(
    hasSubCategory
      ? typeof patchInput.subCategory === "string"
        ? patchInput.subCategory
        : typeof patchInput.sub_category === "string"
          ? patchInput.sub_category
          : ""
      : transaction.subCategory || "",
  );

  const baseType = normalizeFinanceTransactionType(transaction.type);
  if (!baseType) {
    throw httpError(400, "Loại giao dịch hiện tại không hợp lệ.");
  }

  const previousSnapshot = clone(transaction);
  const updatedIds = [transaction.id];
  const isInternalTransfer = Boolean(transaction.transferId);
  let transferCounterpartSnapshot = null;
  let removedReclassCount = 0;

  if (isInternalTransfer) {
    if (hasCategory || hasSubCategory) {
      throw httpError(400, "Giao dịch chuyển nội bộ không hỗ trợ chỉnh danh mục hoặc hạng mục.");
    }

    const counterpart = state.financeTransactions.find(
      (item) =>
        item.id !== transaction.id &&
        item.transferId === transaction.transferId &&
        item.integrityValid !== false &&
        normalizeFinanceTransactionType(item.type),
    );
    if (!counterpart) {
      throw httpError(409, "Không tìm thấy bút toán đối ứng của giao dịch chuyển nội bộ.");
    }

    transferCounterpartSnapshot = clone(counterpart);
    updatedIds.push(counterpart.id);

    transaction.amount = nextAmount;
    transaction.note = nextNote;
    transaction.createdAt = nextCreatedAt;
    transaction.timestamp = nextCreatedAt;
    transaction.isAdjustment = false;
    transaction.category = "";
    transaction.subCategory = "";
    transaction.receiptImageDataUrl = "";
    transaction.receiptImageName = "";

    counterpart.amount = nextAmount;
    counterpart.note = nextNote;
    counterpart.createdAt = nextCreatedAt;
    counterpart.timestamp = nextCreatedAt;
    counterpart.isAdjustment = false;
    counterpart.category = "";
    counterpart.subCategory = "";
    counterpart.receiptImageDataUrl = "";
    counterpart.receiptImageName = "";
  } else {
    let nextCategory = transaction.category || "";
    if (baseType === FINANCE_TYPE_OUT) {
      if (hasCategory) {
        const resolved = resolveFinanceExpenseCategoryCode(patchInput.category, state.financeExpenseCategories, {
          allowInactive: false,
        });
        if (!resolved) {
          throw httpError(400, "Danh mục xuất không hợp lệ hoặc đã ngừng sử dụng.");
        }
        nextCategory = resolved;
      } else if (!nextCategory) {
        throw httpError(400, "Danh mục xuất không hợp lệ.");
      }
    } else if (hasCategory) {
      throw httpError(400, "Giao dịch NHẬP không hỗ trợ chỉnh danh mục.");
    }
    if (baseType === FINANCE_TYPE_IN && hasSubCategory) {
      throw httpError(400, "Giao dịch NHẬP không hỗ trợ chỉnh hạng mục.");
    }

    transaction.amount = nextAmount;
    transaction.note = nextNote;
    transaction.createdAt = nextCreatedAt;
    transaction.timestamp = nextCreatedAt;
    transaction.isAdjustment = shouldAdjust;
    transaction.category = baseType === FINANCE_TYPE_OUT ? nextCategory : "";
    transaction.subCategory = baseType === FINANCE_TYPE_OUT ? nextSubCategory : "";
    transaction.receiptImageDataUrl = baseType === FINANCE_TYPE_OUT ? transaction.receiptImageDataUrl || "" : "";
    transaction.receiptImageName = baseType === FINANCE_TYPE_OUT ? transaction.receiptImageName || "" : "";

    if (baseType === FINANCE_TYPE_OUT && previousSnapshot.category !== transaction.category) {
      const beforeCount = state.financeCategoryReclassLogs.length;
      state.financeCategoryReclassLogs = state.financeCategoryReclassLogs.filter((item) => item.transactionId !== transaction.id);
      removedReclassCount = beforeCount - state.financeCategoryReclassLogs.length;
    }
  }

  assertFinanceBalancesNotNegative(state.financeTransactions);
  rebuildFinanceLedgerIntegrity();
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_TRANSACTION_UPDATED",
    actorId: requestUser.id,
    walletUserId: transaction.userId,
    transactionId: transaction.id,
    createdAt: new Date().toISOString(),
    details: {
      isInternalTransfer,
      updatedTransactionIds: updatedIds,
      removedReclassCount,
      before: previousSnapshot,
      after: clone(transaction),
      counterpartBefore: transferCounterpartSnapshot,
    },
  });
  persist();

  return {
    transaction: clone(transaction),
    updatedTransactionIds: clone(updatedIds),
    targetBalance: getFinanceBalanceForUser(transaction.userId),
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    financeCategoryReclassLogs: clone(getFinanceCategoryReclassLogsForClient(requestUser)),
  };
}

function deleteFinanceTransaction(requestUser, transactionId) {
  assertAdminFinanceMutationPermission(requestUser);

  const transaction = findFinanceTransactionById(transactionId);
  ensureMemberWalletTransaction(transaction);

  const deleteIds = new Set([transaction.id]);
  const deletedSnapshots = [clone(transaction)];
  const isInternalTransfer = Boolean(transaction.transferId);
  if (isInternalTransfer) {
    const counterpart = state.financeTransactions.find(
      (item) =>
        item.id !== transaction.id &&
        item.transferId === transaction.transferId &&
        item.integrityValid !== false &&
        normalizeFinanceTransactionType(item.type),
    );
    if (!counterpart) {
      throw httpError(409, "Không tìm thấy bút toán đối ứng của giao dịch chuyển nội bộ.");
    }
    deleteIds.add(counterpart.id);
    deletedSnapshots.push(clone(counterpart));
  }

  state.financeTransactions = state.financeTransactions.filter((item) => !deleteIds.has(item.id));
  state.financeCategoryReclassLogs = state.financeCategoryReclassLogs.filter((item) => !deleteIds.has(item.transactionId));

  assertFinanceBalancesNotNegative(state.financeTransactions);
  rebuildFinanceLedgerIntegrity();
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_TRANSACTION_DELETED",
    actorId: requestUser.id,
    walletUserId: transaction.userId,
    transactionId: transaction.id,
    createdAt: new Date().toISOString(),
    details: {
      isInternalTransfer,
      deletedTransactionIds: Array.from(deleteIds),
      deletedTransactions: deletedSnapshots,
    },
  });
  persist();

  return {
    deletedTransactionId: transaction.id,
    deletedTransactionIds: Array.from(deleteIds),
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    financeCategoryReclassLogs: clone(getFinanceCategoryReclassLogsForClient(requestUser)),
  };
}

function createFinanceExpenseCategory(requestUser, input) {
  assertFeaturePermission(requestUser, "finance");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên được quản lý danh mục xuất.");
  }

  const name = normalizeTextValue(input?.name);
  if (!name) {
    throw httpError(400, "Vui lòng nhập tên danh mục.");
  }
  if (name.length > 80) {
    throw httpError(400, "Tên danh mục tối đa 80 ký tự.");
  }

  const existingCodes = new Set(state.financeExpenseCategories.map((item) => item.code));
  const code = buildFinanceCategoryCodeFromName(name, existingCodes);
  const nowIso = new Date().toISOString();
  const category = {
    code,
    name,
    active: true,
    createdBy: requestUser.id,
    created_by: requestUser.id,
    createdAt: nowIso,
    timestamp: nowIso,
    updatedBy: "",
    updatedAt: "",
    deletedBy: "",
    deletedAt: "",
  };

  state.financeExpenseCategories.push(category);
  state.financeExpenseCategories = normalizeFinanceExpenseCategories(state.financeExpenseCategories);
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_CATEGORY_CREATED",
    actorId: requestUser.id,
    createdAt: nowIso,
    details: {
      categoryCode: code,
      categoryName: name,
    },
  });
  persist();

  return {
    category: clone(category),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
  };
}

function updateFinanceExpenseCategory(requestUser, categoryCode, input) {
  assertFeaturePermission(requestUser, "finance");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên được quản lý danh mục xuất.");
  }

  const normalizedCode = normalizeFinanceExpenseCategory(categoryCode);
  if (!normalizedCode) {
    throw httpError(400, "Mã danh mục không hợp lệ.");
  }

  const category = findFinanceCategory(state.financeExpenseCategories, normalizedCode);
  if (!category) {
    throw httpError(404, "Không tìm thấy danh mục cần cập nhật.");
  }

  const nextNameRaw = typeof input?.name === "string" ? input.name : category.name;
  const nextName = normalizeTextValue(nextNameRaw);
  if (!nextName) {
    throw httpError(400, "Vui lòng nhập tên danh mục.");
  }
  if (nextName.length > 80) {
    throw httpError(400, "Tên danh mục tối đa 80 ký tự.");
  }

  const nextActive = typeof input?.active === "boolean" ? input.active : category.active;
  const nowIso = new Date().toISOString();
  category.name = nextName;
  category.active = Boolean(nextActive);
  category.updatedBy = requestUser.id;
  category.updatedAt = nowIso;
  if (category.active) {
    category.deletedBy = "";
    category.deletedAt = "";
  } else {
    category.deletedBy = requestUser.id;
    category.deletedAt = nowIso;
  }

  state.financeExpenseCategories = normalizeFinanceExpenseCategories(state.financeExpenseCategories);
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_CATEGORY_UPDATED",
    actorId: requestUser.id,
    createdAt: nowIso,
    details: {
      categoryCode: category.code,
      categoryName: category.name,
      active: category.active,
    },
  });
  persist();

  return {
    category: clone(findFinanceCategory(state.financeExpenseCategories, normalizedCode)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
  };
}

function deleteFinanceExpenseCategory(requestUser, categoryCode) {
  assertFeaturePermission(requestUser, "finance");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên được quản lý danh mục xuất.");
  }

  const normalizedCode = normalizeFinanceExpenseCategory(categoryCode);
  if (!normalizedCode) {
    throw httpError(400, "Mã danh mục không hợp lệ.");
  }

  const category = findFinanceCategory(state.financeExpenseCategories, normalizedCode);
  if (!category) {
    throw httpError(404, "Không tìm thấy danh mục cần xoá.");
  }

  if (!category.active) {
    return {
      category: clone(category),
      financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    };
  }

  const nowIso = new Date().toISOString();
  category.active = false;
  category.updatedBy = requestUser.id;
  category.updatedAt = nowIso;
  category.deletedBy = requestUser.id;
  category.deletedAt = nowIso;

  state.financeExpenseCategories = normalizeFinanceExpenseCategories(state.financeExpenseCategories);
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_CATEGORY_DELETED",
    actorId: requestUser.id,
    createdAt: nowIso,
    details: {
      categoryCode: category.code,
      categoryName: category.name,
    },
  });
  persist();

  return {
    category: clone(findFinanceCategory(state.financeExpenseCategories, normalizedCode)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
  };
}

function reclassifyFinanceTransactionCategory(requestUser, transactionId, input) {
  assertFeaturePermission(requestUser, "finance");
  if (requestUser.role !== "admin") {
    throw httpError(403, "Chỉ quản trị viên được chỉnh danh mục giao dịch.");
  }

  const targetTransactionId = typeof transactionId === "string" ? transactionId.trim() : "";
  if (!targetTransactionId) {
    throw httpError(400, "Thiếu mã giao dịch cần chỉnh danh mục.");
  }

  const transaction = state.financeTransactions.find((item) => item.id === targetTransactionId && item.integrityValid !== false);
  if (!transaction) {
    throw httpError(404, "Không tìm thấy giao dịch hợp lệ để chỉnh danh mục.");
  }
  if (normalizeFinanceTransactionType(transaction.type) !== FINANCE_TYPE_OUT || transaction.transferId) {
    throw httpError(400, "Chỉ cho phép chỉnh danh mục với giao dịch XUẤT chi tiêu.");
  }

  const toCategory = resolveFinanceExpenseCategoryCode(input?.toCategory, state.financeExpenseCategories, {
    allowInactive: false,
  });
  if (!toCategory) {
    throw httpError(400, "Danh mục mới không hợp lệ hoặc đã ngừng sử dụng.");
  }

  const latestReclassMap = getLatestFinanceCategoryReclassMap();
  const fromCategory = getFinanceTransactionEffectiveCategoryCode(transaction, latestReclassMap);
  if (!fromCategory) {
    throw httpError(400, "Giao dịch chưa có danh mục để điều chỉnh.");
  }
  if (fromCategory === toCategory) {
    throw httpError(400, "Danh mục mới phải khác danh mục hiện tại.");
  }

  const reason = normalizeTextValue(input?.reason);
  if (!reason) {
    throw httpError(400, "Vui lòng nhập lý do điều chỉnh danh mục.");
  }
  if (reason.length > 500) {
    throw httpError(400, "Lý do điều chỉnh tối đa 500 ký tự.");
  }

  const nowIso = new Date().toISOString();
  const reclassLog = {
    id: createId("frc"),
    transactionId: transaction.id,
    fromCategory,
    toCategory,
    reason,
    createdBy: requestUser.id,
    created_by: requestUser.id,
    createdAt: nowIso,
    timestamp: nowIso,
  };

  state.financeCategoryReclassLogs.unshift(reclassLog);
  appendSystemAuditLog({
    domain: FINANCE_LOG_DOMAIN,
    action: "FINANCE_CATEGORY_RECLASSIFIED",
    actorId: requestUser.id,
    walletUserId: transaction.userId,
    transactionId: transaction.id,
    createdAt: nowIso,
    details: {
      fromCategory,
      toCategory,
      reason,
    },
  });
  persist();

  return {
    reclassLog: clone(reclassLog),
    financeTransactions: clone(getFinanceTransactionsForClient(requestUser)),
    financeExpenseCategories: clone(getFinanceExpenseCategoriesForClient(requestUser)),
    financeCategoryReclassLogs: clone(getFinanceCategoryReclassLogsForClient(requestUser)),
  };
}

function restoreDataSnapshot(requestUser, input) {
  assertFeaturePermission(requestUser, "backupData");

  const rootPayload = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!rootPayload) {
    throw httpError(400, "Dữ liệu phục hồi không hợp lệ.");
  }

  const rawSnapshotCandidate =
    rootPayload.snapshot && typeof rootPayload.snapshot === "object" && !Array.isArray(rootPayload.snapshot)
      ? rootPayload.snapshot
      : rootPayload;
  if (!rawSnapshotCandidate || typeof rawSnapshotCandidate !== "object" || Array.isArray(rawSnapshotCandidate)) {
    throw httpError(400, "Dữ liệu phục hồi không hợp lệ.");
  }

  const previousSummary = summarizeState(state);
  state = {
    ...createInitialState(),
    ...extractStateCollections(rawSnapshotCandidate),
  };
  normalizeAllRecords(state);
  ensureAdminAccount(state);

  const nowIso = new Date().toISOString();
  appendSystemAuditLog({
    domain: "system",
    action: "DATA_RESTORED",
    actorId: requestUser.id,
    createdAt: nowIso,
    details: {
      previousSummary,
      snapshotWrapped: Boolean(rootPayload.snapshot),
    },
  });
  persist();

  return {
    summary: summarizeState(state),
    requesterStillExists: Boolean(findUserById(requestUser.id)),
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
  addInventoryTransaction,
  updateInventoryTransaction,
  addReferral,
  updateReferral,
  deleteReferral,
  addFinanceTransaction,
  updateFinanceTransaction,
  deleteFinanceTransaction,
  createFinanceExpenseCategory,
  updateFinanceExpenseCategory,
  deleteFinanceExpenseCategory,
  reclassifyFinanceTransactionCategory,
  restoreDataSnapshot,
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
  getFinanceExpenseCategoriesForClient,
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
