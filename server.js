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
  upsertPushSubscription,
  getPushSubscriptionsForUser,
  removePushSubscriptionByEndpoint,
  clearPushSubscriptions,
} = require("./server/dataStore");
const { createBackupManager } = require("./server/backupManager");
const fs = require("fs");
const crypto = require("crypto");

const ROOT_DIR = __dirname;

const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret";
const COOKIE_NAME = "aha_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const VAPID_SUBJECT = (process.env.AHA_VAPID_SUBJECT || "mailto:admin@example.com").trim().replace(/^"+|"+$/g, "");
const VAPID_FILE = path.join(__dirname, "data", "vapid.json");

let webPush = null;
try {
  // Lazy require so local dev không bị crash nếu chưa cài (Railway sẽ cài đủ).
  webPush = require("web-push");
} catch (error) {
  console.warn("[AHA] web-push chưa được cài. Hãy chạy `npm install` trước khi gửi thông báo.");
}

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
app.use("/icons", express.static(path.join(ROOT_DIR, "icons"), { maxAge: "7d" }));

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

app.get("/manifest.webmanifest", (_req, res) => {
  res.type("application/manifest+json");
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(ROOT_DIR, "manifest.webmanifest"));
});

app.get("/sw.js", (_req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(ROOT_DIR, "sw.js"));
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

    // Gửi push cho người giới thiệu nếu có
    const referrerId = payload?.referral?.referrerId;
    if (referrerId) {
      const actor = req.user?.fullName || "Hệ thống AHA";
      const amount = payload?.referral?.commission || 0;
      const amountLabel = typeof amount === "number" && amount > 0 ? formatMoneyVnd(amount) : "";
      const staffName = findUserById(referrerId)?.fullName || "Nhân viên";

      void sendPushToUser(referrerId, {
        title: "AHA",
        body: `Ghi nhận giao dịch dịch vụ hoa hồng giới thiệu: ${amountLabel} cho ${staffName}. (${actor})`,
        url: "/#reports",
        icon: "/icons/icon-192.png",
      });
    }
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

app.get("/api/push/public-key", requireAuth, (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post("/api/push/subscribe", requireAuth, (req, res) => {
  try {
    const subscription = req.body?.subscription;
    const stored = upsertPushSubscription(req.user.id, subscription, req.headers["user-agent"]);
    res.status(201).json({ ok: true, subscription: stored });
  } catch (error) {
    sendApiError(res, error, "Không thể lưu đăng ký thông báo.");
  }
});

app.post("/api/push/subscribe/clear-all", requireAuth, (_req, res) => {
  try {
    clearPushSubscriptions();
    res.json({ ok: true });
  } catch (error) {
    sendApiError(res, error, "Không thể xoá toàn bộ đăng ký push.");
  }
});

app.post("/api/push/test", requireAuth, async (req, res) => {
  try {
    const subs = getPushSubscriptionsForUser(req.user.id);
    if (subs.length === 0) {
      res.status(400).json({ message: "Bạn chưa đăng ký nhận thông báo trên thiết bị này." });
      return;
    }

    const results = [];
    for (const sub of subs) {
      try {
        const result = await sendPushPing(sub);
        if (!result.ok && result.status === 410) {
          removePushSubscriptionByEndpoint(sub.endpoint);
        } else if (!result.ok && result.status === 400) {
          // VAPID mismatch với endpoint cũ, xoá để client đăng ký lại
          removePushSubscriptionByEndpoint(sub.endpoint);
        }
        results.push({ endpoint: sub.endpoint, status: result.status, ok: result.ok, message: result.message });
      } catch (error) {
        results.push({ endpoint: sub.endpoint, status: 500, ok: false, error: error?.message });
      }
    }

    console.log("[AHA] push test", {
      userId: req.user.id,
      results,
    });

    res.json({ ok: true, results });
  } catch (error) {
    sendApiError(res, error, "Không thể gửi thông báo thử.");
  }
});

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

// --- Web Push helpers ----------------------------------------------------
function toBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function loadOrCreateVapidKeys() {
  const envPublic = process.env.AHA_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.AHA_VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    const publicKey = envPublic.trim().replace(/^"+|"+$/g, "");
    const privateRaw = envPrivate.trim().replace(/^"+|"+$/g, "").replace(/\\n/g, "\n");
    const { privateKey, privatePem } = normalizePrivateKey(privateRaw);
    if (privateKey) {
      return { publicKey, privatePem: privatePem || "", privateKey, subject: VAPID_SUBJECT };
    }
    console.warn("[AHA] AHA_VAPID_PRIVATE_KEY không hợp lệ, sẽ tạo khoá mới.");
  }

  if (fs.existsSync(VAPID_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
      if (saved?.publicKey && saved?.privatePem) {
        const privateKey = saved.privateKey || extractPrivateKeyBase64Url(saved.privatePem);
        if (isValidPrivateKey(privateKey)) {
          return {
            publicKey: saved.publicKey,
            privatePem: saved.privatePem,
            privateKey,
            subject: saved.subject || VAPID_SUBJECT,
          };
        }
      }
    } catch (error) {
      console.warn("[AHA] Không đọc được vapid.json, sẽ tạo khoá mới.");
    }
  }

  return createAndPersistVapidPair();
}

function createAndPersistVapidPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const rawPublic = Buffer.concat([Buffer.from([0x04]), fromBase64Url(publicJwk.x), fromBase64Url(publicJwk.y)]);
  const publicKeyBase64Url = toBase64Url(rawPublic);
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
  const privateKeyBase64Url = extractPrivateKeyBase64Url(privatePem);

  fs.mkdirSync(path.dirname(VAPID_FILE), { recursive: true });
  fs.writeFileSync(
    VAPID_FILE,
    JSON.stringify(
      { publicKey: publicKeyBase64Url, privatePem, privateKey: privateKeyBase64Url, subject: VAPID_SUBJECT },
      null,
      2,
    ),
    "utf8",
  );

  console.log("[AHA] Đã tạo VAPID keypair mới và lưu vào data/vapid.json");
  return { publicKey: publicKeyBase64Url, privatePem, privateKey: privateKeyBase64Url, subject: VAPID_SUBJECT };
}

let vapidKeys = loadOrCreateVapidKeys();
if (webPush) {
  // web-push yêu cầu subject phải là mailto:... hoặc https://...
  const subject = vapidKeys.subject?.startsWith("mailto:") || vapidKeys.subject?.startsWith("http")
    ? vapidKeys.subject
    : `mailto:${vapidKeys.subject || "admin@example.com"}`;
  try {
    webPush.setVapidDetails(subject, vapidKeys.publicKey, vapidKeys.privateKey);
  } catch (error) {
    console.warn("[AHA] VAPID hiện tại không hợp lệ, tạo khoá mới. Lỗi:", error?.message);
    vapidKeys = createAndPersistVapidPair();
    const nextSubject = vapidKeys.subject?.startsWith("mailto:") || vapidKeys.subject?.startsWith("http")
      ? vapidKeys.subject
      : `mailto:${vapidKeys.subject || "admin@example.com"}`;
    webPush.setVapidDetails(nextSubject, vapidKeys.publicKey, vapidKeys.privateKey);
  }
}

function extractPrivateKeyBase64Url(privatePem) {
  const jwk = crypto.createPrivateKey(privatePem).export({ format: "jwk" });
  const d = jwk?.d || "";
  return d.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function normalizePrivateKey(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { privateKey: null, privatePem: null };

  if (trimmed.includes("BEGIN")) {
    const privatePem = trimmed;
    const privateKey = extractPrivateKeyBase64Url(privatePem);
    return isValidPrivateKey(privateKey) ? { privateKey, privatePem } : { privateKey: null, privatePem: null };
  }

  const base64url = trimmed.replace(/\\s+/g, "").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  return isValidPrivateKey(base64url) ? { privateKey: base64url, privatePem: null } : { privateKey: null, privatePem: null };
}

function isValidPrivateKey(base64url) {
  try {
    const buf = Buffer.from(base64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return buf.length === 32;
  } catch (error) {
    return false;
  }
}

function signVapidToken(audience) {
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12h
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toBase64Url(Buffer.from(JSON.stringify({ aud: audience, exp, sub: vapidKeys.subject })));
  const data = `${header}.${payload}`;

  const signer = crypto.createSign("SHA256");
  signer.update(data);
  const signature = toBase64Url(signer.sign(vapidKeys.privatePem));
  return `${data}.${signature}`;
}

function formatMoneyVnd(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("vi-VN") + " đ";
}

async function sendPushPing(subscription) {
  if (!webPush) {
    return { ok: false, status: 500, message: "web-push package chưa được cài." };
  }

  try {
    const response = await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: "AHA",
        body: "Thông báo thử từ AHA.",
        url: "/",
        icon: "/icons/icon-192.png",
      }),
      { TTL: 3600 },
    );

    return { ok: true, status: response.statusCode || response.status, message: "sent" };
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    return { ok: false, status, message: error?.body || error?.message || "send failed" };
  }
}

async function sendPushToUser(userId, notification) {
  if (!webPush) return [];
  const subs = getPushSubscriptionsForUser(userId);
  const results = [];

  for (const sub of subs) {
    try {
      const response = await webPush.sendNotification(sub, JSON.stringify(notification), { TTL: 3600 });
      results.push({ endpoint: sub.endpoint, ok: true, status: response.statusCode || response.status });
    } catch (error) {
      const status = error?.statusCode || error?.status || 500;
      if (status === 410 || status === 404 || status === 400) {
        removePushSubscriptionByEndpoint(sub.endpoint);
      }
      results.push({ endpoint: sub.endpoint, ok: false, status, message: error?.body || error?.message });
    }
  }

  return results;
}

process.on("SIGTERM", () => {
  backupManager.stop();
  process.exit(0);
});
