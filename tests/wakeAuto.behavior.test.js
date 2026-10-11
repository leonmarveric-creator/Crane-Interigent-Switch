const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const out = ts.transpileModule(read("lib/wakeAutoLogic.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const W = { exports: {} }; new Function("module", "exports", "require", out)(W, W.exports, require);
const J = (s) => Date.parse(`${s}+09:00`);

test("wake = departure − 45 min; flight only → departure = flight − 2h40", () => {
  const p = W.exports.planWake({ date: "2026-10-12", departAt: "04:50", flightAt: null }, "2026-10-12T01:00:00Z");
  assert.equal(p.wakeMs, J("2026-10-12T04:05:00"));
  assert.equal(p.showFromMs, J("2026-10-11T20:00:00"));
  assert.equal(p.minMs, J("2026-10-12T02:50:00")); assert.equal(p.maxMs, J("2026-10-12T04:40:00"));
  const q = W.exports.planWake({ date: "2026-10-12", departAt: null, flightAt: "2026-10-11T22:30:00Z" }, "2026-10-12T01:00:00Z");
  assert.equal(W.exports.hmJst(q.departMs), "4:50"); assert.equal(W.exports.hmJst(q.wakeMs), "4:05");
});

test("only early wakes (before 7:00 JST)", () => {
  assert.equal(W.exports.planWake({ date: "2026-10-12", departAt: "08:30", flightAt: null }, "2026-10-12T01:00:00Z"), null);
  assert.ok(W.exports.planWake({ date: "2026-10-12", departAt: "07:40", flightAt: null }, "2026-10-12T01:00:00Z"));
  assert.equal(W.exports.planWake(null, "2026-10-12T01:00:00Z"), null);
});

test("guest time HH:MM is placed before departure", () => {
  const p = W.exports.planWake({ date: "2026-10-12", departAt: "05:00", flightAt: null }, "2026-10-12T01:00:00Z");
  assert.equal(W.exports.wakeFromHm("4:20", p), J("2026-10-12T04:20:00"));
  assert.equal(W.exports.wakeFromHm("23:50", { departMs: J("2026-10-12T00:30:00") }), J("2026-10-11T23:50:00"));
  assert.equal(W.exports.wakeFromHm("9999", p), null);
});

test("wired: cron sync, good-night gate, three panels and concierge", () => {
  assert.match(read("app/api/cron/wake-alarm/route.ts"), /syncAutoWakes\(nowMs\)/);
  assert.match(read("lib/deviceClient.ts"), /action === "good_night" && goodNightGate/);
  for (const f of ["components/ControlPanel.tsx", "components/LiteControlPanel.tsx", "components/MagicalControlPanel.tsx"]) assert.match(read(f), /<WakeAutoBanner /, f);
  assert.match(read("lib/nfcPage.ts"), /renderWake\(\)/);
  const s = read("lib/wakeAuto.ts");
  assert.match(s, /if \(alarm && alarm\.source !== "auto"\) continue;/); // ゲストのもの・変えたものは触らない
  assert.match(s, /wake_auto_off: true/);
});
