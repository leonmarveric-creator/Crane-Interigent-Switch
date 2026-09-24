const assert = require("node:assert/strict");
const test = require("node:test");
const { parseVoiceCommand: p } = require("../lib/voiceCommand.ts");

const ALL = { hasGalaxy: true, hasNest: true, hasWafu: true };

test("voice: galaxy on/off in 4 languages", () => {
  for (const s of ["ギャラクシーモードオン", "ギャラクシーつけて", "星空にして", "Galaxy on", "Turn on the stars", "打开星空", "银河模式", "갤럭시 켜줘"])
    assert.equal(p(s, ALL), "galaxy_on", s);
  for (const s of ["ギャラクシーオフ", "星消して", "Galaxy off", "turn off the stars", "关闭星空", "갤럭시 꺼줘"])
    assert.equal(p(s, ALL), "galaxy_off", s);
});

test("voice: nest / cozy / normal / comfort", () => {
  assert.equal(p("ネストモードオン", ALL), "nest_on");
  assert.equal(p("nest off", ALL), "nest_off");
  assert.equal(p("和みモード", ALL), "welcome_cozy");
  assert.equal(p("和风模式", ALL), "welcome_cozy");
  assert.equal(p("ノーマル", ALL), "normal");
  assert.equal(p("快適モード", ALL), "welcome");
  assert.equal(p("comfort mode", ALL), "welcome");
});

test("voice: devices", () => {
  assert.equal(p("エアコンつけて", ALL), "ac_on");
  assert.equal(p("冷房オン", ALL), "ac_on");
  assert.equal(p("AC on", ALL), "ac_on");
  assert.equal(p("turn off the air con", ALL), "ac_off");
  assert.equal(p("エアコン消して", ALL), "ac_off");
  assert.equal(p("电灯关", ALL), "light_off");
  assert.equal(p("开灯", ALL), "light_on");
  assert.equal(p("関灯".replace("関", "关"), ALL), "light_off");
  assert.equal(p("照明オフ", ALL), "light_off");
  assert.equal(p("lights on", ALL), "light_on");
  assert.equal(p("조명 꺼", ALL), "light_off");
  assert.equal(p("和風ライト消して", ALL), "wafu_off");
  assert.equal(p("和風ライトつけて", ALL), "wafu_on");
});

test("voice: scenes", () => {
  assert.equal(p("おやすみ", ALL), "good_night");
  assert.equal(p("Good night", ALL), "good_night");
  assert.equal(p("晚安", ALL), "good_night");
  assert.equal(p("外出", ALL), "away");
  assert.equal(p("行ってきます", ALL), "away");
  assert.equal(p("全部オフ", ALL), "away");
});

test("voice: no false hits, nothing for locks, missing devices ignored", () => {
  assert.equal(p("エアコンつけてほしい", ALL), "ac_on");
  assert.equal(p("鍵を開けて", ALL), null);
  assert.equal(p("unlock the door", ALL), null);
  assert.equal(p("こんにちは", ALL), null);
  assert.equal(p("ギャラクシーオン", {}), null);
  assert.equal(p("和風ライト消して", {}), null);
  assert.equal(p(["えーと", "エアコンオン"], ALL), "ac_on");
});

test("voice UI: mic sits in the mode header and every target button listens; locks never listen", () => {
  const fs = require("node:fs"); const path = require("node:path");
  const cp = fs.readFileSync(path.join(__dirname, "../components/ControlPanel.tsx"), "utf8");
  assert.match(cp, /voiceSlot=\{<VoiceMic/);
  const count = (cp.match(/useVoiceAction\(/g) || []).length;
  assert.ok(count >= 4, "ModeGrid, SceneButtons, ToggleCard, WafuCard");
  const lock = cp.slice(cp.indexOf("function LockCard"), cp.indexOf("function ToggleCard"));
  assert.doesNotMatch(lock, /useVoiceAction/);
  const vm = fs.readFileSync(path.join(__dirname, "../components/tech/VoiceMic.tsx"), "utf8");
  assert.match(vm, /webkitSpeechRecognition/);
  assert.doesNotMatch(vm, /\b(blip|sweep|powerUp|powerDown|galaxyOn|toggleServo)\(/, "mic adds no new sound effects");
});
