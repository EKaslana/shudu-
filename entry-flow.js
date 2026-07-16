(function () {
  const contextKey = "sudoku-player-context-v1";
  const currentScript = document.currentScript;
  const page = currentScript?.dataset.page || document.body.dataset.page || "";

  function readContext() {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const value = JSON.parse(storage.getItem(contextKey) || "null");
        if (value && typeof value === "object") return value;
      } catch (error) {
        // Try the next browser storage option.
      }
    }
    return null;
  }

  function writeContext(nextContext) {
    const value = JSON.stringify({
      mode: nextContext.mode || "guest",
      label: nextContext.label || "游客",
      version: nextContext.version || ""
    });

    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.setItem(contextKey, value);
        return;
      } catch (error) {
        // Try the next browser storage option.
      }
    }
  }

  function clearContext() {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.removeItem(contextKey);
      } catch (error) {
        // Ignore unavailable browser storage.
      }
    }
  }

  function setupLogin() {
    const guestButton = document.getElementById("guestEntry");
    const wechatButton = document.getElementById("wechatEntry");
    const status = document.getElementById("loginStatus");

    clearContext();

    guestButton?.addEventListener("click", function () {
      writeContext({ mode: "guest", label: "游客", version: "" });
      window.location.assign("/choose-version");
    });

    wechatButton?.addEventListener("click", function () {
      status.textContent = "微信登录需要先配置 CloudBase 环境和微信 AppID。当前不会创建假账号，可先使用游客模式体验。";
      status.focus();
    });
  }

  function setupVersionSelect() {
    const context = readContext();
    if (!context?.mode) {
      window.location.replace("/login");
      return;
    }

    const modeLabel = document.getElementById("currentMode");
    if (modeLabel) {
      modeLabel.textContent = context.mode === "guest" ? "游客模式" : context.label || "已登录";
    }

    document.querySelectorAll("[data-version]").forEach(function (card) {
      card.addEventListener("click", function () {
        const version = card.dataset.version;
        writeContext({
          mode: context.mode,
          label: context.label,
          version: version
        });
        window.location.assign(version === "4x4" ? "/play/4x4" : "/play/9x9");
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.click();
        }
      });
    });
  }

  function setupGame() {
    let context = readContext();
    if (!context?.mode) {
      context = { mode: "guest", label: "游客", version: currentScript?.dataset.version || "" };
      writeContext(context);
    }

    const mode = context.mode === "guest" ? "游客模式" : context.label || "已登录";
    const nav = document.createElement("nav");
    const modeLabel = document.createElement("span");
    const versionLink = document.createElement("a");
    const exitLink = document.createElement("a");

    nav.className = "sudoku-entry-nav";
    nav.setAttribute("aria-label", "玩家与版本导航");
    modeLabel.className = "sudoku-entry-mode";
    modeLabel.textContent = mode;
    versionLink.href = "/choose-version";
    versionLink.textContent = "切换版本";
    exitLink.href = "/login";
    exitLink.textContent = "退出";
    nav.append(modeLabel, versionLink, exitLink);
    document.body.append(nav);
  }

  if (page === "login") setupLogin();
  if (page === "version-select") setupVersionSelect();
  if (page === "game") setupGame();
})();
