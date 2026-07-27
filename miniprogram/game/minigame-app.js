const session = require("../utils/game-session");
const { createMiniAuth } = require("../utils/auth");
const { createGameStore } = require("./game-store");
const { Renderer } = require("./renderer");

const ASSET_SOURCES = {
  landscape: "assets/ink-landscape.jpg",
  titleInk: "assets/title-shudu-ink.png"
};

function resolveCanvas(wxApi) {
  if (typeof canvas !== "undefined" && canvas && typeof canvas.getContext === "function") {
    return canvas;
  }
  if (typeof wxApi.createCanvas === "function") {
    return wxApi.createCanvas();
  }
  if (typeof GameGlobal !== "undefined" && GameGlobal.canvas) {
    return GameGlobal.canvas;
  }
  throw new Error("Mini game canvas is unavailable");
}

function createAssetImage(canvasLike, wxApi) {
  if (canvasLike && typeof canvasLike.createImage === "function") {
    return canvasLike.createImage();
  }
  if (wxApi && typeof wxApi.createImage === "function") {
    return wxApi.createImage();
  }
  return null;
}

function loadAssetImages(canvasLike, wxApi) {
  return Promise.all(
    Object.entries(ASSET_SOURCES).map(([key, src]) => new Promise((resolve) => {
      const image = createAssetImage(canvasLike, wxApi);
      if (!image) {
        resolve([key, null]);
        return;
      }
      image.onload = () => resolve([key, image]);
      image.onerror = () => resolve([key, null]);
      image.src = src;
    }))
  ).then((entries) => Object.fromEntries(entries));
}

function createMiniGameApp(options = {}) {
  const wxApi = options.wxApi || wx;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const auth = options.auth || createMiniAuth({
    wxApi,
    session
  });
  const system = wxApi.getSystemInfoSync();
  const pixelRatio = system.pixelRatio || 1;
  const viewport = {
    width: system.windowWidth,
    height: system.windowHeight
  };

  const mainCanvas = resolveCanvas(wxApi);
  mainCanvas.width = viewport.width * pixelRatio;
  mainCanvas.height = viewport.height * pixelRatio;
  const ctx = mainCanvas.getContext("2d");

  const store = createGameStore({
    now,
    session
  });
  const renderer = new Renderer({
    canvas: mainCanvas,
    ctx,
    pixelRatio,
    width: viewport.width,
    height: viewport.height,
    assets: {}
  });

  let frameTimer = null;

  function render() {
    renderer.render(store.getSnapshot());
  }

  function startLoop() {
    if (frameTimer) {
      return;
    }
    frameTimer = setInterval(render, 100);
  }

  function stopLoop() {
    if (!frameTimer) {
      return;
    }
    clearInterval(frameTimer);
    frameTimer = null;
  }

  async function handleTap(x, y) {
    const hit = renderer.hitTest(x, y);
    if (!hit) {
      return;
    }

    if (hit.type === "entry-action") {
      if (hit.value === "guest") {
        store.enterAsGuest();
      } else if (hit.value === "wechat") {
        if (store.beginWechatLogin()) {
          render();
          try {
            const player = await auth.loginWithWechat();
            store.completeWechatLogin(player);
          } catch (error) {
            store.failWechatLogin(error?.message || "微信登录暂时不可用，请稍后再试。");
          }
        }
      }
    } else if (hit.type === "difficulty") {
      store.selectDifficulty(hit.value);
    } else if (hit.type === "version") {
      store.selectVersion(hit.value);
    } else if (hit.type === "home-action") {
      if (hit.value === "start") {
        store.startNewGame();
      } else if (hit.value === "continue") {
        store.continueGame();
      } else if (hit.value === "guide") {
        store.toggleGuide();
      } else if (hit.value === "stats") {
        store.toggleStats();
      }
    } else if (hit.type === "cell") {
      store.selectCell(hit.value);
    } else if (hit.type === "number") {
      store.tapNumber(hit.value);
    } else if (hit.type === "action") {
      store.performAction(hit.value);
    }

    render();
  }

  function bindEvents() {
    wxApi.onTouchEnd((event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) {
        return;
      }
      Promise.resolve(handleTap(touch.clientX, touch.clientY)).finally(() => {
        render();
      });
    });

    if (typeof wxApi.onHide === "function") {
      wxApi.onHide(() => {
        store.onHide();
        stopLoop();
      });
    }

    if (typeof wxApi.onShow === "function") {
      wxApi.onShow(() => {
        render();
        startLoop();
      });
    }

    if (typeof wxApi.onWindowResize === "function") {
      wxApi.onWindowResize((event) => {
        viewport.width = event.windowWidth;
        viewport.height = event.windowHeight;
        mainCanvas.width = viewport.width * pixelRatio;
        mainCanvas.height = viewport.height * pixelRatio;
        renderer.setViewport(viewport.width, viewport.height);
        render();
      });
    }
  }

  return {
    boot() {
      store.boot();
      bindEvents();
      render();
      loadAssetImages(mainCanvas, wxApi).then((assets) => {
        renderer.setAssets(assets);
        render();
      });
      startLoop();
    }
  };
}

module.exports = {
  createMiniGameApp
};
