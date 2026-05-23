const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "visits.db");

function ensureDbDirectory() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDay(date = new Date()) {
  const local = startOfDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function classifySource(referrer) {
  if (!referrer) return "direct";

  const value = referrer.toLowerCase();
  const rules = [
    { channel: "search", keywords: ["google.", "bing.", "baidu.", "duckduckgo.", "yahoo.", "so.com", "sogou."] },
    { channel: "social", keywords: ["weibo.", "xiaohongshu.", "xhslink.", "douyin.", "tiktok.", "twitter.", "x.com", "facebook.", "instagram.", "linkedin."] },
    { channel: "community", keywords: ["github.", "gitlab.", "stackoverflow.", "juejin.", "zhihu."] }
  ];

  const matched = rules.find((rule) => rule.keywords.some((keyword) => value.includes(keyword)));
  return matched ? matched.channel : "referral";
}

function normalizeSourceLabel(input) {
  if (typeof input !== "string") return "";
  const normalized = input.trim();
  return normalized.slice(0, 120);
}

function normalizeGameVersion(input, requestPath = "") {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (["4x4", "4*4", "4"].includes(value)) return "4x4";
  if (["9x9", "9*9", "9"].includes(value)) return "9x9";
  return requestPath.startsWith("/shudu4") ? "4x4" : "9x9";
}

function createStore() {
  ensureDbDirectory();

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS visit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      request_path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      source_channel TEXT NOT NULL,
      game_version TEXT NOT NULL DEFAULT '9x9',
      created_at TEXT NOT NULL,
      visit_day TEXT NOT NULL
    );

    PRAGMA user_version = 1;
  `);

  const columns = db.prepare(`PRAGMA table_info(visit_logs)`).all();
  if (!columns.some((column) => column.name === "game_version")) {
    db.exec(`ALTER TABLE visit_logs ADD COLUMN game_version TEXT NOT NULL DEFAULT '9x9'`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_visit_logs_created_at ON visit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_visit_logs_visit_day ON visit_logs(visit_day);
    CREATE INDEX IF NOT EXISTS idx_visit_logs_visitor_id ON visit_logs(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_visit_logs_source_channel ON visit_logs(source_channel);
    CREATE INDEX IF NOT EXISTS idx_visit_logs_game_version ON visit_logs(game_version);
  `);

  const insertVisit = db.prepare(`
    INSERT INTO visit_logs (
      visitor_id,
      request_path,
      referrer,
      user_agent,
      ip_address,
      source_channel,
      game_version,
      created_at,
      visit_day
    ) VALUES (
      @visitor_id,
      @request_path,
      @referrer,
      @user_agent,
      @ip_address,
      @source_channel,
      @game_version,
      @created_at,
      @visit_day
    )
  `);

  const totalPvStmt = db.prepare(`SELECT COUNT(*) AS count FROM visit_logs WHERE game_version = ?`);
  const totalUvStmt = db.prepare(`SELECT COUNT(DISTINCT visitor_id) AS count FROM visit_logs WHERE game_version = ?`);
  const todayUvStmt = db.prepare(`
    SELECT COUNT(DISTINCT visitor_id) AS count
    FROM visit_logs
    WHERE game_version = ? AND visit_day = ?
  `);
  const trendStmt = db.prepare(`
    SELECT visit_day, COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv
    FROM visit_logs
    WHERE game_version = ? AND visit_day BETWEEN ? AND ?
    GROUP BY visit_day
    ORDER BY visit_day ASC
  `);
  const sourcesStmt = db.prepare(`
    SELECT source_channel AS channel, COUNT(*) AS visits
    FROM visit_logs
    WHERE game_version = ?
    GROUP BY source_channel
    ORDER BY visits DESC, channel ASC
  `);

  return {
    dbPath: DB_PATH,
    recordVisit(entry) {
      const createdAt = new Date().toISOString();
      const normalizedSource = normalizeSourceLabel(entry.sourceChannel) || classifySource(entry.referrer);
      const normalizedVersion = normalizeGameVersion(entry.gameVersion, entry.path);
      const payload = {
        visitor_id: entry.visitorId,
        request_path: entry.path,
        referrer: entry.referrer || "",
        user_agent: entry.userAgent || "",
        ip_address: entry.ipAddress || "",
        source_channel: normalizedSource,
        game_version: normalizedVersion,
        created_at: createdAt,
        visit_day: formatDay(new Date(createdAt))
      };

      const info = insertVisit.run(payload);

      return {
        id: info.lastInsertRowid,
        createdAt,
        sourceChannel: payload.source_channel,
        gameVersion: payload.game_version
      };
    },
    getStats(options = {}) {
      const now = options.now || new Date();
      const version = normalizeGameVersion(options.version);
      const today = formatDay(now);
      const windowStart = new Date(startOfDay(now));
      windowStart.setDate(windowStart.getDate() - 6);
      const fromDay = formatDay(windowStart);
      const trendRows = trendStmt.all(version, fromDay, today);
      const trendMap = new Map(trendRows.map((row) => [row.visit_day, row]));
      const trend = [];

      for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(windowStart);
        day.setDate(windowStart.getDate() + offset);
        const dayKey = formatDay(day);
        const row = trendMap.get(dayKey);
        trend.push({
          date: dayKey,
          pv: row ? row.pv : 0,
          uv: row ? row.uv : 0
        });
      }

      return {
        version,
        totals: {
          uv: totalUvStmt.get(version).count,
          todayUv: todayUvStmt.get(version, today).count,
          pv: totalPvStmt.get(version).count
        },
        trend,
        sources: sourcesStmt.all(version)
      };
    },
    close() {
      db.close();
    }
  };
}

module.exports = {
  DB_PATH,
  classifySource,
  normalizeGameVersion,
  normalizeSourceLabel,
  createStore
};
