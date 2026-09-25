const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

test("wafu UI: synthesized sounds per action, ripple/stamp animation, away button at the top", () => {
  const sfx = read("lib", "wafuSfx.ts");
  assert.match(sfx, /isMuted\(\)/, "follows the mute button");
  assert.doesNotMatch(sfx, /new Audio\(|\.mp3/, "no audio files");
  for (const k of ["tap", "on", "off", "welcome", "night", "away", "unlock", "lock", "fail"]) assert.match(sfx, new RegExp(`case "${k}"`));
  const lite = read("components", "LiteControlPanel.tsx");
  assert.match(lite, /wafuSound\("tap"\)/);
  assert.match(lite, /wafuSound\(ok \? done\.sound : "fail"\)/);
  assert.match(lite, /wafu-stamp/);
  assert.ok(lite.indexOf('action="away"') < lite.indexOf('action="unlock"'), "away above the lock");
  assert.equal((lite.match(/action="away"/g) || []).length, 1);
  assert.doesNotMatch(lite, /from "framer-motion"/, "still light");
  const css = read("app", "globals.css");
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.wafu-ripple/);
});
