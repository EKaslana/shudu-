const path = require("node:path");
const express = require("express");
const { createStore, classifySource, normalizeGameVersion, normalizeSourceLabel } = require("./analytics-store");

const app = express();
const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const store = createStore();

app.set("trust proxy", true);
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function getClientIp(req) {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0];
  }
  return req.ip || req.socket.remoteAddress || "";
}

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

  const result = store.recordVisit({
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
  const stats = store.getStats({
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

app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

const server = app.listen(port, () => {
  console.log(`Sudoku server listening on http://127.0.0.1:${port}`);
  console.log(`SQLite path: ${store.dbPath}`);
});

function shutdown(signal) {
  server.close(() => {
    store.close();
    console.log(`Received ${signal}, server closed.`);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
