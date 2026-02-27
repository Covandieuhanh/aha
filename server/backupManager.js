const fs = require("fs");
const path = require("path");

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizePath(value, fallbackValue) {
  const source = String(value || fallbackValue || "").trim();
  if (!source) return "";
  return source.replace(/^\/+/, "").replace(/\/+$/, "");
}

function encodeGitHubPath(filePath) {
  return String(filePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeReason(reason) {
  return String(reason || "manual")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "manual";
}

function formatTimestampForFile(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date();
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

function getNextDailyRun(now, hour, minute) {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function createBackupManager(options = {}) {
  const dataFile = path.resolve(String(options.dataFile || ""));
  if (!dataFile) {
    throw new Error("Thiếu đường dẫn tệp dữ liệu để sao lưu.");
  }

  const logger = options.logger && typeof options.logger === "object" ? options.logger : console;

  const localBackupDirDefault = path.join(path.dirname(dataFile), "backups");
  const requestedEnabled = parseBoolean(process.env.AHA_BACKUP_ENABLED, true);
  const localEnabled = parseBoolean(process.env.AHA_BACKUP_LOCAL_ENABLED, true);
  const localBackupDir = path.resolve(process.env.AHA_BACKUP_LOCAL_DIR || localBackupDirDefault);
  const dailyHour = Math.min(Math.max(parseInteger(process.env.AHA_BACKUP_DAILY_HOUR, 2), 0), 23);
  const dailyMinute = Math.min(Math.max(parseInteger(process.env.AHA_BACKUP_DAILY_MINUTE, 0), 0), 59);
  const changeDebounceMs = Math.max(parseInteger(process.env.AHA_BACKUP_IMMEDIATE_DEBOUNCE_MS, 5000), 0);
  const minIntervalMs = Math.max(parseInteger(process.env.AHA_BACKUP_MIN_INTERVAL_MS, 15000), 0);
  const runOnStart = parseBoolean(process.env.AHA_BACKUP_RUN_ON_START, true);
  const historyOnChange = parseBoolean(process.env.AHA_BACKUP_HISTORY_ON_CHANGE, false);

  const githubToken = String(process.env.AHA_BACKUP_GITHUB_TOKEN || "").trim();
  const githubOwner = String(process.env.AHA_BACKUP_GITHUB_OWNER || "").trim();
  const githubRepo = String(process.env.AHA_BACKUP_GITHUB_REPO || "").trim();
  const githubBranch = String(process.env.AHA_BACKUP_GITHUB_BRANCH || "main").trim() || "main";
  const githubLatestPath = normalizePath(process.env.AHA_BACKUP_GITHUB_LATEST_PATH, "backups/latest/store.json");
  const githubHistoryDir = normalizePath(process.env.AHA_BACKUP_GITHUB_HISTORY_DIR, "backups/history");
  const githubEnabled = Boolean(githubToken && githubOwner && githubRepo && githubLatestPath && githubHistoryDir);

  const status = {
    enabled: requestedEnabled && (localEnabled || githubEnabled),
    running: false,
    lastRunAt: "",
    lastSuccessAt: "",
    lastError: "",
    lastReason: "",
    nextScheduledAt: "",
  };

  if (requestedEnabled && !status.enabled) {
    status.lastError =
      "Sao lưu đang tắt vì chưa có nơi lưu hợp lệ. Hãy bật lưu cục bộ hoặc cấu hình GitHub đầy đủ.";
  }

  const publicConfig = {
    localEnabled,
    localBackupDir,
    githubEnabled,
    githubOwner,
    githubRepo,
    githubBranch,
    githubLatestPath,
    githubHistoryDir,
    dailyHour,
    dailyMinute,
    changeDebounceMs,
    minIntervalMs,
    runOnStart,
    historyOnChange,
  };

  let started = false;
  let dailyTimer = null;
  let changeTimer = null;
  let queuedWhileRunning = false;
  let queuedReason = "";
  let queuedMeta = null;
  let lastChangeRunAtMs = 0;

  function getStatus() {
    return {
      ...status,
      targets: {
        local: localEnabled,
        github: githubEnabled,
      },
      config: { ...publicConfig },
    };
  }

  function clearDailyTimer() {
    if (dailyTimer) {
      clearTimeout(dailyTimer);
      dailyTimer = null;
    }
  }

  function clearChangeTimer() {
    if (changeTimer) {
      clearTimeout(changeTimer);
      changeTimer = null;
    }
  }

  function scheduleNextDailyRun() {
    clearDailyTimer();
    if (!status.enabled) return;

    const now = new Date();
    const next = getNextDailyRun(now, dailyHour, dailyMinute);
    status.nextScheduledAt = next.toISOString();

    const delay = Math.max(next.getTime() - now.getTime(), 1000);
    dailyTimer = setTimeout(() => {
      void runBackup("daily").finally(() => {
        scheduleNextDailyRun();
      });
    }, delay);

    if (typeof dailyTimer.unref === "function") {
      dailyTimer.unref();
    }
  }

  function ensureBackupDirectory() {
    fs.mkdirSync(localBackupDir, { recursive: true });
  }

  function readDataSnapshot() {
    if (!fs.existsSync(dataFile)) {
      throw new Error(`Không tìm thấy tệp dữ liệu ${dataFile}`);
    }

    return fs.readFileSync(dataFile, "utf8");
  }

  function buildHistoryFilename(backupAt, reason) {
    const stamp = formatTimestampForFile(backupAt);
    const reasonKey = normalizeReason(reason);
    return `store-${stamp}-${reasonKey}.json`;
  }

  function writeLocalBackup(snapshot, reason, backupAt) {
    if (!localEnabled) return;

    ensureBackupDirectory();

    const latestFile = path.join(localBackupDir, "store-latest.json");
    fs.writeFileSync(latestFile, snapshot, "utf8");

    const shouldWriteHistory = reason !== "data-change" || historyOnChange;
    if (shouldWriteHistory) {
      const historyFile = path.join(localBackupDir, buildHistoryFilename(backupAt, reason));
      fs.writeFileSync(historyFile, snapshot, "utf8");
    }
  }

  function getGitHubHeaders(includeJson = false) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": "aha-backup-service",
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
    };
  }

  async function getGitHubFileSha(filePath) {
    const encodedPath = encodeGitHubPath(filePath);
    const ref = encodeURIComponent(githubBranch);
    const endpoint = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${encodedPath}?ref=${ref}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: getGitHubHeaders(false),
    });

    if (response.status === 404) return "";

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Không đọc được tệp sao lưu trên GitHub (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = await response.json();
    return typeof payload?.sha === "string" ? payload.sha : "";
  }

  async function upsertGitHubFile(filePath, snapshot, message) {
    if (!githubEnabled) return;
    if (typeof fetch !== "function") {
      throw new Error("Môi trường chạy chưa hỗ trợ gửi dữ liệu sao lưu lên GitHub.");
    }

    const sha = await getGitHubFileSha(filePath);
    const encodedPath = encodeGitHubPath(filePath);
    const endpoint = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${encodedPath}`;

    const payload = {
      message,
      content: Buffer.from(snapshot, "utf8").toString("base64"),
      branch: githubBranch,
    };

    if (sha) {
      payload.sha = sha;
    }

    const response = await fetch(endpoint, {
      method: "PUT",
      headers: getGitHubHeaders(true),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Không ghi được tệp sao lưu lên GitHub (${response.status}): ${body.slice(0, 200)}`);
    }
  }

  async function writeGitHubBackup(snapshot, reason, backupAt) {
    if (!githubEnabled) return;

    const backupAtIso = backupAt.toISOString();
    const normalizedReason = normalizeReason(reason);

    await upsertGitHubFile(
      githubLatestPath,
      snapshot,
      `[AHA backup] Cập nhật dữ liệu mới nhất ${backupAtIso} (${normalizedReason})`,
    );

    const shouldWriteHistory = reason !== "data-change" || historyOnChange;
    if (!shouldWriteHistory) return;

    const historyPath = `${githubHistoryDir}/${buildHistoryFilename(backupAt, reason)}`;
    await upsertGitHubFile(
      historyPath,
      snapshot,
      `[AHA backup] Lưu lịch sử dữ liệu ${backupAtIso} (${normalizedReason})`,
    );
  }

  async function runBackup(reason = "manual", meta = null) {
    if (!status.enabled) {
      return getStatus();
    }

    if (status.running) {
      queuedWhileRunning = true;
      queuedReason = reason || "manual";
      queuedMeta = meta || null;
      return getStatus();
    }

    status.running = true;
    status.lastRunAt = new Date().toISOString();
    status.lastReason = String(reason || "manual");

    try {
      const backupAt = new Date();
      const snapshot = readDataSnapshot();

      writeLocalBackup(snapshot, reason, backupAt);
      await writeGitHubBackup(snapshot, reason, backupAt);

      status.lastSuccessAt = backupAt.toISOString();
      status.lastError = "";
    } catch (error) {
      status.lastError = error?.message || "Không thể sao lưu dữ liệu.";
      if (typeof logger?.error === "function") {
        logger.error("[AHA] Backup failed:", error);
      }
    } finally {
      status.running = false;
    }

    if (queuedWhileRunning) {
      const nextReason = queuedReason || "data-change";
      const nextMeta = queuedMeta;
      queuedWhileRunning = false;
      queuedReason = "";
      queuedMeta = null;
      queueMicrotask(() => {
        void runBackup(nextReason, nextMeta);
      });
    }

    return getStatus();
  }

  function notifyDataChanged(meta = null) {
    if (!status.enabled) return;

    clearChangeTimer();

    const nowMs = Date.now();
    const elapsed = nowMs - lastChangeRunAtMs;
    const waitByMinInterval = elapsed >= minIntervalMs ? 0 : minIntervalMs - elapsed;
    const waitMs = Math.max(changeDebounceMs, waitByMinInterval);

    changeTimer = setTimeout(() => {
      lastChangeRunAtMs = Date.now();
      void runBackup("data-change", meta);
    }, waitMs);

    if (typeof changeTimer.unref === "function") {
      changeTimer.unref();
    }
  }

  function start() {
    if (started) return getStatus();
    started = true;

    if (!status.enabled) {
      return getStatus();
    }

    scheduleNextDailyRun();

    if (runOnStart) {
      void runBackup("startup");
    }

    if (typeof logger?.info === "function") {
      logger.info(
        `[AHA] Backup manager started. local=${localEnabled ? "on" : "off"} github=${githubEnabled ? "on" : "off"}`,
      );
    }

    return getStatus();
  }

  function stop() {
    started = false;
    clearDailyTimer();
    clearChangeTimer();
  }

  async function requestRun(reason = "manual") {
    return runBackup(reason, null);
  }

  return {
    start,
    stop,
    getStatus,
    notifyDataChanged,
    requestRun,
  };
}

module.exports = {
  createBackupManager,
};
