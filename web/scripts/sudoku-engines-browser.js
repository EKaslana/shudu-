(function () {
  function createSudokuEngine(config) {
    const GRID_SIZE = config.gridSize;
    const BOX_SIZE = config.boxSize;
    const CELL_COUNT = GRID_SIZE * GRID_SIZE;
    const MAX_MISTAKES = config.maxMistakes;
    const MAX_HINTS_PER_GAME = Number.isInteger(config.maxHintsPerGame) ? config.maxHintsPerGame : 3;
    const MAX_UNDO = Number.isInteger(config.maxUndo) ? config.maxUndo : 80;
    const DIFFICULTIES = config.difficulties;
    const GAME_VERSION = config.gameVersion;
    const BOX_LABEL = config.boxLabel || "宫区";
    const SYMBOLS = Array.isArray(config.symbols) && config.symbols.length === GRID_SIZE
      ? config.symbols.slice()
      : Array.from({ length: GRID_SIZE }, function (_, index) { return String(index + 1); });
    const ENFORCE_UNIQUE = config.enforceUnique !== false;
    const MIN_UNIT_GIVENS = Number.isInteger(config.minUnitGivens) ? Math.max(1, config.minUnitGivens) : 1;
    const UNIT_CACHE = buildUnits();

    function sanitizeDifficulty(input) {
      return Object.prototype.hasOwnProperty.call(DIFFICULTIES, input) ? input : "normal";
    }

    function shuffle(items, rng) {
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

    function makeSolution(rng) {
      const bands = Array.from({ length: BOX_SIZE }, function (_, index) { return index; });
      const offsets = Array.from({ length: BOX_SIZE }, function (_, index) { return index; });
      const rows = shuffle(bands, rng).flatMap(function (band) {
        return shuffle(offsets, rng).map(function (row) {
          return band * BOX_SIZE + row;
        });
      });
      const cols = shuffle(bands, rng).flatMap(function (band) {
        return shuffle(offsets, rng).map(function (col) {
          return band * BOX_SIZE + col;
        });
      });
      const digits = shuffle(Array.from({ length: GRID_SIZE }, function (_, index) { return index + 1; }), rng);
      return rows.flatMap(function (row) {
        return cols.map(function (col) {
          return digits[pattern(row, col)];
        });
      });
    }

    function createUnitGivensCounter() {
      return {
        rows: Array(GRID_SIZE).fill(GRID_SIZE),
        cols: Array(GRID_SIZE).fill(GRID_SIZE),
        boxes: Array(GRID_SIZE).fill(GRID_SIZE)
      };
    }

    function boxIndexFor(index) {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE);
    }

    function canRemoveWithoutStarvingUnit(counter, index) {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const box = boxIndexFor(index);
      return counter.rows[row] > MIN_UNIT_GIVENS
        && counter.cols[col] > MIN_UNIT_GIVENS
        && counter.boxes[box] > MIN_UNIT_GIVENS;
    }

    function markRemoved(counter, index) {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const box = boxIndexFor(index);
      counter.rows[row] -= 1;
      counter.cols[col] -= 1;
      counter.boxes[box] -= 1;
    }

    function makePuzzle(solution, blanks, rng) {
      const grid = solution.slice();
      let removed = 0;
      const indexes = shuffle(Array.from({ length: CELL_COUNT }, function (_, index) { return index; }), rng);

      if (ENFORCE_UNIQUE) {
        indexes.forEach(function (index) {
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

      const unitCounter = createUnitGivensCounter();
      indexes.forEach(function (index) {
        if (removed >= blanks || !canRemoveWithoutStarvingUnit(unitCounter, index)) {
          return;
        }
        grid[index] = 0;
        markRemoved(unitCounter, index);
        removed += 1;
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

    function countSolutions(grid, limit) {
      const working = grid.slice();
      let count = 0;
      const max = Number.isFinite(limit) ? limit : 2;

      function search() {
        if (count >= max) {
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

        bestCell.candidates.forEach(function (number) {
          if (count >= max) {
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
        units.push(Array.from({ length: GRID_SIZE }, function (_, col) { return row * GRID_SIZE + col; }));
      }

      for (let col = 0; col < GRID_SIZE; col += 1) {
        units.push(Array.from({ length: GRID_SIZE }, function (_, row) { return row * GRID_SIZE + col; }));
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

      UNIT_CACHE.forEach(function (unit) {
        const seen = new Map();
        unit.forEach(function (index) {
          const value = grid[index];
          if (!value) {
            return;
          }
          if (!seen.has(value)) {
            seen.set(value, []);
          }
          seen.get(value).push(index);
        });
        seen.forEach(function (indexes) {
          if (indexes.length > 1) {
            indexes.forEach(function (index) { conflicts.add(index); });
          }
        });
      });

      return conflicts;
    }

    function countRemaining(grid) {
      return grid.filter(function (value) { return value === 0; }).length;
    }

    function digitRemaining(grid, number) {
      const filledCount = grid.filter(function (value) { return value === number; }).length;
      return Math.max(0, GRID_SIZE - filledCount);
    }

    function formatTime(ms) {
      const seconds = Math.floor(ms / 1000);
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      return mins + ":" + secs;
    }

    function formatSymbol(number) {
      return SYMBOLS[number - 1] || String(number);
    }

    function emptyNotes() {
      return Array.from({ length: CELL_COUNT }, function () { return []; });
    }

    function cloneNotes(notes) {
      return notes.map(function (items) { return items.slice(); });
    }

    function cloneUndoStack(undoStack) {
      return undoStack.map(function (entry) {
        return {
          current: entry.current.slice(),
          notes: cloneNotes(entry.notes),
          selectedIndex: entry.selectedIndex,
          mistakes: entry.mistakes
        };
      });
    }

    function cloneState(state) {
      return {
        version: 1,
        gameVersion: state.gameVersion,
        difficulty: state.difficulty,
        puzzle: state.puzzle.slice(),
        solution: state.solution.slice(),
        current: state.current.slice(),
        given: state.given.slice(),
        notes: cloneNotes(state.notes),
        selectedIndex: state.selectedIndex,
        mistakes: state.mistakes,
        maxMistakes: state.maxMistakes,
        hintsUsed: state.hintsUsed,
        maxHintsPerGame: state.maxHintsPerGame,
        noteMode: state.noteMode,
        paused: state.paused,
        gameEnded: state.gameEnded,
        won: state.won,
        elapsedMs: state.elapsedMs,
        timerStartedAt: state.timerStartedAt,
        undoStack: cloneUndoStack(state.undoStack),
        lastMessage: state.lastMessage,
        lastMessageTone: state.lastMessageTone
      };
    }

    function findFirstPlayableIndex(grid) {
      const emptyIndex = grid.findIndex(function (value) { return value === 0; });
      return emptyIndex >= 0 ? emptyIndex : 0;
    }

    function getElapsedMs(state, now) {
      if (!state.timerStartedAt) {
        return Math.max(0, Number(state.elapsedMs) || 0);
      }
      return Math.max(0, Number(state.elapsedMs) || 0) + Math.max(0, Number(now) - state.timerStartedAt);
    }

    function pushUndoState(state) {
      const next = cloneState(state);
      next.undoStack.push({
        current: next.current.slice(),
        notes: cloneNotes(next.notes),
        selectedIndex: next.selectedIndex,
        mistakes: next.mistakes
      });
      if (next.undoStack.length > MAX_UNDO) {
        next.undoStack.shift();
      }
      return next;
    }

    function removeNoteFromPeers(notes, index, number) {
      return notes.map(function (items, peerIndex) {
        if (!sameUnit(index, peerIndex)) {
          return items.slice();
        }
        return items.filter(function (value) { return value !== number; });
      });
    }

    function stopTimer(state, now) {
      const next = cloneState(state);
      next.elapsedMs = getElapsedMs(state, now);
      next.timerStartedAt = null;
      return next;
    }

    function startTimer(state, now) {
      const next = cloneState(state);
      next.timerStartedAt = now;
      return next;
    }

    function createNewGame(options) {
      const settings = options || {};
      const difficulty = sanitizeDifficulty(settings.difficulty);
      const now = Number.isFinite(settings.now) ? settings.now : Date.now();
      const rng = typeof settings.rng === "function" ? settings.rng : Math.random;
      const solution = makeSolution(rng);
      const puzzle = makePuzzle(solution, DIFFICULTIES[difficulty].blanks, rng);

      return {
        version: 1,
        gameVersion: GAME_VERSION,
        difficulty: difficulty,
        puzzle: puzzle,
        solution: solution,
        current: puzzle.slice(),
        given: puzzle.map(Boolean),
        notes: emptyNotes(),
        selectedIndex: findFirstPlayableIndex(puzzle),
        mistakes: 0,
        maxMistakes: MAX_MISTAKES,
        hintsUsed: 0,
        maxHintsPerGame: MAX_HINTS_PER_GAME,
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

    function restoreGame(archive, options) {
      if (!archive || typeof archive !== "object") {
        throw new Error("invalid archive");
      }
      const settings = options || {};
      const now = Number.isFinite(settings.now) ? settings.now : Date.now();
      const puzzle = Array.isArray(archive.puzzle) && archive.puzzle.length === CELL_COUNT ? archive.puzzle.slice() : null;
      const solution = Array.isArray(archive.solution) && archive.solution.length === CELL_COUNT ? archive.solution.slice() : null;
      const current = Array.isArray(archive.current) && archive.current.length === CELL_COUNT ? archive.current.slice() : null;
      const notes = Array.isArray(archive.notes) && archive.notes.length === CELL_COUNT ? cloneNotes(archive.notes) : null;
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
        gameVersion: GAME_VERSION,
        difficulty: sanitizeDifficulty(archive.difficulty),
        puzzle: puzzle,
        solution: solution,
        current: current,
        given: given,
        notes: notes,
        selectedIndex: selectedIndex,
        mistakes: Math.max(0, Number(archive.mistakes) || 0),
        maxMistakes: MAX_MISTAKES,
        hintsUsed: Math.max(0, Number(archive.hintsUsed) || 0),
        maxHintsPerGame: Math.max(1, Number(archive.maxHintsPerGame) || MAX_HINTS_PER_GAME),
        noteMode: false,
        paused: paused,
        gameEnded: gameEnded,
        won: Boolean(archive.won),
        elapsedMs: elapsedMs,
        timerStartedAt: paused || gameEnded ? null : now,
        undoStack: cloneUndoStack(Array.isArray(archive.undoStack) ? archive.undoStack : []),
        lastMessage: typeof archive.lastMessage === "string" && archive.lastMessage ? archive.lastMessage : "已恢复上次棋局。",
        lastMessageTone: typeof archive.lastMessageTone === "string" && archive.lastMessageTone ? archive.lastMessageTone : "info"
      };
    }

    function saveArchive(state, now) {
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
        hintsUsed: state.hintsUsed,
        maxHintsPerGame: state.maxHintsPerGame,
        paused: state.paused,
        gameEnded: state.gameEnded,
        won: state.won,
        elapsedMs: getElapsedMs(state, Number.isFinite(now) ? now : Date.now()),
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

    function togglePause(state, now) {
      if (state.gameEnded) {
        return cloneState(state);
      }
      if (state.paused) {
        const resumed = startTimer({ ...state, paused: false }, Number.isFinite(now) ? now : Date.now());
        resumed.lastMessage = "游戏继续。";
        resumed.lastMessageTone = "info";
        return resumed;
      }
      const paused = stopTimer({ ...state, paused: true }, Number.isFinite(now) ? now : Date.now());
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

    function finalizeWin(state, now) {
      const stopped = stopTimer(state, Number.isFinite(now) ? now : Date.now());
      stopped.gameEnded = true;
      stopped.won = true;
      stopped.paused = false;
      stopped.lastMessage = "完成！用时 " + formatTime(stopped.elapsedMs) + "，错误 " + stopped.mistakes + "/" + stopped.maxMistakes + "。";
      stopped.lastMessageTone = "success";
      return stopped;
    }

    function finalizeFailure(state, now) {
      const stopped = stopTimer(state, Number.isFinite(now) ? now : Date.now());
      stopped.gameEnded = true;
      stopped.won = false;
      stopped.paused = false;
      stopped.lastMessage = "失败：明错误已超过 " + stopped.maxMistakes + " 次，只能重新开局。";
      stopped.lastMessageTone = "error";
      return stopped;
    }

    function maybeWin(state, now) {
      if (countRemaining(state.current) === 0 && conflictIndexes(state.current).size === 0) {
        return finalizeWin(state, now);
      }
      return state;
    }

    function placeNumber(state, number, now) {
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
        const noteSet = new Set(next.notes[state.selectedIndex]);
        if (noteSet.has(number)) {
          noteSet.delete(number);
        } else {
          noteSet.add(number);
        }
        next.notes[state.selectedIndex] = Array.from(noteSet).sort(function (left, right) { return left - right; });
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
        next.lastMessage = "这一行、列或" + BOX_LABEL + "里已经有 " + formatSymbol(number) + "，错误 " + next.mistakes + "/" + next.maxMistakes + "。";
        next.lastMessageTone = "error";
        return next;
      }

      next.notes = removeNoteFromPeers(next.notes, state.selectedIndex, number);
      next.lastMessage = "已填入，当前没有明错误。";
      next.lastMessageTone = "info";
      return maybeWin(next, now);
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

    function giveHint(state, now) {
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
      const next = pushUndoState(state);
      next.current[state.selectedIndex] = next.solution[state.selectedIndex];
      next.notes[state.selectedIndex] = [];
      next.notes = removeNoteFromPeers(next.notes, state.selectedIndex, next.current[state.selectedIndex]);
      next.hintsUsed = (next.hintsUsed || 0) + 1;
      next.lastMessage = "已在当前空白格填入提示。";
      next.lastMessageTone = "info";
      return maybeWin(next, now);
    }

    function resetGame(state, now) {
      const next = cloneState(state);
      next.current = next.puzzle.slice();
      next.notes = emptyNotes();
      next.mistakes = 0;
      next.hintsUsed = 0;
      next.maxHintsPerGame = MAX_HINTS_PER_GAME;
      next.noteMode = false;
      next.paused = false;
      next.gameEnded = false;
      next.won = false;
      next.elapsedMs = 0;
      next.timerStartedAt = Number.isFinite(now) ? now : Date.now();
      next.undoStack = [];
      next.selectedIndex = findFirstPlayableIndex(next.puzzle);
      next.lastMessage = "棋盘已重置。";
      next.lastMessageTone = "info";
      return next;
    }

    function createBoardCells(state) {
      const conflicts = conflictIndexes(state.current);
      const selectedValue = state.current[state.selectedIndex];

      return state.current.map(function (value, index) {
        const noteRows = [];
        const noteHighlightRows = [];
        const noteLookup = new Set(state.notes[index]);
        for (let row = 0; row < BOX_SIZE; row += 1) {
          const rowItems = [];
          const highlightItems = [];
          for (let col = 0; col < BOX_SIZE; col += 1) {
            const number = row * BOX_SIZE + col + 1;
            rowItems.push(noteLookup.has(number) ? formatSymbol(number) : "");
            highlightItems.push(selectedValue !== 0 && noteLookup.has(number) && number === selectedValue);
          }
          noteRows.push(rowItems);
          noteHighlightRows.push(highlightItems);
        }

        return {
          index: index,
          value: value ? formatSymbol(value) : "",
          given: state.given[index],
          selected: state.selectedIndex === index,
          related: state.selectedIndex !== index && sameUnit(state.selectedIndex, index),
          match: value !== 0 && selectedValue !== 0 && value === selectedValue,
          error: conflicts.has(index),
          noteRows: noteRows,
          noteHighlightRows: noteHighlightRows,
          boxRight: ((index % GRID_SIZE) + 1) % BOX_SIZE === 0 && (index % GRID_SIZE) !== GRID_SIZE - 1,
          boxBottom: (Math.floor(index / GRID_SIZE) + 1) % BOX_SIZE === 0 && Math.floor(index / GRID_SIZE) !== GRID_SIZE - 1
        };
      });
    }

    function createNumberPad(state) {
      return Array.from({ length: GRID_SIZE }, function (_, offset) {
        const number = offset + 1;
        const remaining = digitRemaining(state.current, number);
        return {
          value: number,
          label: formatSymbol(number),
          remaining: remaining,
          complete: remaining === 0
        };
      });
    }

    function createViewModel(state, now) {
      const currentNow = Number.isFinite(now) ? now : Date.now();
      return {
        gameVersion: GAME_VERSION,
        gridSize: GRID_SIZE,
        boxSize: BOX_SIZE,
        symbols: SYMBOLS.slice(),
        difficulty: state.difficulty,
        difficultyLabel: DIFFICULTIES[sanitizeDifficulty(state.difficulty)].label,
        boardCells: createBoardCells(state),
        numberPad: createNumberPad(state),
        selectedIndex: state.selectedIndex,
        mistakes: state.mistakes,
        maxMistakes: state.maxMistakes,
        hintsUsed: state.hintsUsed,
        maxHintsPerGame: state.maxHintsPerGame,
        mistakesLabel: state.mistakes + "/" + state.maxMistakes,
        hintUsageLabel: Math.max(0, (state.maxHintsPerGame || MAX_HINTS_PER_GAME) - (state.hintsUsed || 0)) + "/" + (state.maxHintsPerGame || MAX_HINTS_PER_GAME),
        elapsedLabel: formatTime(getElapsedMs(state, currentNow)),
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

    return {
      BOX_SIZE: BOX_SIZE,
      CELL_COUNT: CELL_COUNT,
      DIFFICULTIES: DIFFICULTIES,
      GRID_SIZE: GRID_SIZE,
      MAX_MISTAKES: MAX_MISTAKES,
      SYMBOLS: SYMBOLS,
      conflictIndexes: conflictIndexes,
      createNewGame: createNewGame,
      createViewModel: createViewModel,
      eraseSelected: eraseSelected,
      formatSymbol: formatSymbol,
      formatTime: formatTime,
      getElapsedMs: getElapsedMs,
      giveHint: giveHint,
      placeNumber: placeNumber,
      resetGame: resetGame,
      restoreGame: restoreGame,
      sanitizeDifficulty: sanitizeDifficulty,
      saveArchive: saveArchive,
      selectCell: selectCell,
      toggleNoteMode: toggleNoteMode,
      togglePause: togglePause,
      undoLastEdit: undoLastEdit
    };
  }

  window.SUDOKU_ENGINES = {
    "9x9": createSudokuEngine({
      gameVersion: "9x9",
      gridSize: 9,
      boxSize: 3,
      maxMistakes: 5,
      boxLabel: "九宫格",
      difficulties: {
        easy: { key: "easy", label: "简单", blanks: 36 },
        normal: { key: "normal", label: "普通", blanks: 46 },
        hard: { key: "hard", label: "困难", blanks: 54 }
      },
      symbols: ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    }),
    "4x4": createSudokuEngine({
      gameVersion: "4x4",
      gridSize: 4,
      boxSize: 2,
      maxMistakes: 5,
      boxLabel: "四宫格",
      difficulties: {
        easy: { key: "easy", label: "简单", blanks: 5 },
        normal: { key: "normal", label: "普通", blanks: 8 },
        hard: { key: "hard", label: "困难", blanks: 11 }
      },
      symbols: ["1", "2", "3", "4"]
    }),
    "16x16": createSudokuEngine({
      gameVersion: "16x16",
      gridSize: 16,
      boxSize: 4,
      maxMistakes: 5,
      boxLabel: "十六宫区",
      enforceUnique: false,
      minUnitGivens: 3,
      difficulties: {
        easy: { key: "easy", label: "简单", blanks: 96 },
        normal: { key: "normal", label: "普通", blanks: 124 },
        hard: { key: "hard", label: "困难", blanks: 152 }
      },
      symbols: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G"]
    }),
    "25x25": createSudokuEngine({
      gameVersion: "25x25",
      gridSize: 25,
      boxSize: 5,
      maxMistakes: 7,
      boxLabel: "二十五宫区",
      enforceUnique: false,
      minUnitGivens: 4,
      difficulties: {
        easy: { key: "easy", label: "简单", blanks: 250 },
        normal: { key: "normal", label: "普通", blanks: 312 },
        hard: { key: "hard", label: "困难", blanks: 374 }
      },
      symbols: [
        "A", "B", "C", "D", "E",
        "F", "G", "H", "I", "J",
        "K", "L", "M", "N", "O",
        "P", "Q", "R", "S", "T",
        "U", "V", "W", "X", "Y"
      ]
    })
  };
})();
