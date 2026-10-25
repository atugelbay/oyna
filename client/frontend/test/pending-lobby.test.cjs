const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const compiled = ts.transpileModule(
  readFileSync(path.join(__dirname, "../src/lib/pending-lobby.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function freshPage(localStorage) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, window: { localStorage } });
  return exports;
}

test("QR persists through reload and authentication, then clears only after successful join", () => {
  const local = storage();
  freshPage(local).rememberLobby("arena-token");
  const authPage = freshPage(local);
  assert.equal(authPage.afterAuthentication(), "/j/arena-token");
  assert.equal(authPage.afterAuthentication(), "/j/arena-token");
  const lobbyPage = freshPage(local);
  assert.equal(lobbyPage.pendingLobby().token, "arena-token");
  lobbyPage.completeLobby("arena-token");
  assert.equal(freshPage(local).afterAuthentication(), "/home");
});

test("joining an older room never deletes a newer QR scanned in another tab", () => {
  const local = storage();
  const page = freshPage(local);
  page.rememberLobby("first");
  freshPage(local).rememberLobby("second");
  page.completeLobby("first");
  assert.equal(page.afterAuthentication(), "/j/second");
});

test("corrupt or forged stored URLs cannot redirect authentication outside the lobby", () => {
  for (const raw of [
    "not-json",
    "null",
    JSON.stringify({ token: "abc", path: "//evil.test", savedAt: 1 }),
    JSON.stringify({ token: "", path: "/j/", savedAt: 1 }),
  ]) {
    const local = storage();
    local.setItem("oyna_pending_lobby", raw);
    assert.equal(freshPage(local).afterAuthentication(), "/home");
  }
});

test("valid phone formats normalize consistently; malformed identifiers do not become phone numbers", () => {
  const { normalizePhone } = freshPage(storage());
  for (const value of ["+7 (700) 123-45-67", "87001234567", "7001234567"])
    assert.equal(normalizePhone(value), "+77001234567");
  for (const value of [
    "player_123",
    "123",
    "+17001234567",
    "letters7001234567",
  ])
    assert.equal(normalizePhone(value), null);
});
