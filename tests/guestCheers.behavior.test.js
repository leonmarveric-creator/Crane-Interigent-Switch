const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
function load(rel) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} }; new Function("module", "exports", "require", out)(m, m.exports, require); return m.exports;
}
const C = load("lib/cheerText.ts");

test("cheer phrases: every phrase exists in all 16 languages", () => {
  for (const g of [C.CHEER_A, C.CHEER_B, C.CHEER_C]) for (const p of g) for (const l of C.CHEER_LANGS) assert.ok(p[l] && p[l].length > 1, `${p.en} / ${l}`);
  assert.equal(C.CHEER_A.length * C.CHEER_B.length * C.CHEER_C.length, 288);
});

test("cheer text: chosen parts in the country's language, skipped parts left out", () => {
  assert.equal(C.cheerText({ a: 4, b: null, c: 3 }, "en"), "Thank you so much! See you again!");
  assert.equal(C.cheerText({ a: null, b: 0, c: null }, "ja"), "お部屋がとてもきれいでした。");
  assert.equal(C.cheerLangFor("IT", "ja"), "it");
  assert.equal(C.cheerLangFor("NL", "ja"), "en");
  assert.equal(C.cheerLangFor(null, "ko"), "ko");
  assert.equal(C.cheerIdx(9, 6), null);
  assert.equal(C.cheerIdx("2", 6), 2);
});

test("checkout saves the cheer after the room is off; free text waits for approval", () => {
  const g = read("lib/guestCheckout.ts");
  assert.ok(g.indexOf('executeDeviceAction(s.room, "away"') < g.indexOf("saveCheer("));
  const s = read("lib/guestCheers.ts");
  assert.match(s, /free_status: free \? "pending" : "none"/);
  assert.match(s, /x\.free_status === "approved"/);
  assert.match(read("lib/checkoutPage.ts"), /cheer:cheerOut/);
});

test("mom's screen: staff only, entry points on today / records", () => {
  assert.match(read("app/staff/voices/route.ts"), /if \(!isStaff\(\)\)/);
  const s = read("components/staff/StaffClient.tsx");
  assert.match(s, /kind="new"/); assert.match(s, /kind="done"/); assert.match(s, /kind="rec"/);
});
