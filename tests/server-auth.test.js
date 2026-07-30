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

function createCloudStoreStub() {
  const byOpenid = new Map();
  const emptyState = {
    archives: { "9x9": null, "4x4": null, "16x16": null, "25x25": null },
    stats: { "9x9": null, "4x4": null, "16x16": null, "25x25": null },
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
  return {
    readState(openid) {
      return {
        state: byOpenid.get(openid) || emptyState,
        updatedAt: byOpenid.has(openid) ? "2026-07-27T00:00:00.000Z" : ""
      };
    },
    writeState(openid, state) {
      byOpenid.set(openid, state);
      return {
        state,
        updatedAt: "2026-07-27T00:00:00.000Z"
      };
    },
    close() {}
  };
}

async function withServer(handler, options = {}) {
  const created = createApp({
    analyticsStore: createAnalyticsStub(),
    authSessionStore: options.authSessionStore || createAuthSessionStore({
      now: () => Date.parse("2026-07-27T00:00:00.000Z"),
      ttlDays: 14,
      dbPath: ":memory:"
    }),
    playerCloudStore: options.playerCloudStore || createCloudStoreStub(),
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

test("cloud state endpoints read and write player cloud data", async () => {
  await withServer(async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/wechat/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        code: "wx-cloud-demo"
      })
    });
    const loginPayload = await loginResponse.json();
    const token = loginPayload.session_token;

    const writeResponse = await fetch(`${baseUrl}/api/cloud/state`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        cloud_state: {
          archives: {
            "9x9": { gameVersion: "9x9", difficulty: "normal" },
            "4x4": null,
            "16x16": { gameVersion: "16x16", difficulty: "easy" },
            "25x25": null
          },
          stats: {
            "9x9": { started: 2 },
            "4x4": null,
            "16x16": { started: 1 },
            "25x25": null
          },
          settings: {
            inkFxEnabled: false,
            clickFxEnabled: true,
            soundEnabled: true
          },
          rewards: {
            hintBalance: 6,
            dailyClaimCount: 2,
            lastDailyClaimDate: "2026-07-27",
            videoRewardCount: 1
          },
          lastVersion: "9x9",
          lastDifficultyByVersion: {
            "9x9": "hard",
            "4x4": "normal",
            "16x16": "easy",
            "25x25": "normal"
          }
        }
      })
    });
    const writePayload = await writeResponse.json();
    assert.equal(writeResponse.status, 200);
    assert.equal(writePayload.cloud_state.settings.soundEnabled, true);
    assert.equal(writePayload.cloud_state.rewards.hintBalance, 6);

    const readResponse = await fetch(`${baseUrl}/api/cloud/bootstrap`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const readPayload = await readResponse.json();
    assert.equal(readResponse.status, 200);
    assert.equal(readPayload.cloud_state.archives["9x9"].difficulty, "normal");
    assert.equal(readPayload.cloud_state.lastDifficultyByVersion["9x9"], "hard");
    assert.equal(readPayload.cloud_state.archives["16x16"].difficulty, "easy");
    assert.equal(readPayload.cloud_state.rewards.hintBalance, 6);
    assert.equal(readPayload.cloud_state.rewards.videoRewardCount, 1);
  }, {
    wechatAuth: {
      async exchangeCode(code) {
        assert.equal(code, "wx-cloud-demo");
        return {
          openid: "openid-demo",
          unionid: "unionid-demo"
        };
      }
    }
  });
});

test("web routes expose 16x16 and 25x25 pages", async () => {
  await withServer(async (baseUrl) => {
    const paths = [
      { url: "/play/16x16", keyword: "16x16" },
      { url: "/play/25x25", keyword: "25x25" }
    ];

    for (const item of paths) {
      const response = await fetch(baseUrl + item.url);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, new RegExp(item.keyword));
    }
  });
});
