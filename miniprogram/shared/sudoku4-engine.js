const GRID_SIZE = 4;
const BOX_SIZE = 2;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const MAX_MISTAKES = 5;
const MAX_UNDO = 80;

const DIFFICULTIES = {
  easy: { key: "easy", label: "简单", blanks: 5 },
  normal: { key: "normal", label: "普通", blanks: 8 },
  hard: { key: "hard", label: "困难", blanks: 11 }
};

const UNIT_CACHE = buildUnits();

function sanitizeDifficulty(input) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, input) ? input : "normal";
}

function shuffle(items, rng = Math.random) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function pattern(row, col) {
  return (row * BOX_SIZE + Math.floor(row / BOX_SIZE) + col) % GRID_SIZE;
}

function makeSolution(rng = Math.random) {
  const rowBands = shuffle([0, 1], rng);
  const rows = rowBands.flatMap((band) => shuffle([0, 1], rng).map((row) => band * BOX_SIZE + row));
  const colBands = shuffle([0, 1], rng);
  const cols = colBands.flatMap((band) => shuffle([0, 1], rng).map((col) => band * BOX_SIZE + col));
  const digits = shuffle([1, 2, 3, 4], rng);
  return rows.flatMap((row) => cols.map((col) => digits[pattern(row, col)]));
}

function makePuzzle(solution, blanks, rng = Math.random) {
  const grid = solution.slice();
  let removed = 0;
  const indexes = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index), rng);

  indexes.forEach((index) => {
    if (removed >= blanks) {
      return;
    }
    const saved = grid[index];
    grid[index] = 0;
    if (countSolutions(grid, 2) === 1) {
      removed += 1;
    } else {
      grid[index] = saved;
    }
  });

  return grid;
}

function isAllowedInGrid(grid, index, number) {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;

  for (let offset = 0; offset < GRID_SIZE; offset += 1) {
    if (grid[row * GRID_SIZE + offset] === number) {
      return false;
    }
    if (grid[offset * GRID_SIZE + col] === number) {
      return false;
    }
  }

  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let colOffset = 0; colOffset < BOX_SIZE; colOffset += 1) {
      if (grid[(boxRow + rowOffset) * GRID_SIZE + boxCol + colOffset] === number) {
        return false;
      }
    }
  }

  return true;
}

function candidatesForGrid(grid, index) {
  if (grid[index] !== 0) {
    return [];
  }
  const candidates = [];
  for (let number = 1; number <= GRID_SIZE; number += 1) {
    if (isAllowedInGrid(grid, index, number)) {
      candidates.push(number);
    }
  }
  return candidates;
}

function findBestEmptyCell(grid) {
  let bestIndex = -1;
  let bestCandidates = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (grid[index] !== 0) {
      continue;
    }
    const candidates = candidatesForGrid(grid, index);
    if (bestIndex === -1 || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
      if (candidates.length <= 1) {
        break;
      }
    }
  }
  return { index: bestIndex, candidates: bestCandidates };
}

function countSolutions(grid, limit = 2) {
  const working = grid.slice();
  let count = 0;

  function search() {
    if (count >= limit) {
      return;
    }
    const bestCell = findBestEmptyCell(working);
    if (bestCell.index === -1) {
      count += 1;
      return;
    }
    if (!bestCell.candidates.length) {
      return;
    }

    bestCell.candidates.forEach((number) => {
      if (count >= limit) {
        return;
      }
      working[bestCell.index] = number;
      search();
      working[bestCell.index] = 0;
    });
  }

  search();
  return count;
}

function buildUnits() {
  const units = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    units.push(Array.from({ length: GRID_SIZE }, (_, col) => row * GRID_SIZE + col));
  }

  for (let col = 0; col < GRID_SIZE; col += 1) {
    units.push(Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + col));
  }

  for (let boxRow = 0; boxRow < BOX_SIZE; boxRow += 1) {
    for (let boxCol = 0; boxCol < BOX_SIZE; boxCol += 1) {
      const box = [];
      for (let row = 0; row < BOX_SIZE; row += 1) {
        for (let col = 0; col < BOX_SIZE; col += 1) {
          box.push((boxRow * BOX_SIZE + row) * GRID_SIZE + boxCol * BOX_SIZE + col);
        }
      }
      units.push(box);
    }
  }

  return units;
}

function sameUnit(a, b) {
  const rowA = Math.floor(a / GRID_SIZE);
  const colA = a % GRID_SIZE;
  const rowB = Math.floor(b / GRID_SIZE);
  const colB = b % GRID_SIZE;
  return rowA === rowB ||
    colA === colB ||
    (Math.floor(rowA / BOX_SIZE) === Math.floor(rowB / BOX_SIZE) &&
      Math.floor(colA / BOX_SIZE) === Math.floor(colB / BOX_SIZE));
}

function conflictIndexes(grid) {
  const conflicts = new Set();

  UNIT_CACHE.forEach((unit) => {
    const seen = new Map();
    unit.forEach((index) => {
      const value = grid[index];
      if (!value) {
        return;
      }
      if (!seen.has(value)) {
        seen.set(value, []);
      }
      seen.get(value).push(index);
    });
    seen.forEach((indexes) => {
      if (indexes.length > 1) {
        indexes.forEach((index) => conflicts.add(index));
      }
    });
  });

  return conflicts;
}

function emptyNotes() {
  return Array.from({ length: CELL_COUNT }, () => []);
}

function uniqueSortedDigits(items) {
  const set = new Set();
  items.forEach((item) => {
    const value = Number(item);
    if (Number.isInteger(value) && value >= 1 && value <= GRID_SIZE) {
      set.add(value);
    }
  });
  return Array.from(set).sort((left, right) => left - right);
}

function cloneNotes(notes) {
  return Array.from({ length: CELL_COUNT }, (_, index) => {
    const source = Array.isArray(notes?.[index]) ? notes[index] : [];
    return uniqueSortedDigits(source);
  });
}

function countRemaining(current) {
  return current.reduce((sum, value) => sum + (value === 0 ? 1 : 0), 0);
}

function digitRemaining(current, number) {
  const filledCount = current.reduce((sum, value) => sum + (value === number ? 1 : 0), 0);
  return Math.max(0, GRID_SIZE - filledCount);
}

function formatTime(milliseconds) {
  const safeMilliseconds = Math.max(0, Number(milliseconds) || 0);
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function findFirstPlayableIndex(puzzle) {
  const index = puzzle.findIndex((value) => value === 0);
  return index >= 0 ? index : 0;
}

function snapshotUndo(state) {
  return {
    current: state.current.slice(),
    notes: cloneNotes(state.notes),
    selectedIndex: state.selectedIndex,
    mistakes: state.mistakes
  };
}

function cloneUndoStack(stack) {
  return Array.isArray(stack) ? stack.map((item) => ({
    current: Array.isArray(item.current) ? item.current.slice() : [],
    notes: cloneNotes(item.notes),
    selectedIndex: Number.isInteger(item.selectedIndex) ? item.selectedIndex : 0,
    mistakes: Number.isInteger(item.mistakes) ? item.mistakes : 0
  })) : [];
}

function cloneState(state) {
  return {
    ...state,
    puzzle: state.puzzle.slice(),
    solution: state.solution.slice(),
    current: state.current.slice(),
    given: state.given.slice(),
    notes: cloneNotes(state.notes),
    undoStack: cloneUndoStack(state.undoStack)
  };
}

function getElapsedMs(state, now = Date.now()) {
  if (state.timerStartedAt) {
    return state.elapsedMs + Math.max(0, now - state.timerStartedAt);
  }
  return state.elapsedMs;
}

function pushUndoState(state) {
  const next = cloneState(state);
  next.undoStack.push(snapshotUndo(state));
  if (next.undoStack.length > MAX_UNDO) {
    next.undoStack.shift();
  }
  return next;
}

function removeNoteFromPeers(notes, index, number) {
  return notes.map((items, peerIndex) => {
    if (!sameUnit(index, peerIndex)) {
      return items.slice();
    }
    return items.filter((value) => value !== number);
  });
}

function stopTimer(state, now = Date.now()) {
  const next = cloneState(state);
  next.elapsedMs = getElapsedMs(state, now);
  next.timerStartedAt = null;
  return next;
}

function startTimer(state, now = Date.now()) {
  const next = cloneState(state);
  next.timerStartedAt = now;
  return next;
}

function createNewGame(options = {}) {
  const difficulty = sanitizeDifficulty(options.difficulty);
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const solution = makeSolution(rng);
  const puzzle = makePuzzle(solution, DIFFICULTIES[difficulty].blanks, rng);

  return {
    version: 1,
    gameVersion: "4x4",
    difficulty,
    puzzle,
    solution,
    current: puzzle.slice(),
    given: puzzle.map(Boolean),
    notes: emptyNotes(),
    selectedIndex: findFirstPlayableIndex(puzzle),
    mistakes: 0,
    maxMistakes: MAX_MISTAKES,
    noteMode: false,
    paused: false,
    gameEnded: false,
    won: false,
    elapsedMs: 0,
    timerStartedAt: now,
    undoStack: [],
    lastMessage: "选择一个空格，然后输入数字。",
    lastMessageTone: "info"
  };
}

function restoreGame(archive, options = {}) {
  if (!archive || typeof archive !== "object") {
    throw new Error("invalid archive");
  }

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const puzzle = Array.isArray(archive.puzzle) && archive.puzzle.length === CELL_COUNT
    ? archive.puzzle.slice()
    : null;
  const solution = Array.isArray(archive.solution) && archive.solution.length === CELL_COUNT
    ? archive.solution.slice()
    : null;
  const current = Array.isArray(archive.current) && archive.current.length === CELL_COUNT
    ? archive.current.slice()
    : null;
  const notes = Array.isArray(archive.notes) && archive.notes.length === CELL_COUNT
    ? cloneNotes(archive.notes)
    : null;

  if (!puzzle || !solution || !current || !notes) {
    throw new Error("archive shape mismatch");
  }

  const given = Array.isArray(archive.given) && archive.given.length === CELL_COUNT
    ? archive.given.map(Boolean)
    : puzzle.map(Boolean);
  let selectedIndex = Number.isInteger(archive.selectedIndex) ? archive.selectedIndex : findFirstPlayableIndex(current);
  if (selectedIndex < 0 || selectedIndex >= CELL_COUNT) {
    selectedIndex = findFirstPlayableIndex(current);
  }

  const gameEnded = Boolean(archive.gameEnded);
  const paused = gameEnded ? false : Boolean(archive.paused);
  const elapsedMs = Math.max(0, Number(archive.elapsedMs) || 0);

  return {
    version: 1,
    gameVersion: "4x4",
    difficulty: sanitizeDifficulty(archive.difficulty),
    puzzle,
    solution,
    current,
    given,
    notes,
    selectedIndex,
    mistakes: Math.max(0, Number(archive.mistakes) || 0),
    maxMistakes: MAX_MISTAKES,
    noteMode: false,
    paused,
    gameEnded,
    won: Boolean(archive.won),
    elapsedMs,
    timerStartedAt: paused || gameEnded ? null : now,
    undoStack: cloneUndoStack(archive.undoStack),
    lastMessage: typeof archive.lastMessage === "string" && archive.lastMessage
      ? archive.lastMessage
      : "已恢复上次棋局。",
    lastMessageTone: typeof archive.lastMessageTone === "string" && archive.lastMessageTone
      ? archive.lastMessageTone
      : "info"
  };
}

function saveArchive(state, now = Date.now()) {
  return {
    version: 1,
    gameVersion: state.gameVersion,
    difficulty: sanitizeDifficulty(state.difficulty),
    puzzle: state.puzzle.slice(),
    solution: state.solution.slice(),
    current: state.current.slice(),
    given: state.given.slice(),
    notes: cloneNotes(state.notes),
    selectedIndex: state.selectedIndex,
    mistakes: state.mistakes,
    paused: state.paused,
    gameEnded: state.gameEnded,
    won: state.won,
    elapsedMs: getElapsedMs(state, now),
    undoStack: cloneUndoStack(state.undoStack),
    lastMessage: state.lastMessage,
    lastMessageTone: state.lastMessageTone
  };
}

function selectCell(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    return cloneState(state);
  }
  const next = cloneState(state);
  next.selectedIndex = index;
  return next;
}

function toggleNoteMode(state) {
  const next = cloneState(state);
  next.noteMode = !state.noteMode;
  next.lastMessage = next.noteMode ? "标记模式已开启。" : "标记模式已关闭。";
  next.lastMessageTone = "info";
  return next;
}

function togglePause(state, now = Date.now()) {
  if (state.gameEnded) {
    return cloneState(state);
  }
  if (state.paused) {
    const resumed = startTimer({ ...state, paused: false }, now);
    resumed.lastMessage = "游戏继续。";
    resumed.lastMessageTone = "info";
    return resumed;
  }
  const paused = stopTimer({ ...state, paused: true }, now);
  paused.lastMessage = "游戏已暂停，继续后才能查看和编辑棋盘。";
  paused.lastMessageTone = "info";
  return paused;
}

function undoLastEdit(state) {
  if (state.paused || state.gameEnded) {
    return cloneState(state);
  }
  if (!state.undoStack.length) {
    const next = cloneState(state);
    next.lastMessage = "暂无可撤销的编辑。";
    next.lastMessageTone = "info";
    return next;
  }

  const next = cloneState(state);
  const previous = next.undoStack.pop();
  next.current = previous.current.slice();
  next.notes = cloneNotes(previous.notes);
  next.selectedIndex = previous.selectedIndex;
  next.mistakes = previous.mistakes;
  next.lastMessage = "已撤销上次编辑。";
  next.lastMessageTone = "info";
  return next;
}

function finalizeWin(state, now = Date.now()) {
  const stopped = stopTimer(state, now);
  stopped.gameEnded = true;
  stopped.won = true;
  stopped.paused = false;
  stopped.lastMessage = `完成！用时 ${formatTime(stopped.elapsedMs)}，错误 ${stopped.mistakes}/${stopped.maxMistakes}。`;
  stopped.lastMessageTone = "success";
  return stopped;
}

function finalizeFailure(state, now = Date.now()) {
  const stopped = stopTimer(state, now);
  stopped.gameEnded = true;
  stopped.won = false;
  stopped.paused = false;
  stopped.lastMessage = `失败：明错误已超过 ${stopped.maxMistakes} 次，只能重新开局。`;
  stopped.lastMessageTone = "error";
  return stopped;
}

function maybeWin(state, now = Date.now()) {
  if (countRemaining(state.current) === 0 && conflictIndexes(state.current).size === 0) {
    return finalizeWin(state, now);
  }
  return state;
}

function placeNumber(state, number, now = Date.now()) {
  if (state.paused || state.gameEnded) {
    return cloneState(state);
  }
  if (!Number.isInteger(number) || number < 1 || number > GRID_SIZE) {
    return cloneState(state);
  }
  if (state.given[state.selectedIndex]) {
    const next = cloneState(state);
    next.lastMessage = "这个格子是题目数字，不能修改。";
    next.lastMessageTone = "info";
    return next;
  }

  if (state.noteMode) {
    const next = pushUndoState(state);
    next.current[state.selectedIndex] = 0;
    const notes = new Set(next.notes[state.selectedIndex]);
    if (notes.has(number)) {
      notes.delete(number);
    } else {
      notes.add(number);
    }
    next.notes[state.selectedIndex] = Array.from(notes).sort((left, right) => left - right);
    next.lastMessage = "标记已更新。";
    next.lastMessageTone = "info";
    return next;
  }

  if (state.current[state.selectedIndex] === number && state.notes[state.selectedIndex].length === 0) {
    const next = cloneState(state);
    next.lastMessage = "这个格子已经是这个数字。";
    next.lastMessageTone = "info";
    return next;
  }

  let next = pushUndoState(state);
  next.notes[state.selectedIndex] = [];
  const previousValue = next.current[state.selectedIndex];
  next.current[state.selectedIndex] = number;
  const hasConflict = conflictIndexes(next.current).has(state.selectedIndex);

  if (hasConflict) {
    if (previousValue !== number) {
      next.mistakes += 1;
      if (next.mistakes > next.maxMistakes) {
        return finalizeFailure(next, now);
      }
    }
    next.lastMessage = `这一行、列或四宫格里已经有 ${number}，错误 ${next.mistakes}/${next.maxMistakes}。`;
    next.lastMessageTone = "error";
    return next;
  }

  next.notes = removeNoteFromPeers(next.notes, state.selectedIndex, number);
  next.lastMessage = "已填入，当前没有明错误。";
  next.lastMessageTone = "info";
  next = maybeWin(next, now);
  return next;
}

function eraseSelected(state) {
  if (state.paused || state.gameEnded) {
    return cloneState(state);
  }
  if (state.given[state.selectedIndex]) {
    const next = cloneState(state);
    next.lastMessage = "题目数字保留原样。";
    next.lastMessageTone = "info";
    return next;
  }
  if (state.current[state.selectedIndex] === 0 && state.notes[state.selectedIndex].length === 0) {
    const next = cloneState(state);
    next.lastMessage = "当前格已经是空白。";
    next.lastMessageTone = "info";
    return next;
  }

  const next = pushUndoState(state);
  next.current[state.selectedIndex] = 0;
  next.notes[state.selectedIndex] = [];
  next.lastMessage = "已清除当前格。";
  next.lastMessageTone = "info";
  return next;
}

function giveHint(state, now = Date.now()) {
  if (state.paused || state.gameEnded) {
    return cloneState(state);
  }
  if (countRemaining(state.current) === 0) {
    return maybeWin(cloneState(state), now);
  }
  if (state.given[state.selectedIndex] || state.current[state.selectedIndex] !== 0) {
    const next = cloneState(state);
    next.lastMessage = "请先选中一个空白格，再使用提示。";
    next.lastMessageTone = "info";
    return next;
  }

  let next = pushUndoState(state);
  next.current[state.selectedIndex] = next.solution[state.selectedIndex];
  next.notes[state.selectedIndex] = [];
  next.notes = removeNoteFromPeers(next.notes, state.selectedIndex, next.current[state.selectedIndex]);
  next.lastMessage = "已在当前空白格填入提示。";
  next.lastMessageTone = "info";
  next = maybeWin(next, now);
  return next;
}

function resetGame(state, now = Date.now()) {
  const next = cloneState(state);
  next.current = next.puzzle.slice();
  next.notes = emptyNotes();
  next.mistakes = 0;
  next.noteMode = false;
  next.paused = false;
  next.gameEnded = false;
  next.won = false;
  next.elapsedMs = 0;
  next.timerStartedAt = now;
  next.undoStack = [];
  next.selectedIndex = findFirstPlayableIndex(next.puzzle);
  next.lastMessage = "棋盘已重置。";
  next.lastMessageTone = "info";
  return next;
}

function createBoardCells(state) {
  const conflicts = conflictIndexes(state.current);
  const selectedValue = state.current[state.selectedIndex];

  return state.current.map((value, index) => {
    const noteRows = [];
    const noteLookup = new Set(state.notes[index]);
    for (let row = 0; row < BOX_SIZE; row += 1) {
      const rowItems = [];
      for (let col = 0; col < BOX_SIZE; col += 1) {
        const number = row * BOX_SIZE + col + 1;
        rowItems.push(noteLookup.has(number) ? String(number) : "");
      }
      noteRows.push(rowItems);
    }

    return {
      index,
      value: value ? String(value) : "",
      given: state.given[index],
      selected: state.selectedIndex === index,
      related: state.selectedIndex !== index && sameUnit(state.selectedIndex, index),
      match: value !== 0 && selectedValue !== 0 && value === selectedValue,
      error: conflicts.has(index),
      noteRows,
      boxRight: ((index % GRID_SIZE) + 1) % BOX_SIZE === 0 && (index % GRID_SIZE) !== GRID_SIZE - 1,
      boxBottom: (Math.floor(index / GRID_SIZE) + 1) % BOX_SIZE === 0 && Math.floor(index / GRID_SIZE) !== GRID_SIZE - 1
    };
  });
}

function createNumberPad(state) {
  return Array.from({ length: GRID_SIZE }, (_, offset) => {
    const number = offset + 1;
    const remaining = digitRemaining(state.current, number);
    return {
      value: number,
      label: String(number),
      remaining,
      complete: remaining === 0
    };
  });
}

function createViewModel(state, now = Date.now()) {
  return {
    gameVersion: "4x4",
    gridSize: GRID_SIZE,
    boxSize: BOX_SIZE,
    difficulty: state.difficulty,
    difficultyLabel: DIFFICULTIES[sanitizeDifficulty(state.difficulty)].label,
    boardCells: createBoardCells(state),
    numberPad: createNumberPad(state),
    selectedIndex: state.selectedIndex,
    mistakes: state.mistakes,
    maxMistakes: state.maxMistakes,
    mistakesLabel: `${state.mistakes}/${state.maxMistakes}`,
    elapsedLabel: formatTime(getElapsedMs(state, now)),
    remainingCount: countRemaining(state.current),
    noteMode: state.noteMode,
    paused: state.paused,
    gameEnded: state.gameEnded,
    won: state.won,
    canUndo: !state.paused && !state.gameEnded && state.undoStack.length > 0,
    lastMessage: state.lastMessage,
    lastMessageTone: state.lastMessageTone
  };
}

module.exports = {
  BOX_SIZE,
  CELL_COUNT,
  DIFFICULTIES,
  GRID_SIZE,
  MAX_MISTAKES,
  candidatesForGrid,
  conflictIndexes,
  countSolutions,
  createNewGame,
  createViewModel,
  eraseSelected,
  formatTime,
  getElapsedMs,
  giveHint,
  makePuzzle,
  makeSolution,
  placeNumber,
  resetGame,
  restoreGame,
  sanitizeDifficulty,
  saveArchive,
  selectCell,
  toggleNoteMode,
  togglePause,
  undoLastEdit
};
