const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../miniprogram/shared/sudoku9-engine");

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function seededRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("createNewGame builds a valid puzzle shell", () => {
  const state = engine.createNewGame({
    difficulty: "easy",
    now: 1000,
    rng: createSeededRandom(7)
  });

  assert.equal(state.current.length, 81);
  assert.equal(state.solution.length, 81);
  assert.equal(state.given.length, 81);
  assert.ok(state.current.includes(0));
  assert.equal(state.selectedIndex, state.current.findIndex((value) => value === 0));
});

test("placeNumber records mistakes on conflicts", () => {
  const base = engine.createNewGame({
    difficulty: "easy",
    now: 1000,
    rng: createSeededRandom(11)
  });
  const selectedIndex = base.current.findIndex((value) => value === 0);
  const rowStart = Math.floor(selectedIndex / 9) * 9;
  const conflictingValue = base.current.slice(rowStart, rowStart + 9).find((value) => value !== 0);

  const selected = engine.selectCell(base, selectedIndex);
  const next = engine.placeNumber(selected, conflictingValue, 1200);

  assert.equal(next.mistakes, 1);
  assert.equal(next.current[selectedIndex], conflictingValue);
  assert.match(next.lastMessage, /错误 1\/3/);
});

test("giveHint fills the selected empty cell with the solution", () => {
  const base = engine.createNewGame({
    difficulty: "normal",
    now: 1000,
    rng: createSeededRandom(13)
  });
  const selectedIndex = base.current.findIndex((value) => value === 0);
  const selected = engine.selectCell(base, selectedIndex);
  const hinted = engine.giveHint(selected, 1600);

  assert.equal(hinted.current[selectedIndex], hinted.solution[selectedIndex]);
  assert.equal(hinted.notes[selectedIndex].length, 0);
  assert.match(hinted.lastMessage, /填入提示/);
});

test("saveArchive and restoreGame keep progress intact", () => {
  let state = engine.createNewGame({
    difficulty: "hard",
    now: 1000,
    rng: createSeededRandom(17)
  });
  const selectedIndex = state.current.findIndex((value) => value === 0);
  state = engine.selectCell(state, selectedIndex);
  state = engine.toggleNoteMode(state);
  state = engine.placeNumber(state, 3, 1500);
  state = engine.toggleNoteMode(state);

  const archive = engine.saveArchive(state, 3000);
  const restored = engine.restoreGame(archive, { now: 5000 });

  assert.deepEqual(restored.current, state.current);
  assert.deepEqual(restored.notes, state.notes);
  assert.equal(restored.difficulty, state.difficulty);
  assert.equal(restored.elapsedMs, 2000);
});
