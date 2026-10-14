const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("hologram: page and bundle exist, and the page loads the bundle version the iPad saves", () => {
  const lib = R("lib/cabinHolo.ts"), page = R("public/cabin/holo/index.html");
  const js = lib.match(/HOLO_JS = "([^"]+)"/)[1];
  assert.ok(page.includes(`src="${js}"`), "index.html must load " + js);
  assert.ok(fs.existsSync(path.join(root, "public", js.split("?")[0])));
  // the page itself never plays sound: it asks the parent (iPhone route)
  assert.ok(!/new AudioContext|webkitAudioContext/.test(R("public/cabin/holo/holo.js")));
});
test("hologram: every voice and sound effect file exists and is in the phone's pre-save list", () => {
  const lib = R("lib/cabinHolo.ts");
  const voices = JSON.parse("[" + lib.match(/const VOICES = \[([^\]]+)\]/)[1] + "]"), sfx = JSON.parse("[" + lib.match(/const SFX = \[([^\]]+)\]/)[1] + "]");
  const list = JSON.parse(R("public/cabin/audio/list.json")).files;
  for (const f of [...voices.map((k) => `/cabin/audio/holo/${k}.mp3`), ...sfx.map((k) => `/cabin/audio/holo/sfx-${k}.mp3`)]) {
    assert.ok(fs.existsSync(path.join(root, "public", f)), f);
    assert.ok(list.includes(f), "list.json: " + f);
  }
  const js = R("public/cabin/holo/holo.js");
  for (const k of ["boot", "scan", "split", "lock", "route", "room", "welcome"]) assert.ok(sfx.includes(k));
  assert.match(js, /"holo\/sfx-"/); assert.match(js, /"holo\/"/);
});
test("hologram: voices and SFX go through the normal say/sfx route (iPhone first, iPad fallback)", () => {
  const e = R("components/cabin/cabinEngine.ts");
  assert.match(e, /createHolo\(\{ host: \(\) => \$\("map"\), say: \(k\) => void say\(k\), sfx: \(k\) => sfx\(k\)/);
  const h = R("components/cabin/cabinHolo.ts");
  assert.match(h, /isHoloVoice\(m\.say\)\) c\.say\(m\.say\)/);
  assert.match(h, /e\.origin !== location\.origin/);
});
test("hologram: never in the way — only quiet moments, once per trip, and it yields to other events", () => {
  const e = R("components/cabin/cabinEngine.ts");
  assert.match(e, /holo\.stop\(\); chime\(\); cap\(p\.k\)/); // sightseeing
  assert.match(e, /holo\.stop\(\); const my = \+\+prepTok/); // boost prep
  assert.match(e, /holo\.stop\(\); const m = \$\("map"\), h = \$\("bhud"\)/); // boost
  assert.match(e, /cqOff\(\); holo\.stop\(\); \/\/ 着いたら/); // arrival
  assert.match(e, /voiceBusy: \(\) => voiceN > 0 \|\| holo\.on\(\)/); // ASTRAEA waits
  assert.match(e, /!holo\.on\(\)\) ai\.tick\(\)/);
  assert.match(e, /if \(!trip \|\| holoDone \|\| holo\.on\(\)/);
  assert.match(R("app/cabin/cabin.css"), /\.holoFr\{position:absolute;inset:0/); // inside the map box only (side panel + QR stay visible)
});
test("hologram: quiet rule", async () => {
  const src = R("lib/cabinHolo.ts");
  const num = (k) => Number(src.match(new RegExp(k + " = (\\d+)"))[1]);
  assert.strictEqual(num("HOLO_AUTO_AFTER_MS"), 150000);
  assert.strictEqual(num("HOLO_MIN_ETA_MIN"), 3);
  assert.match(src, /if \(s\.dir !== "in" \|\| s\.arrived \|\| s\.boosting \|\| s\.voiceBusy \|\| s\.overlay\) return false;/);
  assert.match(src, /\(HOLO_ROOMS as readonly string\[\]\)\.includes\(k\)/);
});
test("hologram: dad can start it from the phone (button + voice)", () => {
  assert.match(R("lib/cabinAiTalk.ts"), /CMD_IDS: CaptainCmdId\[\] = \[[^\]]*"holo"\]/);
  assert.match(R("lib/cabinAiTalk.ts"), /ホログラム\|ほろぐらむ\|全息/);
  assert.match(R("components/cabin/cabinAi.ts"), /cmd\.c === "holo"\) \{ c\.holo\(\)/);
  assert.match(R("components/driver/DriverCabin.tsx"), /\[QR_BTN, HOLO_BTN\]/);
});
test("hologram: no 360° photos shown to guests (floor plan instead)", () => {
  for (const f of ["public/cabin/holo/index.html", "public/holo/room.html"]) {
    const s = R(f);
    assert.doesNotMatch(s, /360° SCAN/);
    assert.doesNotMatch(s, /<img id="roomImg"/);
  }
  assert.doesNotMatch(R("public/cabin/holo/holo.js"), /data:image\/jpeg/);
  assert.doesNotMatch(R("public/holo/room.js"), /data:image\/jpeg/);
});
test("guest room UI: hologram added under the modes without changing the rest; reacts to successful controls", () => {
  const dc = R("lib/deviceClient.ts");
  assert.match(dc, /if \(res\.ok && typeof window !== "undefined"\) \{ try \{ window\.dispatchEvent\(new CustomEvent\("cn:device"/);
  const cp = R("components/ControlPanel.tsx");
  assert.match(cp, /<RoomHolo roomSlug=\{roomSlug\} roomName=\{roomName\} lang=\{lang\} \/>/);
  const rh = R("components/tech/RoomHolo.tsx");
  const v = rh.match(/HOLO_V = "([0-9a-f]+)"/)[1];
  assert.ok(R("public/holo/room.html").includes(`/holo/room.js?v=${v}`));
  assert.match(rh, /IntersectionObserver/); // only runs while visible
  assert.match(rh, /window\.addEventListener\("cn:device", onDev\)/);
  const js = R("public/holo/room.js");
  for (const a of ["welcome_cozy", "good_night", "away", "dream_fade", "galaxy_on", "nest_on", "light_on", "wafu_mode", "ac_on"]) assert.ok(js.includes(`"${a}"`), a);
  assert.ok(!/new AudioContext|webkitAudioContext/.test(js)); // the hologram is silent (the room page keeps its own sounds)
});
