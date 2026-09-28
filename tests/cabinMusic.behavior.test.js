const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const load = (f) => import(path.join(root, "lib", f));
const ID = "33333333-3333-3333-3333-333333333333";

test("cabin music: phone now-playing is cleaned, and the iPad moves the position on by itself between updates", async () => {
  const M = await load("cabinMusic.ts");
  assert.equal(M.cleanNowPlaying(null), null);
  assert.equal(M.cleanNowPlaying({ id: "x", pos: 1 }), null, "bad id");
  assert.equal(M.cleanNowPlaying({ id: ID, pos: "a" }), null, "bad pos");
  assert.deepEqual(M.cleanNowPlaying({ id: ID, pos: 12.3456, dur: 200, on: 1 }), { id: ID, pos: 12.35, dur: 200, on: true });
  const np = M.toNowPlaying({ id: ID, pos: 10, dur: 30, on: true, at: 1000 });
  assert.equal(M.npPos(np, 4000), 13, "3 s later");
  assert.equal(M.npPos(np, 4000, 1000), 14, "server clock 1 s ahead");
  assert.equal(M.npPos(np, 999999), 30, "never past the end");
  assert.equal(M.npPos({ ...np, on: false }, 9000), 10, "paused stays");
  assert.equal(M.npStale(np, 1000 + 19000), false); assert.equal(M.npStale(np, 1000 + 21000), true, "phone stopped sending → hide");
  assert.equal(M.toNowPlaying({ id: ID, pos: 1 }), null, "no time → ignore");
});

test("cabin music: iPad buttons → phone commands (only known ones, seek needs a time)", async () => {
  const M = await load("cabinMusic.ts");
  for (const c of ["toggle", "next", "prev"]) assert.equal(M.cleanCmd(c, null).c, c);
  assert.equal(M.cleanCmd("seek", null), null); assert.equal(M.cleanCmd("seek", 42).v, 42);
  assert.equal(M.cleanCmd("rm -rf", 1), null);
  const route = read("app", "api", "cabin", "state", "route.ts");
  assert.match(route, /op === "cmd"/); assert.match(route, /music_cmd: cmd/);
  assert.match(route, /trip\?\.np && trip\.np\.id !== have/, "track details only when the song changed");
  const drv = read("components", "driver", "DriverCabin.tsx");
  assert.match(drv, /mRef\.current\.nowPlaying\(\)/, "phone sends the song every 3 s");
  assert.match(drv, /mRef\.current\.remote\(r\.cmd\.c, r\.cmd\.v\)/, "phone obeys the iPad");
  assert.match(drv, /if \(lastCmd == null\) lastCmd = r\.cmd\?\.n \?\? 0/, "an old command is not replayed");
  const act = read("app", "driver", "actions.ts");
  assert.match(act, /now_playing\|music_cmd/, "works before the SQL is run (GPS still sent)");
  const mus = read("components", "driver", "DriverMusic.tsx");
  assert.match(mus, /if \(boost\.current\) return; \/\/ 高速モード中は触らない/);
  assert.match(read("supabase", "migration_cabin_music.sql"), /add column if not exists now_playing jsonb[\s\S]*add column if not exists music_cmd jsonb/);
});

test("cabin: arrival screen QR → the usual entrance key / room pages in the guest's language (no secrets in the QR)", async () => {
  const M = await load("cabinMusic.ts");
  assert.deepEqual(M.qrUrls("https://x.app/", { roomSlug: "room-autumn", entrance: "crane-nest" }, "zh"), { key: "https://x.app/key/crane-nest?lang=zh", room: "https://x.app/room/room-autumn?lang=zh" });
  assert.deepEqual(M.qrUrls("https://x.app", { roomSlug: "r", entrance: null }, "en"), { key: null, room: "https://x.app/room/r?lang=en" });
  assert.deepEqual(M.qrUrls("https://x.app", null, "en"), { key: null, room: null });
  for (const l of ["ja", "zh", "en", "ko"]) { const T = M.MUSIC_T[l]; assert.equal(T.qSteps.key.length, 3); assert.ok(T.qKey && T.qRoom && T.toastCmd); }
  const eng = read("components", "cabin", "cabinEngine.ts");
  assert.match(eng, /trip\?\.dir === "out"[^;]*"none"/, "not shown when seeing guests off");
  assert.match(eng, /setTimeout\(qrHide, 120000\)/, "closes by itself");
  const mk = read("components", "cabin", "cabinMarkup.ts");
  for (const id of ["aq", "qrp", "qrSvg", "holo", "hLine", "npfull", "f2Now", "f2RSlot", "npFullBtn"]) assert.match(mk, new RegExp(`id="${id}"`), id);
  assert.ok(fs.existsSync(path.join(root, "public", "cabin", "bay.webp")));
  assert.match(M.locName([34.426, 135.2792]), /SKY GATE/); assert.equal(M.locName(null), "OSAKA BAY");
});

test("cabin: full-screen lyrics borrow the live map and room card, and give them back", async () => {
  const v = read("components", "cabin", "cabinNowPlaying.ts");
  assert.match(v, /appendChild\(mp\); \$\("f2RSlot"\)\.appendChild\(rb\)/);
  assert.match(v, /h\.m\[0\]\.insertBefore\(mp, h\.m\[1\]\); h\.r\[0\]\.insertBefore\(rb, h\.r\[1\]\)/);
  assert.match(v, /if \(now - fxLast < 32\) return/, "effects capped at 30 fps");
  const css = read("app", "cabin", "cabin.css");
  assert.match(css, /\.cab \.stage\.trip\.np-on\[data-np="C"\] \.npfull\{display:block\}/);
});

test("cabin: turning the iPad switches between the landscape (1180x820) and portrait (820x1180) layouts", () => {
  const eng = read("components", "cabin", "cabinEngine.ts");
  assert.match(eng, /const port = window\.innerHeight > window\.innerWidth \* 1\.05/);
  assert.match(eng, /const W = port \? 820 : 1180, H = port \? 1180 : 820/);
  assert.match(eng, /npv\.relayout\(\)/, "full screen redraws the bay photo and refits map + room");
  assert.match(read("components", "cabin", "CabinApp.tsx"), /orientationchange/);
  const css = read("app", "cabin", "cabin.css");
  for (const s of [".cab .stage.port{width:820px;height:1180px}", ".cab .stage.port .scr{grid-template-columns:1fr", ".cab .stage.port .f2right{", ".cab .stage.port .qrbody{flex-direction:column"]) assert.ok(css.includes(s), s);
  const man = JSON.parse(read("public", "cabin", "manifest.webmanifest"));
  assert.equal(man.orientation, "any", "home-screen app may rotate");
  assert.ok(man.icons.every((i) => i.src.includes("?v=2")), "new icon is picked up");
});

test("cabin AI ASTRAEA: every line has 4 languages and its own voice file; picks vary; sunset/zorome helpers", async () => {
  const A = await load("cabinAiLines.ts");
  const ids = Object.keys(A.AI_LINES); assert.ok(ids.length >= 35);
  for (const id of ids) A.AI_LINES[id].v.forEach((v, i) => {
    for (const l of ["en", "ja", "zh", "ko"]) assert.ok(v[l] && v[l].length > 3, `${id}-${i} ${l}`);
    assert.ok(fs.existsSync(path.join(root, "public", "cabin", "audio", "ai", `${id}-${i}.mp3`)), `${id}-${i}.mp3`);
  });
  assert.ok(!JSON.stringify(A.AI_LINES).includes("Crane,"), "old name gone");
  assert.equal(A.aiPick("song", 0, 0), 1, "never the same line twice in a row");
  const ss = A.sunsetMin(Date.parse("2026-09-28T03:00:00Z")); assert.ok(ss > 17 * 60 + 30 && ss < 18 * 60, "Izumisano sunset in late Sept ≈ 17:45");
  assert.equal(A.zorome(11, 11), true); assert.equal(A.zorome(12, 34), true); assert.equal(A.zorome(11, 12), false);
  assert.equal(A.AI_GAP_MS, 180000, "at most one remark every 3 minutes");
  const ai = read("components", "cabin", "cabinAi.ts");
  assert.match(ai, /c\.voiceBusy\(\) \|\| \(s\.boosting/, "never over the guide voice or boost");
  assert.match(ai, /if \(c\.quiet\(\) && id !== "tap"/, "quiet mode");
  assert.match(ai, /c\.duck\(12\)/, "dad's music is lowered first");
  const M = await load("cabinMusic.ts"); assert.equal(M.cleanCmd("duck", 12).v, 12); assert.equal(M.cleanCmd("duck", null), null);
  assert.match(read("components", "driver", "DriverMusic.tsx"), /if \(c === "duck"\)/);
  assert.match(read("supabase", "migration_cabin_ai.sql"), /add column if not exists ai_quiet boolean/);
  assert.ok(!read("app", "cabin", "cabin.css").includes("ai-talk .holo"), "lyrics keep flowing while ASTRAEA talks");
  assert.match(read("components", "cabin", "cabinNowPlaying.ts"), /行全体を光らせる/, "lyrics light a whole line (no drifting karaoke fill)");
});
