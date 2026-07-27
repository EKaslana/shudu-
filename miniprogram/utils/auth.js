const session = require("./game-session");
const { resolveApiBaseUrl } = require("./runtime-config");

function normalizePlayer(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  if (raw.mode !== "wechat") {
    return null;
  }
  return {
    mode: "wechat",
    label: typeof raw.label === "string" && raw.label ? raw.label : "微信用户",
    nickname: typeof raw.nickname === "string" ? raw.nickname : "",
    openid: typeof raw.openid === "string" ? raw.openid : "",
    unionid: typeof raw.unionid === "string" ? raw.unionid : "",
    sessionToken: typeof raw.sessionToken === "string" ? raw.sessionToken : "",
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : ""
  };
}

function createVisibleError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createMiniAuth(options = {}) {
  const wxApi = options.wxApi || wx;
  const sessionStore = options.session || session;
  const apiBaseUrl = (options.apiBaseUrl || resolveApiBaseUrl(wxApi)).replace(/\/+$/, "");

  function runWxLogin() {
    return new Promise((resolve, reject) => {
      wxApi.login({
        success(result) {
          if (result && result.code) {
            resolve(result.code);
            return;
          }
          reject(createVisibleError("微信没有返回可用登录凭证，请稍后再试。", "WX_LOGIN_NO_CODE"));
        },
        fail(error) {
          reject(createVisibleError("未能拉起微信登录，请确认开发者工具或微信环境可用。", "WX_LOGIN_FAILED"));
        }
      });
    });
  }

  function runRequest(url, data, method = "POST") {
    return new Promise((resolve, reject) => {
      wxApi.request({
        url,
        method,
        data,
        timeout: 8000,
        header: {
          "content-type": "application/json"
        },
        success(result) {
          resolve(result);
        },
        fail(error) {
          reject(createVisibleError(`当前无法连接登录服务。请确认 ${apiBaseUrl} 可访问，并在开发者工具里允许该域名调试。`, "WX_REQUEST_FAILED"));
        }
      });
    });
  }

  function mapServerError(statusCode, payload) {
    if (statusCode === 401) {
      return createVisibleError("这次微信登录凭证已失效，请重新点一次微信登录。", payload?.code || "WECHAT_LOGIN_RETRY");
    }
    if (statusCode === 429) {
      return createVisibleError("微信登录请求过于频繁，请稍等片刻再试。", payload?.code || "WECHAT_LOGIN_RATE_LIMIT");
    }
    if (statusCode === 503) {
      return createVisibleError("服务端还没配置微信登录环境。先用游客模式体验，后面补上 AppID 和密钥后就能直接登录。", payload?.code || "AUTH_NOT_CONFIGURED");
    }
    return createVisibleError(payload?.error || "微信登录暂时不可用，请稍后再试。", payload?.code || "WECHAT_LOGIN_FAILED");
  }

  return {
    async loginWithWechat() {
      const code = await runWxLogin();
      const result = await runRequest(`${apiBaseUrl}/api/auth/wechat/login`, { code });
      const payload = result?.data && typeof result.data === "object" ? result.data : {};
      if (result.statusCode < 200 || result.statusCode >= 300 || !payload.ok) {
        throw mapServerError(result.statusCode, payload);
      }
      const player = normalizePlayer(payload.player);
      if (!player) {
        throw createVisibleError("登录服务返回了不完整的用户信息。", "WECHAT_PLAYER_INVALID");
      }
      sessionStore.writePlayer(player);
      return player;
    }
  };
}

module.exports = {
  createMiniAuth
};
