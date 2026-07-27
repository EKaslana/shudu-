const test = require("node:test");
const assert = require("node:assert/strict");
const { createMiniAuth } = require("../miniprogram/utils/auth");

function createWxStub(options = {}) {
  return {
    login({ success, fail }) {
      if (options.loginError) {
        fail(options.loginError);
        return;
      }
      success({ code: options.code || "wx-code-demo" });
    },
    request({ success, fail }) {
      if (options.requestError) {
        fail(options.requestError);
        return;
      }
      success(options.response || {
        statusCode: 201,
        data: {
          ok: true,
          player: {
            mode: "wechat",
            label: "微信用户",
            openid: "openid-demo",
            sessionToken: "token-demo",
            expiresAt: "2026-07-28T00:00:00.000Z"
          }
        }
      });
    }
  };
}

function createSessionStub() {
  let player = null;
  return {
    readPlayer() {
      return player;
    },
    writePlayer(nextPlayer) {
      player = nextPlayer;
    }
  };
}

test("mini auth stores player after successful wechat login", async () => {
  const session = createSessionStub();
  const auth = createMiniAuth({
    wxApi: createWxStub(),
    session
  });

  const player = await auth.loginWithWechat();
  assert.equal(player.mode, "wechat");
  assert.equal(player.openid, "openid-demo");
  assert.equal(session.readPlayer().sessionToken, "token-demo");
});

test("mini auth maps missing backend config into visible message", async () => {
  const auth = createMiniAuth({
    wxApi: createWxStub({
      response: {
        statusCode: 503,
        data: {
          ok: false,
          code: "AUTH_NOT_CONFIGURED",
          error: "wechat auth is not configured"
        }
      }
    }),
    session: createSessionStub()
  });

  await assert.rejects(
    auth.loginWithWechat(),
    /服务端还没配置微信登录环境/
  );
});
