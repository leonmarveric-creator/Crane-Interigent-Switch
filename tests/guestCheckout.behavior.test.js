const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
function load(rel) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} };
  new Function("module", "exports", "require", out)(m, m.exports, require);
  return m.exports;
}
const C = load("lib/checkoutText.ts");
const jst = (s) => Date.parse(`${s}+09:00`);

test("checkout button: from 6:00 JST on the check-out day until the check-out time", () => {
  const out = new Date(jst("2026-10-11T10:00:00")).toISOString();
  assert.equal(C.checkoutWindow(out, jst("2026-10-10T22:00:00")).open, false);
  assert.equal(C.checkoutWindow(out, jst("2026-10-11T05:59:00")).open, false);
  assert.equal(C.checkoutWindow(out, jst("2026-10-11T06:00:00")).open, true);
  assert.equal(C.checkoutWindow(out, jst("2026-10-11T09:59:00")).open, true);
  assert.equal(C.checkoutWindow(out, jst("2026-10-11T10:00:00")).open, false);
  assert.equal(C.coTime(out), "10:00");
});

test("checkout texts: four languages, same six items, consent wording present", () => {
  for (const l of ["ja", "en", "zh", "ko"]) {
    const t = C.CO_T[l];
    assert.equal(t.items.length, 6, l);
    assert.ok(t.policy.length > 20 && t.agree.length > 5, l);
    assert.ok(t.all && t.none, l);
  }
  assert.match(C.CO_T.ja.policy, /警察署/);
  assert.equal(C.coLang("zh-TW"), "zh");
  assert.equal(C.coLang("fr"), "en");
});

test("after checkout: room controls, effects, alarms and keys are stopped", () => {
  assert.match(read("app/api/devices/[room_id]/route.ts"), /guest_checkout_at[\s\S]{0,120}CHECKED_OUT/);
  assert.match(read("app/api/effects/[room_id]/route.ts"), /guest_checkout_at[\s\S]{0,120}CHECKED_OUT/);
  assert.match(read("app/api/alarms/[room_id]/route.ts"), /guest_checkout_at[\s\S]{0,120}CHECKED_OUT/);
  assert.match(read("lib/smartkeyLogic.ts"), /if \(r\.guest_checkout_at\) return "expired"/);
  assert.match(read("app/room/[room_id]/page.tsx"), /matched\.guest_checkout_at[\s\S]{0,200}CheckedOutScreen/);
});

test("checkout records consent first, then turns the room off like 'away'", () => {
  const s = read("lib/guestCheckout.ts");
  const ins = s.indexOf('from("guest_checkouts").insert'), up = s.indexOf("guest_checkout_at: at"), off = s.indexOf('executeDeviceAction(s.room, "away"');
  assert.ok(ins > 0 && up > ins && off > up, "order: record → reservation → power off");
  assert.match(s, /from\("alarms"\)\.delete\(\)/);
});

test("banner is on all three room UIs and the concierge", () => {
  for (const f of ["components/ControlPanel.tsx", "components/LiteControlPanel.tsx", "components/MagicalControlPanel.tsx"]) {
    assert.match(read(f), /<CheckoutBanner /, f);
  }
  assert.match(read("lib/nfcPage.ts"), /id=\\"cob\\"/);
  assert.match(read("lib/nfcPage.ts"), /renderCo\(\)/);
});
