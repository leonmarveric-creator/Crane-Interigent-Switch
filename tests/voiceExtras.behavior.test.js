const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { fxPlan, fxFrameCommands, drawFortune, jstDayKey, LIGHT_FX, FX_DAILY_LIMIT } = require("../lib/lightEffects.ts");
const { roomAssistant } = require("../lib/roomAssistant.ts");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

test("room assistants: full name on screen, given name in voice, season rooms", () => {
  const cases = [
    ["room-aki", "KUREHA AKARI", "Akari", "autumn"], ["room-haru", "TURUNE SAKURA", "Sakura", "spring"],
    ["room-natsu", "HISUI MIO", "Mio", "summer"], ["room-fuyu", "SETSUI GEKKA", "Gekka", "winter"],
    ["room-ume", "KOUBAI AYANO", "Ayano", null], ["room-take", "HARUKA SUGETSU", "Sugetsu", null],
    ["room-matsu", "MATSUNO SEIRIN", "Seirin", null], ["room-hayashi", "MORISAKI KOTOHA", "Kotoha", null],
    ["room-ni", "RENKA AYANO", "Ayano", null],
  ];
  const sfx = read("lib", "sfx.ts");
  for (const [slug, name, given, season] of cases) {
    const a = roomAssistant(slug);
    assert.equal(a.name, name, slug);
    assert.equal(a.voice, `I am ${given}, your room assistant.`, slug);
    assert.equal(a.season, season, slug);
    const m = sfx.match(new RegExp(`"${a.voice.replace(/\./g, "\\.")}": "([^"]+)"`));
    assert.ok(m && fs.existsSync(path.join(__dirname, "..", "public", "audio", "voice", "current", m[1])), `voice file for ${slug}`);
  }
  assert.equal(roomAssistant("x", "秋").name, "KUREHA AKARI");
  assert.equal(roomAssistant("room-unknown"), null);
});

test("light effects: about a minute, few API calls, capped per day", () => {
  assert.equal(FX_DAILY_LIMIT, 30);
  for (const fx of LIGHT_FX) {
    const p = fxPlan(fx);
    assert.ok(p.frames.length * p.intervalMs <= 65000, fx);
    let calls = 0;
    for (let i = 0; i < p.frames.length; i++) calls += fxFrameCommands(fx, i).length;
    assert.ok(calls <= 30, `${fx} uses ${calls} calls`);
    assert.equal(fxFrameCommands(fx, 0)[0].action, "wafu_on");
    assert.deepEqual(fxFrameCommands(fx, p.frames.length), []);
  }
});

test("omikuji: same result for the same room and day", () => {
  const a = drawFortune("room-aki", "2026-09-25");
  assert.deepEqual(a, drawFortune("room-aki", "2026-09-25"));
  assert.match(a.rgb, /^\d+:\d+:\d+$/);
  assert.equal(jstDayKey(Date.parse("2026-09-24T15:30:00Z")), "2026-09-25");
});

test("voice extras: wired in VoiceMic, effects API stops on guest actions and keeps sounds", () => {
  const vm = read("components", "tech", "VoiceMic.tsx");
  assert.match(vm, /parseVoiceExtra\(cands\)/);
  assert.ok(vm.indexOf("parseVoiceQuestion(cands)") < vm.indexOf("parseVoiceExtra(cands)"), "questions first");
  assert.match(vm, /overrideNextVoice\(line\)/);
  assert.match(vm, /assistant\?\.season !== season/);
  const api = read("app", "api", "effects", "[room_id]", "route.ts");
  assert.match(api, /FX_DAILY_LIMIT/);
  assert.match(api, /stop: true/);
  assert.match(api, /authorizeRoomRequest/);
  const sfx = read("lib", "sfx.ts");
  assert.match(sfx, /export function overrideNextVoice/);
});
