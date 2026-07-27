const LOCAL_API_BASE_URL = "http://127.0.0.1:3000";
const PRODUCTION_API_BASE_URL = "https://shudu-node.onrender.com";

function pickOverride() {
  if (typeof GameGlobal !== "undefined" && GameGlobal && typeof GameGlobal.__SUDOKU_API_BASE_URL__ === "string") {
    return GameGlobal.__SUDOKU_API_BASE_URL__.trim();
  }
  return "";
}

function resolveApiBaseUrl(wxApi = wx) {
  const override = pickOverride();
  if (override) {
    return override.replace(/\/+$/, "");
  }

  try {
    const system = wxApi.getSystemInfoSync();
    if (system && system.platform === "devtools") {
      return LOCAL_API_BASE_URL;
    }
  } catch (error) {
    // Fall back to the production domain when system info is unavailable.
  }

  return PRODUCTION_API_BASE_URL;
}

function getRuntimeConfig(wxApi = wx) {
  return {
    localApiBaseUrl: LOCAL_API_BASE_URL,
    productionApiBaseUrl: PRODUCTION_API_BASE_URL,
    apiBaseUrl: resolveApiBaseUrl(wxApi)
  };
}

module.exports = {
  getRuntimeConfig,
  LOCAL_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl
};
