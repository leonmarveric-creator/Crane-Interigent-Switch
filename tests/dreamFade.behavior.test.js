const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { dreamFadeTarget, dreamFadeAtStep, dreamFadeColorChanged, DREAM_FADE_MS, DREAM_FADE_STEPS, DREAM_FADE_START } = require("../lib/dreamFade.ts");
const { parseVoiceCommand } = require("../lib/voiceCommand.ts");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

test("dream fade: 30 minutes, dims steadily, warmer at the end, then off", () => {
  assert.equal(DREAM_FADE_MS, 30 * 60 * 1000);
  let prev = DREAM_FADE_START.brightness + 1;
  for (let s = 1; s <= DREAM_FADE_STEPS; s++) {
    const t = dreamFadeAtStep(s);
    assert.equal(t.done, false);
    assert.ok(t.brightness <= prev && t.brightness >= 1, `step ${s}`);
    prev = t.brightness;
  }
  assert.equal(dreamFadeAtStep(1).color.kind, "temp");
  assert.equal(dreamFadeAtStep(DREAM_FADE_STEPS).color.kind, "rgb");
  assert.equal(dreamFadeTarget(0).step, 1);
  assert.equal(dreamFadeTarget(DREAM_FADE_MS - 1).step, DREAM_FADE_STEPS);
  assert.equal(dreamFadeTarget(DREAM_FADE_MS).done, true);
  assert.equal(dreamFadeTarget(DREAM_FADE_MS * 3).done, true, "late cron still turns off");
  assert.equal(dreamFadeColorChanged(0, dreamFadeAtStep(1)), false);
  assert.equal(dreamFadeColorChanged(7, dreamFadeAtStep(8)), true);
});

test("dream fade: server action, cancel on other light actions, cron hook, SQL", () => {
  const dc = read("lib", "deviceControl.ts");
  const c = dc.slice(dc.indexOf('case "dream_fade"'), dc.indexOf('case "good_night"'));
  assert.match(c, /lightTurnOff/);
  assert.match(c, /switchbot_galaxy_device_id/);
  assert.match(c, /switchbot_nest_device_id/);
  assert.doesNotMatch(c, /acTurnOff/, "air-con untouched");
  assert.match(dc, /DREAM_FADE_CANCEL\.has\(action\)/);
  assert.match(read("app", "api", "cron", "wake-alarm", "route.ts"), /runDreamFade\(/);
  assert.match(read("supabase", "migration_dream_fade.sql"), /dream_fade_started_at/);
});

test("dream fade: in tech / lite / magical UIs with an explanation; good night stays", () => {
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /action: "dream_fade"/);
  assert.match(cp, /t\.dreamSteps\.map/);
  assert.match(cp, /run\("good_night"\)/);
  for (const f of ["LiteControlPanel.tsx", "MagicalControlPanel.tsx"]) {
    const s = read("components", f);
    assert.match(s, /action="dream_fade"/);
    assert.match(s, /action="good_night"/);
    assert.match(s, /t\.dreamSteps\.map/);
  }
  assert.equal(parseVoiceCommand("ドリームフェード", { hasWafu: true }), "dream_fade");
  assert.equal(parseVoiceCommand("Dream fade", { hasWafu: true }), "dream_fade");
  assert.equal(parseVoiceCommand("おやすみ", { hasWafu: true }), "good_night");
});

test("dream fade explanation appears only after pressing (no always-visible info), and closes itself", () => {
  const cp = read("components", "ControlPanel.tsx");
  assert.doesNotMatch(cp, /aria-label=\{t\.dreamInfoTitle\}/, "no pre-press info button");
  assert.match(cp, /if \(m\.k === "dream"\) setDreamInfo\(true\)/);
  for (const f of ["ControlPanel.tsx", "LiteControlPanel.tsx", "MagicalControlPanel.tsx"]) {
    const s = read("components", f);
    assert.doesNotMatch(s, /<details[^>]*>\s*<summary[^>]*>[^<]*\{t\.dream/, f);
    assert.match(s, /setTimeout\(\(\) => setDreamInfo\(false\), 20000\)/, f);
  }
});
