const WECHAT_LOGIN_URL = "https://api.weixin.qq.com/sns/jscode2session";

function createError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createWechatAuthService(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const appId = typeof options.appId === "string" ? options.appId : process.env.WECHAT_MINIAPP_APP_ID || "";
  const appSecret = typeof options.appSecret === "string" ? options.appSecret : process.env.WECHAT_MINIAPP_APP_SECRET || "";

  return {
    isConfigured() {
      return Boolean(fetchImpl && appId && appSecret);
    },
    async exchangeCode(code) {
      if (!code || typeof code !== "string") {
        throw createError("wechat code is required", 400, "WECHAT_CODE_REQUIRED");
      }
      if (!fetchImpl || !appId || !appSecret) {
        throw createError("wechat auth is not configured", 503, "AUTH_NOT_CONFIGURED");
      }

      const url = new URL(WECHAT_LOGIN_URL);
      url.searchParams.set("appid", appId);
      url.searchParams.set("secret", appSecret);
      url.searchParams.set("js_code", code);
      url.searchParams.set("grant_type", "authorization_code");

      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: {
            accept: "application/json"
          }
        });
      } catch (error) {
        throw createError("unable to reach wechat auth service", 502, "WECHAT_UPSTREAM_UNREACHABLE");
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        throw createError("wechat auth returned invalid payload", 502, "WECHAT_INVALID_PAYLOAD");
      }

      if (!response.ok) {
        throw createError("wechat auth request failed", 502, "WECHAT_UPSTREAM_FAILED");
      }

      if (payload.errcode) {
        const status = payload.errcode === 40029 ? 401 : payload.errcode === 45011 ? 429 : 502;
        const error = createError(payload.errmsg || "wechat auth rejected this code", status, "WECHAT_EXCHANGE_FAILED");
        error.details = payload;
        throw error;
      }

      if (!payload.openid || !payload.session_key) {
        throw createError("wechat auth payload is incomplete", 502, "WECHAT_PAYLOAD_INCOMPLETE");
      }

      return {
        openid: payload.openid,
        unionid: payload.unionid || "",
        sessionKey: payload.session_key
      };
    }
  };
}

module.exports = {
  createWechatAuthService
};
