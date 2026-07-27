const { randomUUID } = require("node:crypto");

function createAuthSessionStore(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const ttlDays = Math.max(1, Number(options.ttlDays || process.env.AUTH_SESSION_TTL_DAYS || 14));
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  const sessions = new Map();

  function cleanup() {
    const current = now();
    sessions.forEach((session, token) => {
      if (session.expiresAtMs <= current) {
        sessions.delete(token);
      }
    });
  }

  return {
    createSession(player) {
      cleanup();
      const issuedAtMs = now();
      const expiresAtMs = issuedAtMs + ttlMs;
      const token = randomUUID();
      const session = {
        token,
        player: {
          mode: "wechat",
          label: typeof player.label === "string" && player.label ? player.label : "微信用户",
          openid: player.openid,
          unionid: player.unionid || "",
          nickname: typeof player.nickname === "string" && player.nickname ? player.nickname : ""
        },
        issuedAt: new Date(issuedAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
        expiresAtMs
      };
      sessions.set(token, session);
      return session;
    },
    readSession(token) {
      cleanup();
      if (!token || typeof token !== "string") {
        return null;
      }
      return sessions.get(token) || null;
    },
    revokeSession(token) {
      if (!token || typeof token !== "string") {
        return false;
      }
      return sessions.delete(token);
    }
  };
}

module.exports = {
  createAuthSessionStore
};
