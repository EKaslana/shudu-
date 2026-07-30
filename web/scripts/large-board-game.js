(function () {
  const currentScript = document.currentScript;
  const version = currentScript?.dataset.version || document.body.dataset.version || "";
  const title = currentScript?.dataset.title || document.body.dataset.title || version;
  const warning = currentScript?.dataset.warning || document.body.dataset.warning || "";
  const engine = window.SUDOKU_ENGINES?.[version];

  if (!engine) {
    throw new Error("Unsupported Sudoku version for web page: " + version);
  }

  const saveKey = "sudoku-web-" + version + "-save-v1";
  const completionStatsKey = "sudoku-web-" + version + "-stats-v1";
  const gridSize = engine.GRID_SIZE;

  const boardEl = document.getElementById("board");
  const pauseOverlayEl = document.getElementById("pauseOverlay");
  const difficultyEl = document.getElementById("difficulty");
  const mistakesEl = document.getElementById("mistakes");
  const timerEl = document.getElementById("timer");
  const remainingEl = document.getElementById("remaining");
  const hintUsageEl = document.getElementById("hintUsage");
  const completedCountEl = document.getElementById("completedCount");
  const averageTimeEl = document.getElementById("averageTime");
  const messageEl = document.getElementById("message");
  const numberPadEl = document.getElementById("numberPad");
  const notesModeBtn = document.getElementById("notesMode");
  const undoBtn = document.getElementById("undo");
  const pauseBtn = document.getElementById("pause");
  const saveBtn = document.getElementById("saveGame");
  const loadBtn = document.getElementById("loadGame");
  const newGameBtn = document.getElementById("newGame");
  const hintBtn = document.getElementById("hint");
  const eraseBtn = document.getElementById("erase");
  const resetBtn = document.getElementById("reset");
  const warningEl = document.getElementById("warningBadge");
  const titleEl = document.getElementById("gameTitle");
  const subtitleEl = document.getElementById("gameSubtitle");
  const difficultyLabelEl = document.getElementById("difficultyLabel");

  let state = null;
  let timerId = null;
  let completionRecorded = false;

  titleEl.textContent = title;
  subtitleEl.textContent = warning
    ? "网页版补齐了大棋盘入口，建议优先在电脑端或大屏设备体验。"
    : "网页版入口已就绪，可直接开局或读档继续。";

  if (warning) {
    warningEl.hidden = false;
    warningEl.textContent = warning;
  }

  Object.entries(engine.DIFFICULTIES).forEach(function ([key, meta]) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = meta.label;
    difficultyEl.append(option);
  });

  function emptyStats() {
    return {
      easy: { wins: 0, totalMs: 0 },
      normal: { wins: 0, totalMs: 0 },
      hard: { wins: 0, totalMs: 0 }
    };
  }

  function readStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(completionStatsKey) || "{}");
      const stats = emptyStats();
      Object.keys(stats).forEach(function (key) {
        if (parsed[key] && Number.isFinite(parsed[key].wins) && Number.isFinite(parsed[key].totalMs)) {
          stats[key] = {
            wins: Math.max(0, Number(parsed[key].wins) || 0),
            totalMs: Math.max(0, Number(parsed[key].totalMs) || 0)
          };
        }
      });
      return stats;
    } catch (error) {
      return emptyStats();
    }
  }

  function writeStats(stats) {
    localStorage.setItem(completionStatsKey, JSON.stringify(stats));
  }

  function updateStatsSummary() {
    const stats = readStats()[difficultyEl.value] || { wins: 0, totalMs: 0 };
    completedCountEl.textContent = String(stats.wins);
    averageTimeEl.textContent = stats.wins ? engine.formatTime(Math.round(stats.totalMs / stats.wins)) : "--:--";
  }

  function recordWinIfNeeded(nextState) {
    if (!nextState.gameEnded || !nextState.won || completionRecorded) {
      return;
    }
    const stats = readStats();
    const row = stats[nextState.difficulty] || { wins: 0, totalMs: 0 };
    row.wins += 1;
    row.totalMs += engine.getElapsedMs(nextState, Date.now());
    stats[nextState.difficulty] = row;
    writeStats(stats);
    completionRecorded = true;
  }

  function getBoardMetrics() {
    if (gridSize <= 16) {
      return {
        cellSize: 56,
        cellFont: 24,
        noteFont: 10
      };
    }
    return {
      cellSize: 40,
      cellFont: 15,
      noteFont: 7
    };
  }

  function setBoardMetrics() {
    const metrics = getBoardMetrics();
    boardEl.style.setProperty("--cell-size", metrics.cellSize + "px");
    boardEl.style.setProperty("--cell-font", metrics.cellFont + "px");
    boardEl.style.setProperty("--note-font", metrics.noteFont + "px");
    boardEl.style.gridTemplateColumns = "repeat(" + gridSize + ", var(--cell-size))";
    boardEl.style.gridTemplateRows = "repeat(" + gridSize + ", var(--cell-size))";
  }

  function ensureTimer() {
    window.clearInterval(timerId);
    if (!state || state.paused || state.gameEnded) {
      timerId = null;
      return;
    }
    timerId = window.setInterval(function () {
      timerEl.textContent = engine.createViewModel(state, Date.now()).elapsedLabel;
    }, 250);
  }

  function setMessage(viewModel) {
    messageEl.textContent = viewModel.lastMessage || "选择一个空格，然后输入数字。";
    messageEl.classList.toggle("is-success", viewModel.lastMessageTone === "success");
    messageEl.classList.toggle("is-error", viewModel.lastMessageTone === "error");
  }

  function renderBoard(viewModel) {
    boardEl.innerHTML = "";
    viewModel.boardCells.forEach(function (cellData) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      if (cellData.given) cell.classList.add("given");
      if (cellData.selected) cell.classList.add("selected");
      if (cellData.related) cell.classList.add("related");
      if (cellData.match) cell.classList.add("match");
      if (cellData.error) cell.classList.add("error");
      if (cellData.boxRight) cell.classList.add("box-right");
      if (cellData.boxBottom) cell.classList.add("box-bottom");
      cell.setAttribute("aria-label", "第 " + (Math.floor(cellData.index / gridSize) + 1) + " 行第 " + (cellData.index % gridSize + 1) + " 列");
      cell.dataset.index = String(cellData.index);

      if (cellData.value) {
        cell.textContent = cellData.value;
      } else {
        const notes = document.createElement("div");
        notes.className = "notes";
        notes.style.gridTemplateColumns = "repeat(" + engine.BOX_SIZE + ", 1fr)";
        notes.style.gridTemplateRows = "repeat(" + engine.BOX_SIZE + ", 1fr)";
        cellData.noteRows.forEach(function (row, rowIndex) {
          row.forEach(function (symbol, colIndex) {
            const note = document.createElement("span");
            note.className = "notes-note";
            if (cellData.noteHighlightRows[rowIndex][colIndex]) {
              note.classList.add("is-match");
            }
            note.textContent = symbol;
            notes.append(note);
          });
        });
        cell.append(notes);
      }

      cell.addEventListener("click", function () {
        if (state.paused) return;
        applyState(engine.selectCell(state, cellData.index));
      });
      boardEl.append(cell);
    });
  }

  function renderNumberPad(viewModel) {
    numberPadEl.innerHTML = "";
    viewModel.numberPad.forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number-button";
      if (item.complete) button.classList.add("is-complete");
      button.innerHTML = '<span class="number-label">' + item.label + '</span><span class="number-left">剩 ' + item.remaining + "</span>";
      button.addEventListener("click", function () {
        applyNumber(item.value);
      });
      numberPadEl.append(button);
    });
  }

  function updateControlStates(viewModel) {
    notesModeBtn.classList.toggle("active", viewModel.noteMode);
    pauseBtn.textContent = viewModel.paused ? "继续" : "暂停";
    undoBtn.disabled = !viewModel.canUndo;
    hintBtn.disabled = viewModel.paused || viewModel.gameEnded;
    eraseBtn.disabled = viewModel.paused || viewModel.gameEnded;
    notesModeBtn.disabled = viewModel.gameEnded;
    pauseBtn.disabled = viewModel.gameEnded;
    resetBtn.disabled = viewModel.paused || viewModel.gameEnded;
    pauseOverlayEl.classList.toggle("is-visible", viewModel.paused);
    pauseOverlayEl.textContent = "已暂停";
    boardEl.classList.toggle("is-paused", viewModel.paused);
    loadBtn.disabled = !localStorage.getItem(saveKey);
  }

  function render() {
    const viewModel = engine.createViewModel(state, Date.now());
    difficultyEl.value = state.difficulty;
    difficultyLabelEl.textContent = viewModel.difficultyLabel;
    mistakesEl.textContent = viewModel.mistakesLabel;
    timerEl.textContent = viewModel.elapsedLabel;
    remainingEl.textContent = String(viewModel.remainingCount);
    hintUsageEl.textContent = viewModel.hintUsageLabel;
    renderBoard(viewModel);
    renderNumberPad(viewModel);
    setMessage(viewModel);
    updateControlStates(viewModel);
    updateStatsSummary();
    ensureTimer();
  }

  function applyState(nextState) {
    state = nextState;
    recordWinIfNeeded(nextState);
    render();
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(saveKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSave() {
    localStorage.setItem(saveKey, JSON.stringify(engine.saveArchive(state, Date.now())));
    loadBtn.disabled = false;
  }

  function applyNumber(number) {
    if (state.hintsUsed > state.maxHintsPerGame) {
      return;
    }
    applyState(engine.placeNumber(state, number, Date.now()));
  }

  function startNewGame() {
    completionRecorded = false;
    applyState(engine.createNewGame({
      difficulty: difficultyEl.value,
      now: Date.now()
    }));
  }

  function resetCurrentGame() {
    completionRecorded = false;
    applyState(engine.resetGame(state, Date.now()));
  }

  function giveHint() {
    if ((state.hintsUsed || 0) >= (state.maxHintsPerGame || 3)) {
      const nextState = {
        ...state,
        lastMessage: "网页版当前每局提供 3 次免费提示，用完后请直接开新局继续。",
        lastMessageTone: "info"
      };
      applyState(nextState);
      return;
    }
    applyState(engine.giveHint(state, Date.now()));
  }

  function loadSavedGame() {
    const archive = readSave();
    if (!archive) {
      applyState({
        ...state,
        lastMessage: "当前还没有可读取的存档。",
        lastMessageTone: "info"
      });
      return;
    }

    try {
      completionRecorded = Boolean(archive.gameEnded && archive.won);
      applyState(engine.restoreGame(archive, { now: Date.now() }));
    } catch (error) {
      applyState({
        ...state,
        lastMessage: "旧存档格式不兼容，建议直接开新局。",
        lastMessageTone: "error"
      });
    }
  }

  function boot() {
    setBoardMetrics();
    const archive = readSave();
    if (archive) {
      try {
        completionRecorded = Boolean(archive.gameEnded && archive.won);
        state = engine.restoreGame(archive, { now: Date.now() });
      } catch (error) {
        state = engine.createNewGame({ difficulty: "normal", now: Date.now() });
      }
    } else {
      state = engine.createNewGame({ difficulty: "normal", now: Date.now() });
    }
    render();
  }

  difficultyEl.addEventListener("change", function () {
    startNewGame();
  });
  newGameBtn.addEventListener("click", startNewGame);
  resetBtn.addEventListener("click", resetCurrentGame);
  notesModeBtn.addEventListener("click", function () {
    applyState(engine.toggleNoteMode(state));
  });
  undoBtn.addEventListener("click", function () {
    applyState(engine.undoLastEdit(state));
  });
  pauseBtn.addEventListener("click", function () {
    applyState(engine.togglePause(state, Date.now()));
  });
  hintBtn.addEventListener("click", giveHint);
  eraseBtn.addEventListener("click", function () {
    applyState(engine.eraseSelected(state));
  });
  saveBtn.addEventListener("click", function () {
    writeSave();
    applyState({
      ...state,
      lastMessage: "已保存当前进度；下次打开这个版本时可继续。",
      lastMessageTone: "success"
    });
  });
  loadBtn.addEventListener("click", loadSavedGame);

  boot();
})();
