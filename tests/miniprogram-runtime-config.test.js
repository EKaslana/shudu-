const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveApiBaseUrl } = require("../miniprogram/utils/runtime-config");

test("runtime config uses local api base url in devtools", () => {
  const url = resolveApiBaseUrl({
    getSystemInfoSync() {
      return {
        platform: "devtools"
      };
    }
  });
  assert.equal(url, "http://127.0.0.1:3000");
});

test("runtime config uses production api base url outside devtools", () => {
  const url = resolveApiBaseUrl({
    getSystemInfoSync() {
      return {
        platform: "ios"
      };
    }
  });
  assert.equal(url, "https://shudu-node.onrender.com");
});
