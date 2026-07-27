const engine = require("../../shared/sudoku9-engine");
const session = require("../../utils/game-session");

function buildStatusCards(viewModel, state) {
  return [
    {
      label: "剩余空格",
      value: String(viewModel.remainingCount).padStart(2, "0")
    },
    {
      label: "当前难度",
      value: viewModel.difficultyLabel
    },
    {
      label: "可撤销",
      value: state.undoStack.length ? String(state.undoStack.length).padStart(2, "0") : "00"
    }
  ];
}

function buildPrimaryActions(state) {
  return [
    { key: "hint", label: "提示", meta: "点亮一格" },
    { key: "note", label: "笔记", meta: state.noteMode ? "已开" : "已关" },
    { key: "erase", label: "擦除", meta: "清空当前格" }
  ];
}

function buildSecondaryActions(state) {
  return [
    { key: "undo", label: "撤销" },
    { key: "pause", label: state.paused ? "继续" : "暂停" },
    { key: "restart", label: "新开一局" },
    { key: "home", label: "回到首页" }
  ];
}

Page({
  data: {
    difficulty: "normal",
    difficultyLabel: "普通",
    elapsedLabel: "00:00",
    mistakes: 0,
    mistakesLimit: engine.MAX_MISTAKES,
    showGuide: false,
    paused: false,
    boardCells: [],
    numberPad: [],
    selectedCellValue: "--",
    noteMode: false,
    gameEnded: false,
    won: false,
    canUndo: false,
    statusCards: [],
    primaryActions: [],
    secondaryActions: [],
    lastMessage: "正在生成棋盘...",
    lastMessageTone: "info"
  },

  onLoad(query) {
    this.bootstrapGame(query || {});
  },

  onShow() {
    if (!this.gameState) {
      return;
    }
    this.refreshView();
    this.startTicker();
  },

  onHide() {
    this.syncClock();
    this.persistState();
    this.stopTicker();
  },

  onUnload() {
    this.syncClock();
    this.persistState();
    this.stopTicker();
  },

  bootstrapGame(query) {
    const mode = query.mode === "continue" ? "continue" : "new";
    const requestedDifficulty = engine.sanitizeDifficulty(query.difficulty || session.readLastDifficulty());
    const now = Date.now();
    const archive = session.readArchive();
    let state = null;

    if (mode === "continue" && archive) {
      try {
        state = engine.restoreGame(archive, { now });
      } catch (error) {
        state = null;
      }
    }

    if (!state) {
      state = engine.createNewGame({
        difficulty: requestedDifficulty,
        now
      });
    }

    this.gameState = state;
    session.writeLastDifficulty(state.difficulty);
    this.setData({
      showGuide: !session.readGuideSeen()
    });
    this.refreshView();
    this.persistState();
    this.startTicker();
  },

  syncClock() {
    if (!this.gameState) {
      return;
    }
    const archive = session.writeArchive(this.gameState, Date.now());
    this.gameState = engine.restoreGame(archive, { now: Date.now() });
  },

  persistState() {
    if (!this.gameState) {
      return;
    }
    session.writeArchive(this.gameState, Date.now());
  },

  startTicker() {
    this.stopTicker();
    if (!this.gameState || this.gameState.paused || this.gameState.gameEnded) {
      return;
    }
    this.timer = setInterval(() => {
      this.refreshView();
    }, 250);
  },

  stopTicker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  refreshView() {
    if (!this.gameState) {
      return;
    }

    const viewModel = engine.createViewModel(this.gameState, Date.now());
    const selectedValue = this.gameState.current[this.gameState.selectedIndex] || "";
    const numberPad = viewModel.numberPad.map((item) => ({
      ...item,
      active: selectedValue !== "" && Number(selectedValue) === item.value
    }));

    this.setData({
      difficulty: viewModel.difficulty,
      difficultyLabel: viewModel.difficultyLabel,
      elapsedLabel: viewModel.elapsedLabel,
      mistakes: viewModel.mistakes,
      mistakesLimit: viewModel.maxMistakes,
      paused: viewModel.paused,
      boardCells: viewModel.boardCells,
      numberPad,
      selectedCellValue: selectedValue ? String(selectedValue) : "--",
      noteMode: viewModel.noteMode,
      gameEnded: viewModel.gameEnded,
      won: viewModel.won,
      canUndo: viewModel.canUndo,
      statusCards: buildStatusCards(viewModel, this.gameState),
      primaryActions: buildPrimaryActions(this.gameState),
      secondaryActions: buildSecondaryActions(this.gameState),
      lastMessage: viewModel.lastMessage,
      lastMessageTone: viewModel.lastMessageTone
    });
  },

  updateState(nextState) {
    this.gameState = nextState;
    this.refreshView();
    this.persistState();
    this.startTicker();
  },

  handleTapCell(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.updateState(engine.selectCell(this.gameState, index));
  },

  handleTapNumber(event) {
    const value = Number(event.currentTarget.dataset.value);
    this.updateState(engine.placeNumber(this.gameState, value, Date.now()));
  },

  handleActionTap(event) {
    const action = event.currentTarget.dataset.key;

    if (action === "hint") {
      this.updateState(engine.giveHint(this.gameState, Date.now()));
      return;
    }

    if (action === "note") {
      this.updateState(engine.toggleNoteMode(this.gameState));
      return;
    }

    if (action === "erase") {
      this.updateState(engine.eraseSelected(this.gameState));
      return;
    }

    if (action === "undo") {
      this.updateState(engine.undoLastEdit(this.gameState));
      return;
    }

    if (action === "pause") {
      this.updateState(engine.togglePause(this.gameState, Date.now()));
      return;
    }

    if (action === "restart") {
      wx.showModal({
        title: "重新开局",
        content: "会生成一张新的 9x9 棋盘，并覆盖当前小游戏端进度。",
        success: (result) => {
          if (!result.confirm) {
            return;
          }
          const nextState = engine.createNewGame({
            difficulty: this.gameState.difficulty,
            now: Date.now()
          });
          this.updateState(nextState);
        }
      });
      return;
    }

    if (action === "home") {
      session.writeGuideSeen();
      wx.reLaunch({
        url: "/pages/home/index"
      });
    }
  },

  handleToggleGuide() {
    const next = !this.data.showGuide;
    if (!next) {
      session.writeGuideSeen();
    }
    this.setData({ showGuide: next });
  }
});
