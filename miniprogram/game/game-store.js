const engine9 = require("../shared/sudoku9-engine");
const engine4 = require("../shared/sudoku4-engine");

const ENGINES = {
  "9x9": engine9,
  "4x4": engine4
};

const VERSION_CARDS = [
  {
    key: "9x9",
    title: "九宫 · 经典",
    subtitle: "完整棋盘，保留标准数独节奏。"
  },
  {
    key: "4x4",
    title: "四宫 · 轻快",
    subtitle: "更短一局，适合碎片时间上手。"
  }
];

const DIFFICULTY_CARD_MAP = {
  "9x9": [
    {
      key: "easy",
      title: "雅集 · 简单",
      subtitle: "36 个空格，适合先熟悉触控节奏。"
    },
    {
      key: "normal",
      title: "雅集 · 普通",
      subtitle: "46 个空格，作为小游戏的默认主模式。"
    },
    {
      key: "hard",
      title: "雅集 · 困难",
      subtitle: "54 个空格，保留完整挑战感。"
    }
  ],
  "4x4": [
    {
      key: "easy",
      title: "小卷 · 简单",
      subtitle: "5 个空格，适合快速熟悉规则。"
    },
    {
      key: "normal",
      title: "小卷 · 普通",
      subtitle: "8 个空格，作为 4x4 的默认主模式。"
    },
    {
      key: "hard",
      title: "小卷 · 困难",
      subtitle: "11 个空格，保留更明显的推理感。"
    }
  ]
};

const GAME_GUIDE_ITEMS = {
  "9x9": [
    { label: "提示", detail: "为当前空格补出一个正确数字。" },
    { label: "笔记", detail: "切到候选模式，先记可能数字。" },
    { label: "擦除", detail: "清掉当前格的填数或笔记。" },
    { label: "存档", detail: "手动保存当前盘面、时间和错误数。" },
    { label: "读档", detail: "恢复到上次存档，错误数不会减少。" },
    { label: "说明", detail: "打开这份按钮用途说明。" },
    { label: "暂停", detail: "暂停当前对局，再点可继续。" },
    { label: "新局", detail: "按当前难度重新开一盘。" },
    { label: "返回", detail: "回首页；未存档进度不会保留。" }
  ],
  "4x4": [
    { label: "提示", detail: "为当前空格补出一个正确数字。" },
    { label: "笔记", detail: "切到候选模式，先记 1 到 4 的可能值。" },
    { label: "擦除", detail: "清掉当前格的填数或笔记。" },
    { label: "存档", detail: "手动保存当前四宫格盘面、时间和错误数。" },
    { label: "读档", detail: "恢复到上次存档，错误数不会减少。" },
    { label: "说明", detail: "打开这份按钮用途说明。" },
    { label: "暂停", detail: "暂停当前对局，再点可继续。" },
    { label: "新局", detail: "按当前难度重新开一盘。" },
    { label: "返回", detail: "回首页；未存档进度不会保留。" }
  ]
};

function sanitizeVersion(version) {
  return version === "4x4" ? "4x4" : "9x9";
}

function getEngine(version) {
  return ENGINES[sanitizeVersion(version)];
}

function getVersionLabel(version) {
  return sanitizeVersion(version) === "4x4" ? "4x4" : "9x9";
}

function getVersionTitle(version) {
  return sanitizeVersion(version) === "4x4" ? "四宫数独" : "九宫数独";
}

function createEmptyStats(version) {
  const engine = getEngine(version);
  return {
    version: sanitizeVersion(version),
    started: 0,
    finished: 0,
    wins: 0,
    losses: 0,
    totalMistakes: 0,
    totalElapsedMs: 0,
    bestTimeMs: null,
    lastPlayedAt: "",
    lastResult: "",
    lastElapsedMs: 0,
    lastMistakes: 0,
    lastDifficulty: "normal",
    difficulties: Object.fromEntries(
      Object.keys(engine.DIFFICULTIES).map((key) => [
        key,
        {
          started: 0,
          finished: 0,
          wins: 0,
          losses: 0,
          totalMistakes: 0,
          totalElapsedMs: 0,
          bestTimeMs: null
        }
      ])
    )
  };
}

function normalizeStats(version, raw) {
  const engine = getEngine(version);
  const base = createEmptyStats(version);
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const next = {
    ...base,
    started: Math.max(0, Number(raw.started) || 0),
    finished: Math.max(0, Number(raw.finished) || 0),
    wins: Math.max(0, Number(raw.wins) || 0),
    losses: Math.max(0, Number(raw.losses) || 0),
    totalMistakes: Math.max(0, Number(raw.totalMistakes) || 0),
    totalElapsedMs: Math.max(0, Number(raw.totalElapsedMs) || 0),
    bestTimeMs: Number.isFinite(raw.bestTimeMs) ? Math.max(0, raw.bestTimeMs) : null,
    lastPlayedAt: typeof raw.lastPlayedAt === "string" ? raw.lastPlayedAt : "",
    lastResult: raw.lastResult === "win" || raw.lastResult === "lose" ? raw.lastResult : "",
    lastElapsedMs: Math.max(0, Number(raw.lastElapsedMs) || 0),
    lastMistakes: Math.max(0, Number(raw.lastMistakes) || 0),
    lastDifficulty: engine.sanitizeDifficulty(raw.lastDifficulty)
  };

  Object.keys(base.difficulties).forEach((key) => {
    const row = raw.difficulties?.[key] || {};
    next.difficulties[key] = {
      started: Math.max(0, Number(row.started) || 0),
      finished: Math.max(0, Number(row.finished) || 0),
      wins: Math.max(0, Number(row.wins) || 0),
      losses: Math.max(0, Number(row.losses) || 0),
      totalMistakes: Math.max(0, Number(row.totalMistakes) || 0),
      totalElapsedMs: Math.max(0, Number(row.totalElapsedMs) || 0),
      bestTimeMs: Number.isFinite(row.bestTimeMs) ? Math.max(0, row.bestTimeMs) : null
    };
  });

  return next;
}

function buildStatsPanel(version, rawStats) {
  const engine = getEngine(version);
  const stats = normalizeStats(version, rawStats);
  const averageMistakes = stats.finished ? (stats.totalMistakes / stats.finished).toFixed(1) : "--";
  const winRate = stats.finished ? `${Math.round((stats.wins / stats.finished) * 100)}%` : "--";

  return {
    title: `${getVersionLabel(version)} 对局统计`,
    subtitle: "仅统计当前设备上的本地对局记录。",
    empty: stats.started === 0,
    summary: [
      { label: "已开局", value: String(stats.started) },
      { label: "已完成", value: String(stats.finished) },
      { label: "胜率", value: winRate },
      { label: "最佳用时", value: stats.bestTimeMs == null ? "--:--" : engine.formatTime(stats.bestTimeMs) }
    ],
    rows: Object.entries(engine.DIFFICULTIES).map(([key, meta]) => {
      const row = stats.difficulties[key];
      return {
        label: meta.label,
        started: row.started,
        wins: row.wins,
        bestTime: row.bestTimeMs == null ? "--:--" : engine.formatTime(row.bestTimeMs)
      };
    }),
    footer: stats.finished
      ? `平均错误 ${averageMistakes} · 最近一局 ${stats.lastResult === "win" ? "已完成" : "未完成"} · ${stats.lastElapsedMs ? engine.formatTime(stats.lastElapsedMs) : "--:--"}`
      : "先开一局，统计会从第一盘开始累计。"
  };
}

function hasContinueArchive(archive) {
  return Boolean(archive && !archive.gameEnded);
}

function buildHomeStatus(version, archive, fallbackStatus) {
  if (fallbackStatus) {
    return fallbackStatus;
  }
  if (archive) {
    if (archive.gameEnded) {
      return archive.won
        ? "上局已完成，可直接再来一局。"
        : "上局已结束，可直接重新开局。";
    }
    return "检测到上次棋局，可直接继续。";
  }
  return sanitizeVersion(version) === "4x4"
    ? "点击开始新局，进入轻快的 4x4 数独。"
    : "点击开始新局，进入小游戏版数独。";
}

function buildQuickStats(archive, version, difficulty) {
  const engine = getEngine(version);

  if (!archive) {
    return [
      { label: "模式", value: getVersionLabel(version) },
      { label: "默认难度", value: engine.DIFFICULTIES[difficulty].label },
      { label: "存档状态", value: "暂无进行中" }
    ];
  }

  if (archive.gameEnded) {
    return [
      { label: "上局结果", value: archive.won ? "已完成" : "未完成" },
      { label: "结算用时", value: engine.formatTime(archive.elapsedMs || 0) },
      { label: "错误次数", value: `${archive.mistakes || 0}/${engine.MAX_MISTAKES}` }
    ];
  }

  const remainingCount = Array.isArray(archive.current)
    ? archive.current.filter((value) => value === 0).length
    : 0;

  return [
    {
      label: "上次难度",
      value: engine.DIFFICULTIES[engine.sanitizeDifficulty(archive.difficulty)].label
    },
    {
      label: "剩余空格",
      value: String(remainingCount).padStart(2, "0")
    },
    {
      label: "累计用时",
      value: engine.formatTime(archive.elapsedMs || 0)
    }
  ];
}

function buildEntryModel(store) {
  return {
    title: "数独",
    subtitle: "先选择进入方式，再进入 9x9 或 4x4 的水墨棋局。",
    busy: store.entryBusy,
    status: store.entryStatus || "游客模式可直接开始；微信登录会走真实微信身份校验。",
    statusTone: store.entryStatusTone || "info",
    actions: [
      {
        key: "guest",
        title: store.entryBusy ? "请稍候" : "游客进入",
        subtitle: "无需账号，直接开始",
        primary: true,
        disabled: store.entryBusy
      },
      {
        key: "wechat",
        title: store.entryBusy ? "正在登录" : "微信登录",
        subtitle: store.entryBusy ? "正在校验微信身份" : "使用微信身份进入",
        primary: false,
        disabled: store.entryBusy
      }
    ]
  };
}

function buildHomeModel(store) {
  const version = sanitizeVersion(store.selectedVersion);
  const engine = getEngine(version);
  const difficulty = engine.sanitizeDifficulty(store.selectedDifficulty);
  return {
    selectedVersion: version,
    selectedDifficulty: difficulty,
    hasArchive: hasContinueArchive(store.archive),
    showGuide: store.showGuide,
    showStats: store.showStats,
    title: "数独",
    subtitle: `水墨长卷里的 ${getVersionLabel(version)} 数独`,
    versionCards: VERSION_CARDS.map((card) => ({
      ...card,
      active: card.key === version
    })),
    statsPanel: buildStatsPanel(version, store.session.readStats(version)),
    quickStats: buildQuickStats(store.archive, version, difficulty),
    difficultyCards: DIFFICULTY_CARD_MAP[version].map((card) => ({
      ...card,
      active: card.key === difficulty,
      badge: card.key === "normal" ? "推荐" : card.key === "hard" ? "挑战" : "轻松"
    })),
    status: store.homeStatus
  };
}

function buildSettlementModel(viewModel) {
  if (!viewModel.gameEnded) {
    return null;
  }

  return {
    tone: viewModel.won ? "success" : "error",
    title: viewModel.won ? "破局完成" : "本局收卷",
    subtitle: viewModel.won
      ? "这一卷已经落定，可以直接再来一局。"
      : "明错误已满，这一局先收住，重新开局更合适。",
    stats: [
      { label: "模式", value: getVersionLabel(viewModel.gameVersion) },
      { label: "用时", value: viewModel.elapsedLabel },
      { label: "错误", value: viewModel.mistakesLabel }
    ],
    note: viewModel.won
      ? "已自动保留本局结果，想继续的话直接点“再来一局”。"
      : `当前还剩 ${viewModel.remainingCount} 个空格未完成，建议直接重开。`,
    primaryAction: { key: "restart", label: "再来一局" },
    secondaryAction: { key: "home", label: "返回首页" }
  };
}

function buildGameModel(store, nowFn) {
  if (!store.gameState) {
    return null;
  }

  const version = sanitizeVersion(store.gameState.gameVersion);
  const engine = getEngine(version);
  const viewModel = engine.createViewModel(store.gameState, nowFn());
  const selectedValue = store.gameState.current[store.gameState.selectedIndex] || "";

  return {
    ...viewModel,
    versionLabel: getVersionLabel(version),
    versionTitle: getVersionTitle(version),
    selectedCellValue: selectedValue ? String(selectedValue) : "--",
    numberPad: viewModel.numberPad.map((item) => ({
      ...item,
      active: selectedValue !== "" && Number(selectedValue) === item.value
    })),
    showGuide: store.showGameGuide,
    showStats: store.showStats,
    guideItems: GAME_GUIDE_ITEMS[version],
    statsPanel: buildStatsPanel(version, store.session.readStats(version)),
    settlement: buildSettlementModel(viewModel),
    actions: [
      { key: "hint", label: "提示" },
      { key: "note", label: store.gameState.noteMode ? "笔记: 开" : "笔记: 关" },
      { key: "erase", label: "擦除" },
      { key: "save", label: "存档" },
      { key: "load", label: "读档" },
      { key: "guide", label: "说明" },
      { key: "pause", label: store.gameState.paused ? "继续" : "暂停" },
      { key: "restart", label: "新局" },
      { key: "home", label: "返回" }
    ]
  };
}

function createFallbackSession() {
  const archives = {
    "9x9": null,
    "4x4": null
  };
  const stats = {
    "9x9": createEmptyStats("9x9"),
    "4x4": createEmptyStats("4x4")
  };
  let guideSeen = false;
  const difficulties = {
    "9x9": "normal",
    "4x4": "normal"
  };
  let lastVersion = "9x9";
  let player = null;
  return {
    clearArchive(version) {
      archives[sanitizeVersion(version)] = null;
    },
    clearPlayer() {
      player = null;
    },
    readArchive(version) {
      return archives[sanitizeVersion(version)];
    },
    readStats(version) {
      return stats[sanitizeVersion(version)];
    },
    readPlayer() {
      return player;
    },
    readGuideSeen() {
      return guideSeen;
    },
    readLastVersion() {
      return lastVersion;
    },
    readLastDifficulty(version) {
      return difficulties[sanitizeVersion(version)];
    },
    writeArchive(version, state, now) {
      const gameVersion = sanitizeVersion(version || state.gameVersion);
      const engine = getEngine(gameVersion);
      const archive = engine.saveArchive(state, now);
      archives[gameVersion] = archive;
      difficulties[gameVersion] = archive.difficulty;
      lastVersion = gameVersion;
      return archive;
    },
    writeStats(version, nextStats) {
      stats[sanitizeVersion(version)] = nextStats;
    },
    writePlayer(nextPlayer) {
      player = nextPlayer;
    },
    writeGuideSeen() {
      guideSeen = true;
    },
    writeLastVersion(version) {
      lastVersion = sanitizeVersion(version);
    },
    writeLastDifficulty(version, next) {
      difficulties[sanitizeVersion(version)] = getEngine(version).sanitizeDifficulty(next);
    }
  };
}

function createGameStore(options = {}) {
  const session = options.session || createFallbackSession();
  const now = typeof options.now === "function" ? options.now : () => Date.now();

  const store = {
    archive: null,
    entryBusy: false,
    entryStatus: "",
    entryStatusTone: "info",
    gameState: null,
    homeStatus: "点击开始新局，进入小游戏版数独。",
    player: null,
    scene: "entry",
    selectedVersion: "9x9",
    selectedDifficulty: "normal",
    session,
    showGameGuide: false,
    showGuide: false,
    showStats: false
  };

  function persistGameState() {
    if (!store.gameState) {
      return null;
    }
    const version = sanitizeVersion(store.gameState.gameVersion || store.selectedVersion);
    const archive = session.writeArchive(version, store.gameState, now());
    store.archive = archive;
    return archive;
  }

  function readStats(version) {
    return normalizeStats(version, session.readStats(version));
  }

  function writeStats(version, stats) {
    session.writeStats(version, stats);
  }

  function recordStartedGame(version, difficulty) {
    const stats = readStats(version);
    stats.started += 1;
    stats.lastPlayedAt = new Date(now()).toISOString();
    stats.lastDifficulty = difficulty;
    stats.difficulties[difficulty].started += 1;
    writeStats(version, stats);
  }

  function syncSelectionFromSession() {
    store.selectedVersion = sanitizeVersion(
      typeof session.readLastVersion === "function" ? session.readLastVersion() : "9x9"
    );
    store.selectedDifficulty = getEngine(store.selectedVersion).sanitizeDifficulty(
      session.readLastDifficulty(store.selectedVersion)
    );
    store.archive = session.readArchive(store.selectedVersion);
  }

  function enterHome(fallbackStatus) {
    store.scene = "home";
    store.entryBusy = false;
    store.showGuide = !session.readGuideSeen();
    store.showStats = false;
    store.showGameGuide = false;
    store.entryStatus = "";
    store.entryStatusTone = "info";
    store.homeStatus = buildHomeStatus(store.selectedVersion, store.archive, fallbackStatus);
  }

  function recordFinishedGame(version, state) {
    const stats = readStats(version);
    const difficulty = getEngine(version).sanitizeDifficulty(state.difficulty);
    const elapsedMs = Math.max(0, Number(state.elapsedMs) || 0);
    const mistakes = Math.max(0, Number(state.mistakes) || 0);
    stats.finished += 1;
    stats.totalMistakes += mistakes;
    stats.totalElapsedMs += elapsedMs;
    stats.lastPlayedAt = new Date(now()).toISOString();
    stats.lastResult = state.won ? "win" : "lose";
    stats.lastElapsedMs = elapsedMs;
    stats.lastMistakes = mistakes;
    stats.lastDifficulty = difficulty;
    if (state.won) {
      stats.wins += 1;
      if (stats.bestTimeMs == null || elapsedMs < stats.bestTimeMs) {
        stats.bestTimeMs = elapsedMs;
      }
    } else {
      stats.losses += 1;
    }

    const row = stats.difficulties[difficulty];
    row.finished += 1;
    row.totalMistakes += mistakes;
    row.totalElapsedMs += elapsedMs;
    if (state.won) {
      row.wins += 1;
      if (row.bestTimeMs == null || elapsedMs < row.bestTimeMs) {
        row.bestTimeMs = elapsedMs;
      }
    } else {
      row.losses += 1;
    }
    writeStats(version, stats);
  }

  function syncGameEnd(previousState) {
    if (!store.gameState || !store.gameState.gameEnded || previousState?.gameEnded) {
      return;
    }
    const version = sanitizeVersion(store.gameState.gameVersion || store.selectedVersion);
    recordFinishedGame(version, store.gameState);
    const archive = session.writeArchive(version, store.gameState, now());
    store.archive = archive;
  }

  function refreshClock() {
    if (!store.gameState || store.gameState.paused || store.gameState.gameEnded) {
      return;
    }
    store.gameState = {
      ...store.gameState,
      elapsedMs: getEngine(store.gameState.gameVersion).getElapsedMs(store.gameState, now()),
      timerStartedAt: now()
    };
  }

  return {
    boot() {
      syncSelectionFromSession();
      store.player = typeof session.readPlayer === "function" ? session.readPlayer() : null;
      if (store.player) {
        enterHome();
        return;
      }
      store.scene = "entry";
      store.showGuide = false;
      store.showStats = false;
      store.showGameGuide = false;
      store.entryBusy = false;
      store.entryStatus = "先选择进入方式，再进入水墨数独。";
      store.entryStatusTone = "info";
    },
    getSnapshot() {
      return {
        scene: store.scene,
        entry: buildEntryModel(store),
        home: buildHomeModel(store),
        game: buildGameModel(store, now)
      };
    },
    enterAsGuest() {
      if (store.entryBusy) {
        return false;
      }
      store.player = {
        mode: "guest",
        label: "游客"
      };
      if (typeof session.writePlayer === "function") {
        session.writePlayer(store.player);
      }
      syncSelectionFromSession();
      enterHome("已进入游客模式，可直接开始。");
      return true;
    },
    beginWechatLogin() {
      if (store.entryBusy) {
        return false;
      }
      store.scene = "entry";
      store.entryBusy = true;
      store.entryStatus = "正在拉起微信登录，请稍候。";
      store.entryStatusTone = "info";
      return true;
    },
    completeWechatLogin(player) {
      store.player = {
        ...player,
        mode: "wechat",
        label: typeof player?.label === "string" && player.label ? player.label : "微信用户"
      };
      if (typeof session.writePlayer === "function") {
        session.writePlayer(store.player);
      }
      syncSelectionFromSession();
      enterHome("已使用微信身份进入，可直接开始。");
      return true;
    },
    failWechatLogin(message) {
      store.scene = "entry";
      store.entryBusy = false;
      store.entryStatus = message || "微信登录暂时不可用，请稍后再试。";
      store.entryStatusTone = "warning";
      return false;
    },
    selectVersion(version) {
      store.selectedVersion = sanitizeVersion(version);
      session.writeLastVersion(store.selectedVersion);
      store.selectedDifficulty = getEngine(store.selectedVersion).sanitizeDifficulty(
        session.readLastDifficulty(store.selectedVersion)
      );
      store.archive = session.readArchive(store.selectedVersion);
      store.homeStatus = buildHomeStatus(
        store.selectedVersion,
        store.archive,
        `已切换到 ${getVersionTitle(store.selectedVersion)}。`
      );
    },
    selectDifficulty(difficulty) {
      store.selectedDifficulty = getEngine(store.selectedVersion).sanitizeDifficulty(difficulty);
      session.writeLastDifficulty(store.selectedVersion, store.selectedDifficulty);
      store.homeStatus = `已切换到 ${getVersionTitle(store.selectedVersion)} · ${getEngine(store.selectedVersion).DIFFICULTIES[store.selectedDifficulty].label}。`;
    },
    startNewGame(difficulty) {
      const version = sanitizeVersion(store.selectedVersion);
      const engine = getEngine(version);
      const nextDifficulty = engine.sanitizeDifficulty(difficulty || store.selectedDifficulty);
      store.selectedDifficulty = nextDifficulty;
      session.writeLastVersion(version);
      session.writeLastDifficulty(version, nextDifficulty);
      store.gameState = engine.createNewGame({
        difficulty: nextDifficulty,
        now: now()
      });
      recordStartedGame(version, nextDifficulty);
      store.showGameGuide = false;
      store.scene = "game";
      store.homeStatus = version === "4x4"
        ? "已开始 4x4 新局，记得手动存档。"
        : "已开始新局，记得手动存档。";
    },
    continueGame() {
      const version = sanitizeVersion(store.selectedVersion);
      const archive = session.readArchive(version);
      if (!archive) {
        store.homeStatus = "当前没有可继续的棋局。";
        return false;
      }
      if (archive.gameEnded) {
        store.archive = archive;
        store.homeStatus = archive.won ? "上局已经完成，直接开始新局吧。" : "上局已经结束，直接开始新局吧。";
        return false;
      }
      store.archive = archive;
      store.gameState = getEngine(version).restoreGame(archive, { now: now() });
      store.selectedDifficulty = store.gameState.difficulty;
      store.showGameGuide = false;
      store.scene = "game";
      session.writeLastVersion(version);
      return true;
    },
    clearArchive() {
      session.clearArchive(store.selectedVersion);
      store.archive = null;
      store.homeStatus = `已清空 ${getVersionTitle(store.selectedVersion)} 存档。`;
    },
    toggleGuide() {
      store.showGuide = !store.showGuide;
      if (store.showGuide) {
        store.showStats = false;
      }
      if (!store.showGuide) {
        session.writeGuideSeen();
      }
    },
    toggleStats() {
      store.showStats = !store.showStats;
      if (store.showStats) {
        store.showGuide = false;
      }
    },
    selectCell(index) {
      if (!store.gameState) {
        return;
      }
      store.gameState = getEngine(store.gameState.gameVersion).selectCell(store.gameState, index);
    },
    tapNumber(number) {
      if (!store.gameState) {
        return;
      }
      const previousState = store.gameState;
      store.gameState = getEngine(store.gameState.gameVersion).placeNumber(store.gameState, number, now());
      syncGameEnd(previousState);
    },
    performAction(action) {
      if (!store.gameState && action !== "home") {
        return;
      }

      if (action === "guide") {
        store.showGameGuide = !store.showGameGuide;
        if (store.showGameGuide) {
          store.showStats = false;
        }
        return;
      }

      if (action === "stats") {
        store.showStats = !store.showStats;
        if (store.showStats) {
          store.showGuide = false;
          store.showGameGuide = false;
        }
        return;
      }

      if (store.showGameGuide && action !== "home") {
        store.showGameGuide = false;
      }

      const version = sanitizeVersion(store.gameState.gameVersion || store.selectedVersion);
      const engine = getEngine(version);
      const previousState = store.gameState;

      if (action === "hint") {
        store.gameState = engine.giveHint(store.gameState, now());
      } else if (action === "note") {
        store.gameState = engine.toggleNoteMode(store.gameState);
      } else if (action === "erase") {
        store.gameState = engine.eraseSelected(store.gameState);
      } else if (action === "save") {
        const archive = persistGameState();
        if (archive && store.gameState) {
          store.gameState.lastMessage = `已存档：错误 ${archive.mistakes}/${store.gameState.maxMistakes}，用时 ${engine.formatTime(archive.elapsedMs || 0)}。`;
          store.gameState.lastMessageTone = "success";
        }
        return;
      } else if (action === "load") {
        const archive = session.readArchive(version);
        if (!archive) {
          store.gameState.lastMessage = "当前没有可读取的存档。";
          store.gameState.lastMessageTone = "info";
          return;
        }
        const currentMistakes = store.gameState.mistakes;
        store.archive = archive;
        store.gameState = engine.restoreGame(archive, { now: now() });
        store.gameState.mistakes = Math.max(currentMistakes, store.gameState.mistakes);
        store.selectedVersion = version;
        store.selectedDifficulty = store.gameState.difficulty;
        session.writeLastVersion(version);
        store.gameState.lastMessage = `已读档：恢复盘面与用时，当前错误 ${store.gameState.mistakes}/${store.gameState.maxMistakes}。`;
        store.gameState.lastMessageTone = "success";
      } else if (action === "pause") {
        store.gameState = engine.togglePause(store.gameState, now());
      } else if (action === "restart") {
        store.gameState = engine.createNewGame({
          difficulty: store.gameState.difficulty,
          now: now()
        });
        recordStartedGame(version, store.gameState.difficulty);
        store.showGameGuide = false;
      } else if (action === "home") {
        store.scene = "home";
        store.archive = session.readArchive(store.selectedVersion);
        store.homeStatus = store.gameState && store.gameState.gameEnded
          ? (store.gameState.won ? "本局已收卷，可直接再来一局。" : "本局已结束，可重新开局。")
          : "已返回首页；未存档进度不会保留。";
        session.writeGuideSeen();
        store.showGuide = false;
        store.showGameGuide = false;
        store.showStats = false;
        return;
      }
      syncGameEnd(previousState);
    },
    onHide() {
      refreshClock();
    },
    syncClock() {
      refreshClock();
    }
  };
}

module.exports = {
  createGameStore
};
