const path = require("node:path");
const express = require("express");
const { createStore, classifySource, normalizeGameVersion, normalizeSourceLabel } = require("./analytics-store");
const { createAuthSessionStore } = require("./auth-session-store");
const { createWechatAuthService } = require("./wechat-auth");

function getClientIp(req) {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0];
  }
  return req.ip || req.socket.remoteAddress || "";
}

function readSessionToken(req) {
  const header = req.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const explicitHeader = req.get("x-session-token");
  if (typeof explicitHeader === "string" && explicitHeader.trim()) {
    return explicitHeader.trim();
  }
  return "";
}

function createApp(options = {}) {
  const app = express();
  const port = Number(options.port || process.env.PORT) || 3000;
  const rootDir = options.rootDir || path.join(__dirname, "..");
  const analyticsStore = options.analyticsStore || createStore();
  const ownsAnalyticsStore = !options.analyticsStore;
  const authSessionStore = options.authSessionStore || createAuthSessionStore(options.authSessionOptions);
  const wechatAuth = options.wechatAuth || createWechatAuthService(options.wechatAuthOptions);

  app.set("trust proxy", true);
  app.use(express.json({ limit: "32kb" }));

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.post("/api/track", (req, res) => {
    const visitorId = typeof req.body?.visitor_id === "string" ? req.body.visitor_id.trim() : "";
    const requestPath = typeof req.body?.path === "string" ? req.body.path.trim() : req.path;
    const referrer = typeof req.body?.referrer === "string" ? req.body.referrer.trim() : req.get("referer") || "";
    const explicitChannel =
      normalizeSourceLabel(req.body?.channel) ||
      normalizeSourceLabel(req.body?.source_channel);
    const sourceChannel = explicitChannel || classifySource(referrer);

    if (!visitorId) {
      return res.status(400).json({ error: "visitor_id is required" });
    }

    const result = analyticsStore.recordVisit({
      visitorId,
      gameVersion: normalizeGameVersion(req.body?.game_version, requestPath || "/"),
      path: requestPath || "/",
      referrer,
      sourceChannel,
      userAgent: req.get("user-agent") || "",
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({
      ok: true,
      visit_id: result.id,
      game_version: result.gameVersion,
      source_channel: result.sourceChannel,
      created_at: result.createdAt
    });
  });

  app.get("/api/stats", (req, res) => {
    const stats = analyticsStore.getStats({
      version: typeof req.query.version === "string" ? req.query.version : ""
    });
    return res.json({
      ok: true,
      version: stats.version,
      uv: stats.totals.uv,
      today_uv: stats.totals.todayUv,
      total_pv: stats.totals.pv,
      trend: stats.trend,
      sources: stats.sources,
      stats
    });
  });

  app.post("/api/auth/wechat/login", async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code) {
      return res.status(400).json({
        ok: false,
        error: "code is required",
        code: "WECHAT_CODE_REQUIRED"
      });
    }

    try {
      const exchange = await wechatAuth.exchangeCode(code);
      const session = authSessionStore.createSession({
        openid: exchange.openid,
        unionid: exchange.unionid,
        label: "微信用户"
      });
      return res.status(201).json({
        ok: true,
        session_token: session.token,
        expires_at: session.expiresAt,
        player: {
          ...session.player,
          sessionToken: session.token,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      const status = Number(error.status) || 500;
      return res.status(status).json({
        ok: false,
        error: error.message || "wechat auth failed",
        code: error.code || "WECHAT_AUTH_FAILED",
        details: error.details || null
      });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const token = readSessionToken(req);
    const session = authSessionStore.readSession(token);
    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "session is invalid or expired",
        code: "AUTH_SESSION_INVALID"
      });
    }
    return res.json({
      ok: true,
      player: {
        ...session.player,
        sessionToken: session.token,
        expiresAt: session.expiresAt
      }
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = readSessionToken(req);
    if (token) {
      authSessionStore.revokeSession(token);
    }
    return res.status(204).end();
  });

  app.get("/", (req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
  });

  app.get("/login", (req, res) => {
    res.sendFile(path.join(rootDir, "login.html"));
  });

  app.get("/choose-version", (req, res) => {
    res.sendFile(path.join(rootDir, "choose-version.html"));
  });

  app.get("/play/9x9", (req, res) => {
    res.sendFile(path.join(rootDir, "play", "9x9", "index.html"));
  });

  app.get("/play/4x4", (req, res) => {
    res.sendFile(path.join(rootDir, "play", "4x4", "index.html"));
  });

  app.use(express.static(rootDir, { extensions: ["html"] }));

  app.get("*", (req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
  });

  return {
    app,
    port,
    analyticsStore,
    closeStores() {
      if (ownsAnalyticsStore && typeof analyticsStore.close === "function") {
        analyticsStore.close();
      }
    }
  };
}

function startServer(options = {}) {
  const created = createApp(options);
  const server = created.app.listen(created.port, () => {
    console.log(`Sudoku server listening on http://127.0.0.1:${created.port}`);
    if (created.analyticsStore && created.analyticsStore.dbPath) {
      console.log(`SQLite path: ${created.analyticsStore.dbPath}`);
    }
  });

  return {
    ...created,
    server,
    close(callback) {
      server.close(() => {
        created.closeStores();
        if (typeof callback === "function") {
          callback();
        }
      });
    }
  };
}

if (require.main === module) {
  const running = startServer();

  function shutdown(signal) {
    running.close(() => {
      console.log(`Received ${signal}, server closed.`);
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = {
  createApp,
  startServer
};
