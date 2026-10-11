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
  assert.equal((C.CHEER_A.length + 1) * (C.CHEER_B.length + 1) * (C.CHEER_C.length + 1) - 1, 1814);
  for (const st of C.CHEER_STAMPS) assert.ok({ A: C.CHEER_A, B: C.CHEER_B, C: C.CHEER_C }[st[0]][st[1]], st[3]);
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

test("passport nationality → country code", () => {
  const src = read("lib/countryCode.ts").replace('import { CHEER_COUNTRIES } from "@/lib/cheerText";', "const { CHEER_COUNTRIES } = require(process.env.CT_JS);");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} }; const tmp = path.join(require("os").tmpdir(), "ct-" + process.pid + ".js");
  fs.writeFileSync(tmp, ts.transpileModule(read("lib/cheerText.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
  process.env.CT_JS = tmp; new Function("module", "exports", "require", "process", out)(m, m.exports, require, process);
  const f = m.exports.toCountryCode;
  for (const [i, o] of [["IT", "IT"], ["ita", "IT"], ["Italy", "IT"], ["Italian", "IT"], ["イタリア", "IT"], ["意大利", "IT"], ["이탈리아", "IT"], ["USA", "US"], ["Korea, Republic of", "KR"], ["台灣", "TW"], ["", null], ["???", null],
    ["address:12 Via Roma, 00100 Rome, Italy", "IT"], ["address:1600 Pennsylvania Ave, Washington DC 20500, USA", "US"], ["address:123 Main St, Santa Fe, New Mexico, United States", "US"],
    ["address:Hauptstraße 5, 10115 Berlin, Deutschland", "DE"], ["address:台北市信義區市府路1號, 台灣", "TW"], ["address:서울특별시 중구, 대한민국", "KR"], ["address:Calle Mayor 1, Madrid, España", "ES"], ["address:somewhere unknown", null]]) assert.equal(f(i), o, i);
});

test("checkout step: stamps, suggestions avoid recent combos, passport preset", () => {
  const h = read("lib/checkoutPage.ts");
  assert.match(h, /pickStamps/); assert.match(h, /CH\.recent/); assert.match(h, /CH\.passport/);
  assert.match(read("app/checkout/[room]/route.ts"), /passportCountry\(resId, room\)/);
});
