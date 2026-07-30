const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeGameVersion } = require("../server/analytics-store");

test("normalizeGameVersion recognizes all web-playable versions", () => {
  assert.equal(normalizeGameVersion("9x9"), "9x9");
  assert.equal(normalizeGameVersion("4x4"), "4x4");
  assert.equal(normalizeGameVersion("16x16"), "16x16");
  assert.equal(normalizeGameVersion("25x25"), "25x25");
  assert.equal(normalizeGameVersion("", "/play/16x16/"), "16x16");
  assert.equal(normalizeGameVersion("", "/play/25x25/"), "25x25");
});
