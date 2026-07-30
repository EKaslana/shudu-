const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "visits.db");

function ensureDbDirectory() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function createEmptyState() {
  return {
    archives: {
      "9x9": null,
      "4x4": null,
      "16x16": null,
      "25x25": null
    },
    stats: {
      "9x9": null,
      "4x4": null,
      "16x16": null,
      "25x25": null
    },
    settings: {
      inkFxEnabled: true,
      clickFxEnabled: true,
      soundEnabled: false
    },
    rewards: {
      hintBalance: 3,
      dailyClaimCount: 0,
      lastDailyClaimDate: "",
      videoRewardCount: 0
    },
    lastVersion: "9x9",
    lastDifficultyByVersion: {
      "9x9": "normal",
      "4x4": "normal",
      "16x16": "normal",
      "25x25": "normal"
    }
  };
}

function parseJson(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function createPlayerCloudStore() {
  ensureDbDirectory();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_cloud_state (
      openid TEXT PRIMARY KEY,
      archives_json TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      rewards_json TEXT NOT NULL,
      last_version TEXT NOT NULL DEFAULT '9x9',
      last_difficulty_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(player_cloud_state)").all();
  if (!columns.some((column) => column.name === "rewards_json")) {
    db.exec("ALTER TABLE player_cloud_state ADD COLUMN rewards_json TEXT NOT NULL DEFAULT '{}'");
  }

  const readStmt = db.prepare(`
    SELECT openid, archives_json, stats_json, settings_json, rewards_json, last_version, last_difficulty_json, updated_at
    FROM player_cloud_state
    WHERE openid = ?
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO player_cloud_state (
      openid,
      archives_json,
      stats_json,
      settings_json,
      rewards_json,
      last_version,
      last_difficulty_json,
      updated_at
    ) VALUES (
      @openid,
      @archives_json,
      @stats_json,
      @settings_json,
      @rewards_json,
      @last_version,
      @last_difficulty_json,
      @updated_at
    )
    ON CONFLICT(openid) DO UPDATE SET
      archives_json = excluded.archives_json,
      stats_json = excluded.stats_json,
      settings_json = excluded.settings_json,
      rewards_json = excluded.rewards_json,
      last_version = excluded.last_version,
      last_difficulty_json = excluded.last_difficulty_json,
      updated_at = excluded.updated_at
  `);

  function normalizeState(raw) {
    const base = createEmptyState();
    if (!raw || typeof raw !== "object") {
      return base;
    }
    return {
      archives: {
        ...base.archives,
        ...(raw.archives && typeof raw.archives === "object" ? raw.archives : {})
      },
      stats: {
        ...base.stats,
        ...(raw.stats && typeof raw.stats === "object" ? raw.stats : {})
      },
      settings: {
        ...base.settings,
        ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {})
      },
      rewards: {
        ...base.rewards,
        ...(raw.rewards && typeof raw.rewards === "object" ? raw.rewards : {})
      },
      lastVersion: typeof raw.lastVersion === "string" ? raw.lastVersion : base.lastVersion,
      lastDifficultyByVersion: {
        ...base.lastDifficultyByVersion,
        ...(raw.lastDifficultyByVersion && typeof raw.lastDifficultyByVersion === "object"
          ? raw.lastDifficultyByVersion
          : {})
      }
    };
  }

  function readState(openid) {
    const row = readStmt.get(openid);
    if (!row) {
      return {
        state: createEmptyState(),
        updatedAt: ""
      };
    }
    return {
      state: normalizeState({
        archives: parseJson(row.archives_json, {}),
        stats: parseJson(row.stats_json, {}),
        settings: parseJson(row.settings_json, {}),
        rewards: parseJson(row.rewards_json, {}),
        lastVersion: row.last_version,
        lastDifficultyByVersion: parseJson(row.last_difficulty_json, {})
      }),
      updatedAt: row.updated_at
    };
  }

  function writeState(openid, nextState) {
    const state = normalizeState(nextState);
    const updatedAt = new Date().toISOString();
    upsertStmt.run({
      openid,
      archives_json: JSON.stringify(state.archives),
      stats_json: JSON.stringify(state.stats),
      settings_json: JSON.stringify(state.settings),
      rewards_json: JSON.stringify(state.rewards),
      last_version: state.lastVersion,
      last_difficulty_json: JSON.stringify(state.lastDifficultyByVersion),
      updated_at: updatedAt
    });
    return {
      state,
      updatedAt
    };
  }

  return {
    dbPath: DB_PATH,
    readState,
    writeState,
    close() {
      db.close();
    }
  };
}

module.exports = {
  createPlayerCloudStore,
  createEmptyState
};
