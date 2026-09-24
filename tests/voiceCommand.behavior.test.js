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
  assert.match(cp, /<VoiceMic lang=\{lang\}/);
  assert.match(cp, /pb-28/, "room at the bottom so the floating mic does not cover buttons");
  const count = (cp.match(/useVoiceAction\(/g) || []).length;
  assert.ok(count >= 4, "ModeGrid, SceneButtons, ToggleCard, WafuCard");
  const lock = cp.slice(cp.indexOf("function LockCard"), cp.indexOf("function ToggleCard"));
  assert.doesNotMatch(lock, /useVoiceAction/);
  const vm = fs.readFileSync(path.join(__dirname, "../components/tech/VoiceMic.tsx"), "utf8");
  assert.match(vm, /webkitSpeechRecognition/);
  assert.doesNotMatch(vm, /\b(blip|sweep|powerUp|powerDown|galaxyOn|toggleServo)\(/, "mic adds no new sound effects");
});

test("voice UI: floating round mic with a one-time tip in 4 languages", () => {
  const fs = require("node:fs"); const path = require("node:path");
  const vm = fs.readFileSync(path.join(__dirname, "../components/tech/VoiceMic.tsx"), "utf8");
  assert.match(vm, /fixed bottom-5 right-4/);
  assert.match(vm, /h-\[62px\] w-\[62px\]/);
  assert.match(vm, /TIP_KEY = "voiceTipSeen"/);
  assert.match(vm, /localStorage\.setItem\(TIP_KEY, "1"\)/);
  const i18n = fs.readFileSync(path.join(__dirname, "../lib/i18n.ts"), "utf8");
  for (const w of ["話して操作", "Voice control", "语音控制", "음성 조작"]) assert.ok(i18n.includes(w), w);
});

test("voice questions: Wi-Fi / check-out / entrance code / room code in 4 languages, without stealing commands", () => {
  const { parseVoiceQuestion: q, parseVoiceCommand: p } = require("../lib/voiceCommand.ts");
  for (const s of ["Wi-Fiのパスワードは？", "ワイファイ教えて", "What's the wifi password?", "wifi密码是什么", "와이파이 비밀번호", "パスワードは？"]) assert.equal(q(s), "wifi", s);
  for (const s of ["チェックアウト何時？", "何時までいられる？", "What time is check out?", "退房时间", "체크아웃 몇 시예요"]) assert.equal(q(s), "checkout", s);
  for (const s of ["エントランスの暗証番号は？", "玄関の番号教えて", "What is the entrance code?", "大门密码", "현관 비밀번호"]) assert.equal(q(s), "entrance_code", s);
  for (const s of ["部屋の暗証番号は？", "room code please", "房间密码", "방 비밀번호"]) assert.equal(q(s), "room_code", s);
  for (const s of ["ギャラクシーオン", "部屋の電気消して", "エアコンつけて", "おやすみ", "外出"]) assert.equal(q(s), null, s);
  assert.equal(p("部屋の電気消して", { hasWafu: true }), "light_off");
});

test("voice answers: shown big on screen with copy, android voice line, secrets fetched only when asked", () => {
  const fs = require("node:fs"); const path = require("node:path");
  const vm = fs.readFileSync(path.join(__dirname, "../components/tech/VoiceMic.tsx"), "utf8");
  assert.match(vm, /parseVoiceQuestion\(cands\)/);
  assert.match(vm, /fetch\(`\/api\/room-info\/\$\{roomSlug\}`/);
  assert.match(vm, /text-\[28px\]/);
  assert.match(vm, /navigator\.clipboard\.writeText/);
  const route = fs.readFileSync(path.join(__dirname, "../app/api/room-info/[room_id]/route.ts"), "utf8");
  assert.match(route, /authorizeRoomRequest/);
  assert.match(route, /show_keypad_code/);
  const sfx = fs.readFileSync(path.join(__dirname, "../lib/sfx.ts"), "utf8");
  for (const f of ["57-here-is-your-wifi-information", "58-here-is-your-check-out-time", "59-here-is-the-entrance-code", "60-here-is-your-room-code", "61-that-information-is-not-available"]) {
    assert.ok(sfx.includes(`current-natural-voice-${f}.mp3`), f);
    assert.ok(fs.existsSync(path.join(__dirname, "../public/audio/voice/current", `current-natural-voice-${f}.mp3`)), f);
  }
  const cp = fs.readFileSync(path.join(__dirname, "../components/ControlPanel.tsx"), "utf8");
  assert.doesNotMatch(cp, /wifi_password|keypad_code/, "secrets are not embedded in the page");
});
