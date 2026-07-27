const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../server/server");
const { createAuthSessionStore } = require("../server/auth-session-store");

function createAnalyticsStub() {
  return {
    dbPath: ":memory:",
    close() {},
    recordVisit() {
      return {
        id: "visit-1",
        gameVersion: "9x9",
        sourceChannel: "direct",
        createdAt: "2026-07-27T00:00:00.000Z"
      };
    },
    getStats() {
      return {
        version: "9x9",
        totals: {
          uv: 0,
          todayUv: 0,
          pv: 0
        },
        trend: [],
        sources: []
      };
    }
  };
}

async function withServer(handler, options = {}) {
  const created = createApp({
    analyticsStore: createAnalyticsStub(),
    authSessionStore: options.authSessionStore || createAuthSessionStore({
      now: () => Date.parse("2026-07-27T00:00:00.000Z"),
      ttlDays: 14
    }),
    wechatAuth: options.wechatAuth
  });
  const server = created.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://${address.address}:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise((resolve) => {
      server.close(() => {
        created.closeStores();
        resolve();
      });
    });
  }
}

test("wechat auth login issues a session token and returns current player", async () => {
  await withServer(async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/wechat/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        code: "wx-code-demo"
      })
    });
    const loginPayload = await loginResponse.json();
    assert.equal(loginResponse.status, 201);
    assert.equal(loginPayload.ok, true);
    assert.equal(loginPayload.player.mode, "wechat");
    assert.equal(loginPayload.player.openid, "openid-demo");

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        authorization: `Bearer ${loginPayload.session_token}`
      }
    });
    const mePayload = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(mePayload.player.openid, "openid-demo");
  }, {
    wechatAuth: {
      async exchangeCode(code) {
        assert.equal(code, "wx-code-demo");
        return {
          openid: "openid-demo",
          unionid: "unionid-demo"
        };
      }
    }
  });
});

test("wechat auth login returns 503 when backend config is missing", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/wechat/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        code: "wx-code-demo"
      })
    });
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.code, "AUTH_NOT_CONFIGURED");
  }, {
    wechatAuth: {
      async exchangeCode() {
        const error = new Error("wechat auth is not configured");
        error.status = 503;
        error.code = "AUTH_NOT_CONFIGURED";
        throw error;
      }
    }
  });
});
