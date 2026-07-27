const engine9 = require("../shared/sudoku9-engine");
const engine4 = require("../shared/sudoku4-engine");

const GUIDE_KEY = "sudoku-mini-guide-seen-v1";
const LAST_VERSION_KEY = "sudoku-mini-last-version-v1";
const PLAYER_KEY = "sudoku-mini-player-v1";

function sanitizeVersion(version) {
  return version === "4x4" ? "4x4" : "9x9";
}

function getEngine(version) {
  return sanitizeVersion(version) === "4x4" ? engine4 : engine9;
}

function saveKey(version) {
  return `sudoku-mini-${sanitizeVersion(version)}-save-v1`;
}

function difficultyKey(version) {
  return `sudoku-mini-${sanitizeVersion(version)}-last-difficulty-v1`;
}

function statsKey(version) {
  return `sudoku-mini-${sanitizeVersion(version)}-stats-v1`;
}

function safeGet(key) {
  try {
    return wx.getStorageSync(key);
  } catch (error) {
    return "";
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function safeRemove(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (error) {
    return false;
  }
}

function readArchive(version = "9x9") {
  const raw = safeGet(saveKey(version));
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function readStats(version = "9x9") {
  const raw = safeGet(statsKey(version));
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function normalizePlayer(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const mode = raw.mode === "wechat" ? "wechat" : raw.mode === "guest" ? "guest" : "";
  if (!mode) {
    return null;
  }
  const normalized = {
    mode,
    label: typeof raw.label === "string" && raw.label
      ? raw.label
      : mode === "wechat"
        ? "微信用户"
        : "游客"
  };
  if (typeof raw.nickname === "string" && raw.nickname) {
    normalized.nickname = raw.nickname;
  }
  if (typeof raw.openid === "string" && raw.openid) {
    normalized.openid = raw.openid;
  }
  if (typeof raw.unionid === "string" && raw.unionid) {
    normalized.unionid = raw.unionid;
  }
  if (typeof raw.sessionToken === "string" && raw.sessionToken) {
    normalized.sessionToken = raw.sessionToken;
  }
  if (typeof raw.expiresAt === "string" && raw.expiresAt) {
    normalized.expiresAt = raw.expiresAt;
  }
  return normalized;
}

function clearPlayer() {
  return safeRemove(PLAYER_KEY);
}

function readPlayer() {
  const raw = safeGet(PLAYER_KEY);
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return normalizePlayer(raw);
  }
  if (typeof raw === "string") {
    try {
      return normalizePlayer(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }
  return null;
}

function writeArchive(version, state, now = Date.now()) {
  const gameVersion = sanitizeVersion(version || state.gameVersion);
  const archive = getEngine(gameVersion).saveArchive(state, now);
  safeSet(saveKey(gameVersion), archive);
  safeSet(difficultyKey(gameVersion), archive.difficulty);
  safeSet(LAST_VERSION_KEY, gameVersion);
  return archive;
}

function clearArchive(version = "9x9") {
  return safeRemove(saveKey(version));
}

function hasArchive(version = "9x9") {
  return Boolean(readArchive(version));
}

function readGuideSeen() {
  return safeGet(GUIDE_KEY) === "1";
}

function writeGuideSeen() {
  return safeSet(GUIDE_KEY, "1");
}

function readLastVersion() {
  return sanitizeVersion(safeGet(LAST_VERSION_KEY));
}

function writeLastVersion(version) {
  return safeSet(LAST_VERSION_KEY, sanitizeVersion(version));
}

function readLastDifficulty(version = "9x9") {
  return getEngine(version).sanitizeDifficulty(safeGet(difficultyKey(version)));
}

function writeLastDifficulty(version, difficulty) {
  return safeSet(difficultyKey(version), getEngine(version).sanitizeDifficulty(difficulty));
}

function writeStats(version, stats) {
  return safeSet(statsKey(version), stats);
}

function writePlayer(player) {
  const nextPlayer = normalizePlayer(player);
  if (!nextPlayer) {
    return false;
  }
  return safeSet(PLAYER_KEY, nextPlayer);
}

module.exports = {
  clearArchive,
  clearPlayer,
  hasArchive,
  readArchive,
  readPlayer,
  readStats,
  readGuideSeen,
  readLastVersion,
  readLastDifficulty,
  writeArchive,
  writePlayer,
  writeGuideSeen,
  writeLastVersion,
  writeLastDifficulty,
  writeStats
};
