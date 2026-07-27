const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameStore } = require("../miniprogram/game/game-store");
const engine9 = require("../miniprogram/shared/sudoku9-engine");
const engine4 = require("../miniprogram/shared/sudoku4-engine");

function engineFor(version) {
  return version === "4x4" ? engine4 : engine9;
}

function createSessionStub(options = {}) {
  const archives = {
    "9x9": options.archives?.["9x9"] || options.archive || null,
    "4x4": options.archives?.["4x4"] || null
  };
  let guideSeen = Boolean(options.guideSeen);
  const difficulties = {
    "9x9": options.difficulties?.["9x9"] || options.difficulty || "normal",
    "4x4": options.difficulties?.["4x4"] || "normal"
  };
  const stats = {
    "9x9": options.stats?.["9x9"] || null,
    "4x4": options.stats?.["4x4"] || null
  };
  let lastVersion = options.lastVersion || "9x9";
  let player = Object.prototype.hasOwnProperty.call(options, "player")
    ? options.player
    : { mode: "guest", label: "游客" };
  return {
    clearArchive(version) {
      archives[version] = null;
    },
    readArchive(version) {
      return archives[version];
    },
    readGuideSeen() {
      return guideSeen;
    },
    readStats(version) {
      return stats[version];
    },
    readPlayer() {
      return player;
    },
    readLastVersion() {
      return lastVersion;
    },
    readLastDifficulty(version) {
      return difficulties[version];
    },
    writeArchive(version, state, now) {
      const engine = engineFor(version);
      archives[version] = {
        version: 1,
        gameVersion: version,
        difficulty: state.difficulty,
        puzzle: state.puzzle.slice(),
        solution: state.solution.slice(),
        current: state.current.slice(),
        given: state.given.slice(),
        notes: state.notes.map((items) => items.slice()),
        selectedIndex: state.selectedIndex,
        mistakes: state.mistakes,
        paused: state.paused,
        gameEnded: state.gameEnded,
        won: state.won,
        elapsedMs: engine.getElapsedMs(state, now),
        undoStack: state.undoStack.map((entry) => ({
          current: entry.current.slice(),
          notes: entry.notes.map((items) => items.slice()),
          selectedIndex: entry.selectedIndex,
          mistakes: entry.mistakes
        })),
        lastMessage: state.lastMessage,
        lastMessageTone: state.lastMessageTone
      };
      difficulties[version] = state.difficulty;
      lastVersion = version;
      return archives[version];
    },
    writeStats(version, next) {
      stats[version] = next;
    },
    writePlayer(next) {
      player = next;
    },
    writeGuideSeen() {
      guideSeen = true;
    },
    writeLastVersion(version) {
      lastVersion = version;
    },
    writeLastDifficulty(version, next) {
      difficulties[version] = next;
    }
  };
}

function createEndedArchive({ won, version = "9x9" }) {
  const engine = engineFor(version);
  const state = engine.createNewGame({
    difficulty: "normal",
    now: 1000
  });
  state.elapsedMs = 93000;
  state.timerStartedAt = null;
  state.gameEnded = true;
  state.paused = false;
  state.won = won;
  state.mistakes = won ? 1 : state.maxMistakes;
  state.lastMessage = won ? "完成。" : "失败。";
  state.lastMessageTone = won ? "success" : "error";
  if (won) {
    state.current = state.solution.slice();
  }
  return engine.saveArchive(state, state.elapsedMs);
}

function createActiveArchive({ mistakes = 0, elapsedMs = 42000, version = "9x9" } = {}) {
  const engine = engineFor(version);
  const state = engine.createNewGame({
    difficulty: "normal",
    now: 1000
  });
  state.elapsedMs = elapsedMs;
  state.timerStartedAt = null;
  state.mistakes = mistakes;
  state.lastMessage = "进行中。";
  state.lastMessageTone = "info";
  return engine.saveArchive(state, elapsedMs);
}

function createNearWinArchive({ version = "4x4", mistakes = 0, elapsedMs = 12000 } = {}) {
  const engine = engineFor(version);
  const state = engine.createNewGame({
    difficulty: "normal",
    now: 1000
  });
  state.current = state.solution.slice();
  state.puzzle = state.solution.slice();
  state.given = Array(state.solution.length).fill(true);
  state.current[0] = 0;
  state.puzzle[0] = 0;
  state.given[0] = false;
  state.selectedIndex = 0;
  state.mistakes = mistakes;
  state.elapsedMs = elapsedMs;
  state.timerStartedAt = null;
  state.lastMessage = "进行中。";
  state.lastMessageTone = "info";
  return engine.saveArchive(state, elapsedMs);
}

function findConflictingMove(archive, gridSize) {
  const current = archive.current;
  const solution = archive.solution;

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== 0) {
      continue;
    }
    const rowStart = Math.floor(index / gridSize) * gridSize;
    for (let offset = 0; offset < gridSize; offset += 1) {
      const candidate = current[rowStart + offset];
      if (candidate && candidate !== solution[index]) {
        return { index, number: candidate };
      }
    }
  }

  throw new Error("no conflicting move found");
}

test("game store boots into entry scene when no player profile exists", () => {
  const store = createGameStore({
    now: () => 1000,
    session: createSessionStub({
      player: null
    })
  });
  store.boot();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "entry");
  assert.equal(snapshot.entry.actions.length, 2);
  assert.match(snapshot.entry.status, /先选择进入方式/);
});

test("game store guest entry moves into 9x9 home scene", () => {
  const store = createGameStore({
    now: () => 1000,
    session: createSessionStub({
      player: null
    })
  });
  store.boot();
  store.enterAsGuest();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "home");
  assert.equal(snapshot.home.selectedVersion, "9x9");
  assert.equal(snapshot.home.selectedDifficulty, "normal");
  assert.equal(snapshot.home.hasArchive, false);
});

test("game store keeps entry scene and shows placeholder for wechat login", () => {
  const store = createGameStore({
    now: () => 1000,
    session: createSessionStub({
      player: null
    })
  });
  store.boot();
  const started = store.beginWechatLogin();
  let snapshot = store.getSnapshot();
  assert.equal(started, true);
  assert.equal(snapshot.scene, "entry");
  assert.equal(snapshot.entry.busy, true);
  assert.match(snapshot.entry.status, /正在拉起微信登录/);

  const result = store.failWechatLogin("服务端还没配置微信登录环境。");
  snapshot = store.getSnapshot();
  assert.equal(result, false);
  assert.equal(snapshot.entry.busy, false);
  assert.match(snapshot.entry.status, /服务端还没配置微信登录环境/);
});

test("game store completes wechat login and enters home scene", () => {
  const store = createGameStore({
    now: () => 1000,
    session: createSessionStub({
      player: null
    })
  });
  store.boot();
  store.beginWechatLogin();
  store.completeWechatLogin({
    mode: "wechat",
    label: "微信用户",
    openid: "openid-demo",
    sessionToken: "token-demo",
    expiresAt: "2026-07-28T00:00:00.000Z"
  });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "home");
  assert.match(snapshot.home.status, /已使用微信身份进入/);
});

test("game store can switch to 4x4 on the home scene", () => {
  const store = createGameStore({
    now: () => 1200,
    session: createSessionStub({
      archives: {
        "4x4": createActiveArchive({ version: "4x4", mistakes: 1 })
      }
    })
  });
  store.boot();
  store.selectVersion("4x4");
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.home.selectedVersion, "4x4");
  assert.equal(snapshot.home.hasArchive, true);
  assert.equal(snapshot.home.quickStats[0].value, "普通");
});

test("game store starts a new 4x4 game and returns game snapshot", () => {
  const store = createGameStore({
    now: () => 2000,
    session: createSessionStub()
  });
  store.boot();
  store.selectVersion("4x4");
  store.selectDifficulty("hard");
  store.startNewGame();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "game");
  assert.equal(snapshot.game.gameVersion, "4x4");
  assert.equal(snapshot.game.difficulty, "hard");
  assert.equal(snapshot.game.boardCells.length, 16);
  assert.equal(snapshot.game.mistakesLabel, "0/5");
});

test("game store can return home after performing game actions", () => {
  let clock = 3000;
  const store = createGameStore({
    now: () => clock,
    session: createSessionStub()
  });
  store.boot();
  store.startNewGame("easy");
  clock += 500;
  store.performAction("note");
  store.performAction("home");
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "home");
  assert.match(snapshot.home.status, /返回首页/);
});

test("game store can toggle home stats panel", () => {
  const store = createGameStore({
    now: () => 3200,
    session: createSessionStub()
  });
  store.boot();
  store.toggleStats();
  let snapshot = store.getSnapshot();
  assert.equal(snapshot.home.showStats, true);
  assert.equal(snapshot.home.showGuide, false);
  assert.equal(snapshot.home.quickStats.length, 3);
  assert.equal(snapshot.home.statsPanel.summary.length, 4);

  store.toggleStats();
  snapshot = store.getSnapshot();
  assert.equal(snapshot.home.showStats, false);
});

test("game store records started games into local stats", () => {
  const session = createSessionStub();
  const store = createGameStore({
    now: () => 3400,
    session
  });
  store.boot();
  store.selectVersion("4x4");
  store.startNewGame("hard");

  const stats = session.readStats("4x4");
  assert.equal(stats.started, 1);
  assert.equal(stats.difficulties.hard.started, 1);
});

test("game store hides continue entry for finished archive", () => {
  const store = createGameStore({
    now: () => 5000,
    session: createSessionStub({
      archive: createEndedArchive({ won: true, version: "9x9" })
    })
  });
  store.boot();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.home.hasArchive, false);
  assert.match(snapshot.home.status, /已完成|再来一局/);
});

test("game store refuses to continue a finished archive", () => {
  const store = createGameStore({
    now: () => 5000,
    session: createSessionStub({
      archive: createEndedArchive({ won: false, version: "9x9" })
    })
  });
  store.boot();
  const resumed = store.continueGame();
  const snapshot = store.getSnapshot();
  assert.equal(resumed, false);
  assert.equal(snapshot.scene, "home");
  assert.match(snapshot.home.status, /已经结束|开始新局/);
});

test("game store load keeps current mistakes when reading older 9x9 archive", () => {
  const archive = createActiveArchive({ mistakes: 1, elapsedMs: 65000, version: "9x9" });
  const session = createSessionStub({
    archive
  });
  const store = createGameStore({
    now: () => 8000,
    session
  });
  store.boot();
  store.continueGame();
  const move = findConflictingMove(archive, 9);
  store.selectCell(move.index);
  store.tapNumber(move.number);
  store.performAction("load");
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.scene, "game");
  assert.equal(snapshot.game.mistakesLabel, "2/3");
  assert.match(snapshot.game.lastMessage, /恢复盘面与用时/);
});

test("game store save keeps current mistakes in 4x4 archive", () => {
  const session = createSessionStub({
    archives: {
      "4x4": createActiveArchive({ version: "4x4", mistakes: 2, elapsedMs: 65000 })
    },
    lastVersion: "4x4"
  });
  const store = createGameStore({
    now: () => 9000,
    session
  });
  store.boot();
  store.selectVersion("4x4");
  store.continueGame();
  store.performAction("save");
  const savedArchive = session.readArchive("4x4");
  const snapshot = store.getSnapshot();
  assert.equal(savedArchive.mistakes, 2);
  assert.equal(savedArchive.gameVersion, "4x4");
  assert.match(snapshot.game.lastMessage, /已存档/);
});

test("game store can continue a saved 4x4 archive", () => {
  const session = createSessionStub({
    archives: {
      "4x4": createActiveArchive({ version: "4x4", mistakes: 1, elapsedMs: 20000 })
    },
    lastVersion: "4x4"
  });
  const store = createGameStore({
    now: () => 9200,
    session
  });
  store.boot();
  const resumed = store.continueGame();
  const snapshot = store.getSnapshot();
  assert.equal(resumed, true);
  assert.equal(snapshot.game.gameVersion, "4x4");
  assert.equal(snapshot.game.boardCells.length, 16);
  assert.equal(snapshot.game.mistakesLabel, "1/5");
});

test("game store records a completed 4x4 win into local stats", () => {
  const archive = createNearWinArchive({ version: "4x4", mistakes: 1, elapsedMs: 18000 });
  const session = createSessionStub({
    archives: {
      "4x4": archive
    },
    lastVersion: "4x4"
  });
  const store = createGameStore({
    now: () => 9600,
    session
  });
  store.boot();
  store.continueGame();
  store.tapNumber(archive.solution[0]);

  const snapshot = store.getSnapshot();
  const stats = session.readStats("4x4");
  assert.equal(snapshot.game.gameEnded, true);
  assert.equal(stats.finished, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.difficulties.normal.wins, 1);
});

test("game store can open stats overlay from a finished game", () => {
  const archive = createNearWinArchive({ version: "4x4", mistakes: 1, elapsedMs: 18000 });
  const session = createSessionStub({
    archives: {
      "4x4": archive
    },
    lastVersion: "4x4"
  });
  const store = createGameStore({
    now: () => 9650,
    session
  });
  store.boot();
  store.continueGame();
  store.tapNumber(archive.solution[0]);
  store.performAction("stats");

  let snapshot = store.getSnapshot();
  assert.equal(snapshot.game.gameEnded, true);
  assert.equal(snapshot.game.showStats, true);
  assert.equal(snapshot.game.statsPanel.summary.length, 4);

  store.performAction("stats");
  snapshot = store.getSnapshot();
  assert.equal(snapshot.game.showStats, false);
});

test("game store shows in-game guide overlay and can close it", () => {
  const store = createGameStore({
    now: () => 9500,
    session: createSessionStub()
  });
  store.boot();
  store.startNewGame("normal");

  let snapshot = store.getSnapshot();
  assert.ok(snapshot.game.actions.some((item) => item.key === "guide"));
  assert.equal(snapshot.game.showGuide, false);

  store.performAction("guide");
  snapshot = store.getSnapshot();
  assert.equal(snapshot.game.showGuide, true);
  assert.ok(snapshot.game.guideItems.length >= 8);

  store.performAction("guide");
  snapshot = store.getSnapshot();
  assert.equal(snapshot.game.showGuide, false);
});

test("game store closes in-game guide before other actions continue", () => {
  const store = createGameStore({
    now: () => 9800,
    session: createSessionStub()
  });
  store.boot();
  store.startNewGame("normal");
  store.performAction("guide");
  store.performAction("pause");

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.game.showGuide, false);
  assert.equal(snapshot.game.paused, true);
});
