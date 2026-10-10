const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

test("concierge: after the 4 digits, move to /g/[own room]?k=… so the home-screen icon opens without the digits", () => {
  const r = read("app/g/[room]/route.ts");
  assert.match(r, /guideAccessByKey\(params\.room, k\)/);
  assert.match(r, /if \(acc\.guest\) return NextResponse\.redirect\([\s\S]{0,120}guideKeyFor\(acc\.guest\)/);
  assert.match(r, /res\.cookies\.set\(c\.name, c\.value, \{ httpOnly: true, secure: true/);
});

test("concierge key: signed, scoped, checked against the live reservation, ends at check-out (+3h after the button)", () => {
  const g = read("lib/nfcGate.ts");
  assert.match(g, /const GUIDE_SCOPE = "guide"/);
  assert.match(g, /verifyScopedSession\(GUIDE_SCOPE, k\)/);
  assert.match(g, /keyStateFor\(r, now\)/);
  assert.match(g, /LEFT_GRACE_MS = 3 \* 3600e3/);
  // 共用ページは自分の部屋へ
  assert.match(g, /if \(!hit && guest\) return \{ ok: false, redirect:/);
});

test("home-screen icon per room season", () => {
  const n = read("lib/nfcGuide.ts");
  assert.match(n, /"春": "spring", "夏": "summer", "秋": "autumn", "冬": "winter"/);
  assert.match(n, /apple-touch-icon/);
  for (const s of ["spring", "summer", "autumn", "winter"]) for (const z of [180, 192])
    assert.ok(fs.existsSync(path.join(__dirname, "..", "public", "nfc", "home", `${s}-${z}.png`)), `${s}-${z}`);
  assert.match(read("lib/nfcPage.ts"), /<!--HOME-->/);
});
