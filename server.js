const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const morgan = require("morgan");

const {
  DEFAULT_ADMIN_USERNAME,
  DATA_FILE,
  addCustomer,
  addPersistListener,
  deleteCustomer,
  importCustomers,
  addProduct,
  updateProduct,
  deleteProduct,
  addReferral,
  updateReferral,
  deleteReferral,
  addVisit,
  updateVisit,
  deleteVisit,
  createMemberAccount,
  deleteMemberAccount,
  resetMemberPassword,
  changeCurrentUserPassword,
  findUserById,
  findUserByUsername,
  getBootstrapForUser,
  hasFeaturePermission,
  purgeDataByDateRange,
  safeUser,
  updateCustomer,
  updateMemberPermissions,
  verifyPassword,
} = require("./server/dataStore");
const { createBackupManager } = require("./server/backupManager");

const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret";
const COOKIE_NAME = "aha_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const backupManager = createBackupManager({
  dataFile: DATA_FILE,
  logger: console,
});
addPersistListener((payload) => {
  backupManager.notifyDataChanged(payload);
});
backupManager.start();

if (!process.env.SESSION_SECRET) {
  console.warn("[AHA] SESSION_SECRET đang dùng mặc định. Hãy đặt SESSION_SECRET mạnh trước khi triển khai.");
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("tiny"));

function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, SESSION_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
  });
}

function setSessionCookie(res, userId) {
  const token = signSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
}

function getSessionUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (!payload || typeof payload.sub !== "string") return null;
    return findUserById(payload.sub);
  } catch (error) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
    return;
  }

  req.user = user;
  next();
}

function sendApiError(res, error, fallbackMessage) {
  const status = Number(error?.status) || 500;
  const message = error?.message || fallbackMessage || "Có lỗi xảy ra ở máy chủ.";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ message });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(
    `window.__AHA_API_BASE__ = ${JSON.stringify(process.env.AHA_API_BASE || "/api")};\nwindow.__AHA_FORCE_REMOTE__ = true;`,
  );
});

app.post("/api/auth/login", (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      res.status(400).json({ message: "Vui lòng nhập tên đăng nhập và mật khẩu." });
      return;
    }

    const user = findUserByUsername(username);
    if (!user || !verifyPassword(user, password)) {
      res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu." });
      return;
    }

    if (user.role === "member" && user.locked) {
      res.status(403).json({ message: "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên." });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({ user: safeUser(user) });
  } catch (error) {
    sendApiError(res, error, "Không thể đăng nhập.");
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.get("/api/bootstrap", requireAuth, (req, res) => {
  try {
    const payload = getBootstrapForUser(req.user);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể tải dữ liệu khởi tạo.");
  }
});

app.post("/api/customers", requireAuth, (req, res) => {
  try {
    const customer = addCustomer(req.user, req.body);
    res.status(201).json({ customer });
  } catch (error) {
    sendApiError(res, error, "Không thể thêm khách hàng.");
  }
});

app.post("/api/customers/import", requireAuth, (req, res) => {
  try {
    const payload = importCustomers(req.user, req.body?.rows);
    res.status(201).json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể nhập khách hàng từ tệp dữ liệu phân tách bằng dấu phẩy.");
  }
});

app.patch("/api/customers/:id", requireAuth, (req, res) => {
  try {
    const customer = updateCustomer(req.user, req.params.id, req.body);
    res.json({ customer });
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật khách hàng.");
  }
});

app.delete("/api/customers/:id", requireAuth, (req, res) => {
  try {
    const deleted = deleteCustomer(req.user, req.params.id);
    res.json({ deleted });
  } catch (error) {
    sendApiError(res, error, "Không thể xoá khách hàng.");
  }
});

app.post("/api/products", requireAuth, (req, res) => {
  try {
    const product = addProduct(req.user, req.body);
    res.status(201).json({ product });
  } catch (error) {
    sendApiError(res, error, "Không thể thêm sản phẩm/dịch vụ.");
  }
});

app.patch("/api/products/:id", requireAuth, (req, res) => {
  try {
    const product = updateProduct(req.user, req.params.id, req.body);
    res.json({ product });
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật sản phẩm/dịch vụ.");
  }
});

app.delete("/api/products/:id", requireAuth, (req, res) => {
  try {
    const deleted = deleteProduct(req.user, req.params.id);
    res.json(deleted);
  } catch (error) {
    sendApiError(res, error, "Không thể xoá sản phẩm/dịch vụ.");
  }
});

app.post("/api/visits", requireAuth, (req, res) => {
  try {
    const payload = addVisit(req.user, req.body);
    res.status(201).json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể ghi nhận tích điểm voucher.");
  }
});

app.patch("/api/visits/:id", requireAuth, (req, res) => {
  try {
    const payload = updateVisit(req.user, req.params.id, req.body);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật tích điểm voucher.");
  }
});

app.delete("/api/visits/:id", requireAuth, (req, res) => {
  try {
    const deleted = deleteVisit(req.user, req.params.id);
    res.json(deleted);
  } catch (error) {
    sendApiError(res, error, "Không thể xoá giao dịch tích điểm voucher.");
  }
});

app.post("/api/referrals", requireAuth, (req, res) => {
  try {
    const payload = addReferral(req.user, req.body);
    res.status(201).json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể ghi nhận hoa hồng giới thiệu.");
  }
});

app.patch("/api/referrals/:id", requireAuth, (req, res) => {
  try {
    const payload = updateReferral(req.user, req.params.id, req.body);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật hoa hồng giới thiệu.");
  }
});

app.delete("/api/referrals/:id", requireAuth, (req, res) => {
  try {
    const deleted = deleteReferral(req.user, req.params.id);
    res.json(deleted);
  } catch (error) {
    sendApiError(res, error, "Không thể xoá giao dịch hoa hồng giới thiệu.");
  }
});

app.post("/api/data-cleanup/range", requireAuth, (req, res) => {
  try {
    const payload = purgeDataByDateRange(req.user, req.body);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể xoá dữ liệu theo khoảng thời gian.");
  }
});

app.post("/api/account/change-password", requireAuth, (req, res) => {
  try {
    const payload = changeCurrentUserPassword(req.user, req.body);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật mật khẩu.");
  }
});

app.post("/api/users", requireAuth, (req, res) => {
  try {
    const user = createMemberAccount(req.user, req.body);
    res.status(201).json({ user });
  } catch (error) {
    sendApiError(res, error, "Không thể tạo tài khoản thành viên.");
  }
});

app.patch("/api/users/:id/permissions", requireAuth, (req, res) => {
  try {
    const user = updateMemberPermissions(req.user, req.params.id, req.body?.permissions);
    res.json({ user });
  } catch (error) {
    sendApiError(res, error, "Không thể cập nhật quyền tài khoản.");
  }
});

app.patch("/api/users/:id/password", requireAuth, (req, res) => {
  try {
    const payload = resetMemberPassword(req.user, req.params.id, req.body?.nextPassword);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể đặt lại mật khẩu thành viên.");
  }
});

app.delete("/api/users/:id", requireAuth, (req, res) => {
  try {
    const payload = deleteMemberAccount(req.user, req.params.id);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Không thể xoá tài khoản thành viên.");
  }
});

app.get("/api/backup/status", requireAuth, (req, res) => {
  try {
    if (!hasFeaturePermission(req.user, "backupData")) {
      res.status(403).json({ message: "Bạn không có quyền xem trạng thái sao lưu dữ liệu." });
      return;
    }

    res.json({ status: backupManager.getStatus() });
  } catch (error) {
    sendApiError(res, error, "Không thể đọc trạng thái sao lưu dữ liệu.");
  }
});

app.post("/api/backup/run", requireAuth, async (req, res) => {
  try {
    if (!hasFeaturePermission(req.user, "backupData")) {
      res.status(403).json({ message: "Bạn không có quyền yêu cầu sao lưu dữ liệu." });
      return;
    }

    const status = await backupManager.requestRun("manual");
    res.status(202).json({ ok: true, status });
  } catch (error) {
    sendApiError(res, error, "Không thể yêu cầu sao lưu dữ liệu ngay.");
  }
});

const ROOT_DIR = __dirname;

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/app.js", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(ROOT_DIR, "app.js"));
});

app.get("/styles.css", (_req, res) => {
  res.type("text/css");
  res.sendFile(path.join(ROOT_DIR, "styles.css"));
});

app.get("/samples/customers-template.csv", (_req, res) => {
  res.type("text/csv; charset=utf-8");
  res.sendFile(path.join(ROOT_DIR, "samples", "customers-template.csv"));
});

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Đường dẫn giao tiếp dữ liệu không tồn tại." });
});

app.use((_req, res) => {
  res.status(404).send("Not found");
});

app.listen(PORT, HOST, () => {
  console.log(`[AHA] Server running at http://${HOST}:${PORT}`);
  console.log(`[AHA] Tài khoản quản trị viên mặc định: ${DEFAULT_ADMIN_USERNAME}`);
  console.log("[AHA] Hãy đổi AHA_ADMIN_PASSWORD trong .env trước khi chạy production.");
});

process.on("SIGINT", () => {
  backupManager.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  backupManager.stop();
  process.exit(0);
});
