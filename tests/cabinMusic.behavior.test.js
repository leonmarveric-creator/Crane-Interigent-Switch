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
  assert.equal(A.AI_GAP_MS, 60000, "a remark about every minute (3 minutes of silence was too long)");
  assert.ok(A.AI_FACT_MS <= 90000, "small talk after a short silence");
  assert.deepEqual(A.AI_SPEED, ["spd80", "spd100", "spd120", "spd140"], "a humorous line at 80 / 100 / 120 / 140 km/h");
  assert.equal(A.AI_CHAT_MS, 180000, "small talk about every 3 minutes");
  for (const id of ["half", "km5", "km1", "soon", "sea", "izumi", "bridge", "topspeed"]) assert.ok(A.AI_PRIORITY.includes(id), `${id} always spoken`);
  assert.ok(A.AI_LINES.chat.v.length >= 10, "plenty of small talk");
  const ai = read("components", "cabin", "cabinAi.ts");
  assert.match(ai, /const k = s\.kmh \?\? 0, lv = k >= 140 \? 140 : k >= 120 \? 120 : k >= 100 \? 100 : k >= 80 \? 80 : 0/, "speed levels");
  assert.match(ai, /if \(lv > spdLv && done\.has\("depart"\)\) \{ if \(\+\+spdN >= 4\)/, "only after 4 seconds above the level (GPS noise)");
  const D = await load("cabinDeadheadLines.ts");
  for (const k of [...Object.values(D.DH_SPD).flat(), ...Object.values(D.DH_IDLE).flat()]) {
    assert.ok(D.DH_LINES[k]?.ja && D.DH_LINES[k]?.en, k);
    assert.ok(fs.existsSync(path.join(root, "public", "cabin", "audio", "dh", `${k}.mp3`)), `dh/${k}.mp3`);
  }
  assert.match(read("components", "cabin", "cabinDeadhead.ts"), /Date\.now\(\) - idleAt > 180000/, "deadhead: a remark about every 3 minutes");
  assert.match(ai, /c\.voiceBusy\(\) \|\| \(s\.boosting/, "never over the guide voice or boost");
  assert.match(ai, /if \(c\.quiet\(\) && id !== "tap"/, "quiet mode");
  assert.match(ai, /c\.duck\(12\)/, "dad's music is lowered first");
  const M = await load("cabinMusic.ts"); assert.equal(M.cleanCmd("duck", 12).v, 12); assert.equal(M.cleanCmd("duck", null), null);
  assert.match(read("components", "driver", "DriverMusic.tsx"), /if \(c === "duck"\)/);
  assert.match(read("supabase", "migration_cabin_ai.sql"), /add column if not exists ai_quiet boolean/);
  assert.ok(!read("app", "cabin", "cabin.css").includes("ai-talk .holo"), "lyrics keep flowing while ASTRAEA talks");
  assert.match(read("components", "cabin", "cabinNowPlaying.ts"), /行全体を光らせる/, "lyrics light a whole line (no drifting karaoke fill)");
});

test("ASTRAEA talk: guest menu, captain commands by voice/buttons, check-in QR, entrance guide on demand, detour re-route", async () => {
  const K = await load("cabinAiTalk.ts");
  assert.equal(K.matchCaptain("阿斯特莱亚，办理入住"), "checkin");
  assert.equal(K.matchCaptain("アストレア、状況は？"), "status");
  assert.equal(K.matchCaptain("讲个笑话"), "joke");
  assert.equal(K.matchCaptain("部屋の開け方を教えて"), "guide", "guide wins over room");
  assert.equal(K.matchCaptain("准备房间"), "room");
  assert.equal(K.matchCaptain("今日はいい天気だね"), null);
  assert.deepEqual([K.weatherAnswer(0), K.weatherAnswer(61), K.weatherAnswer(3)], [0, 1, 2]);
  for (const u of K.talkAudioUrls()) assert.ok(fs.existsSync(path.join(root, "public", u)), u);
  for (const l of ["ja", "zh", "en", "ko"]) { assert.ok(K.GUIDE_T[l].t1 && K.GUIDE_T[l].snap); assert.equal(K.CHECKIN_T[l][1].length, 3); }
  const act = read("app", "driver", "actions.ts");
  assert.match(act, /export async function cabinAiCmd/); assert.match(act, /c === "room" && t\.room_id/, "room prep really turns devices on");
  assert.match(act, /export async function cabinSetCheckinQr/);
  const sql = read("supabase", "migration_cabin_ai.sql");
  assert.match(sql, /add column if not exists ai_cmd jsonb/); assert.match(sql, /app_settings add column if not exists cabin_checkin_qr text/);
  const drv = read("components", "driver", "DriverCabin.tsx");
  assert.match(drv, /webkitSpeechRecognition/); assert.match(drv, /運転中は助手席の方が操作してください/);
  assert.ok(!/moving|kmh\s*>\s*\d+.*disabled/.test(drv.slice(drv.indexOf("function AstraeaSheet"))), "no driving lock (passenger may operate)");
  const ai = read("components", "cabin", "cabinAi.ts");
  assert.match(ai, /if \(lastCmd == null\) \{ lastCmd = cmd\.n; if \(Date\.now\(\) - cmd\.n > 20000\) return; \}/, "old commands are not replayed");
  const eng = read("components", "cabin", "cabinEngine.ts");
  assert.match(eng, /if \(k === "gEnt"\) guide\.start\("ent"\); else if \(k === "gRoom"\) \{ if \(guide\.hasRoom\(\)\) guide\.start\("room"\); else lock\.start\(\); \} else if \(k === "gToilet"\) toilet\.start\(\)/, "guide buttons on the arrival screen");
  assert.ok(!/guide\.start\(\)[^\n]*arrive\(\)/.test(eng), "guide never auto-plays");
  assert.match(eng, /async function reroute\(from: LL\)/); assert.match(eng, /backN >= 3 \? pr\.d : prevD/, "turning back is followed");
  assert.match(read("app", "api", "cabin", "state", "route.ts"), /op === "lights"/);
});

test("Summer room guide: room keypad, turning steps, opposite-knob warning, smart-key QR, summary", async () => {
  const K = await load("cabinAiTalk.ts");
  assert.equal(K.roomGuideOf("room-summer"), "natsu"); assert.equal(K.roomGuideOf("natsu"), "natsu");
  assert.equal(K.roomGuideOf("room-autumn"), null, "other rooms wait for their own guide"); assert.equal(K.roomGuideOf(null), null);
  for (const k of ["intro", "s1", "s2", "s3", "room", "r1", "r2", "r3", "r4", "smart", "photo"]) {
    assert.ok(fs.existsSync(path.join(root, "public", K.guideAudio(k))), k);
    for (const l of ["ja", "zh", "en", "ko"]) assert.ok(K.GUIDE_VOICE[k][l], k + l);
  }
  for (const l of ["ja", "zh", "en", "ko"]) for (const k of ["t4", "t5", "t6", "t7", "d7", "t8", "d8", "k1", "k2", "rec", "p21", "p22", "p23", "p51", "p52", "p53", "c2", "c5", "tr", "tl"]) assert.ok(K.GUIDE_T[l][k], l + k);
  const g = read("components", "cabin", "cabinGuide.ts");
  assert.match(g, /id="gdPr2"/); assert.match(g, /id="gdPr5"/); assert.match(g, /pr\("gdPr5", 3\)/, "turning steps light in order");
  assert.match(g, /\[7, "r4", a7\]/, "opposite-knob warning scene"); assert.match(g, /show\(8\); await Promise\.all\(\[say\("smart"\)/, "smart-key QR scene");
  assert.match(g, /card\(n0 \+ 1, cls, ""[^\n]*T\.c5/, "summary carries the room turning steps"); assert.match(g, /gcRec/);
  const css = read("app", "cabin", "cabin.css");
  for (const c of [".gdPr", ".gdSmart", ".gdQs", ".gcRec"]) assert.ok(css.includes(c), c);
});
test("guide summary shows the turning direction; intro makes no false time promise", async () => { const K = await load("cabinAiTalk.ts"); assert.ok(!/30/.test(K.GUIDE_VOICE.intro.en + K.GUIDE_VOICE.intro.ja)); const g = read("components", "cabin", "cabinGuide.ts"); assert.match(g, /turn\("gdMa2", 0, 90, [^\n]*"R"/); assert.match(g, /turn\("gdMa5", -60, -180, [^\n]*"L"/); });

test("drop-off: forgotten-item check right after departure (4 random lines), no false 'room locked' claim", async () => {
  const A = await load("cabinAiLines.ts");
  assert.equal(A.AI_LINES.forgot.v.length, 4); assert.ok(!("locked" in A.AI_LINES));
  for (const v of A.AI_LINES.forgot.v) { assert.ok(!/driver|ドライバー|locked|戸締まり/.test(v.en + v.ja)); for (const l of ["en", "ja", "zh", "ko"]) assert.ok(v[l]); }
  for (let i = 0; i < 4; i++) assert.ok(fs.existsSync(path.join(root, "public", A.aiAudio("forgot", i))));
  const ai = read("components", "cabin", "cabinAi.ts");
  assert.match(ai, /once\("depart", s\.dir === "in" \? "depart" : "forgot", \{ force: true \}\)/);
  assert.match(ai, /s\.dir === "out" && el2 > 80\) once\("review", "review"\)/);
});

test("arrival screen: separate guides (entrance / room / restroom), restroom has no photo step, trip waits while a guide plays", async () => {
  const eng = read("components", "cabin", "cabinEngine.ts"), mk = read("components", "cabin", "cabinMarkup.ts");
  for (const q of ["gEnt", "gRoom", "gToilet"]) assert.ok(mk.includes(`data-q="${q}"`), q);
  assert.match(eng, /const endIfIdle = \(\) => \{ if \(guide\.on\(\) \|\| toilet\.on\(\) \|\| lock\.on\(\)\) T_\(30000, endIfIdle\)/);
  const t = read("components", "cabin", "cabinToilet.ts");
  assert.ok(!/gdSnap|tlFlash/.test(t), "no photo step for the restroom");
  const T = await load("cabinToilet.ts");
  for (const k of ["intro", "t1", "t2", "t3", "end"]) assert.ok(fs.existsSync(path.join(root, "public", T.toiletAudio(k))), k);
  assert.ok(!/photo/i.test(T.TOILET_VOICE.end.en));
  for (const f of ["toilet-guide.jpg", "toilet-uv.jpg"]) assert.ok(fs.existsSync(path.join(root, "public", "cabin", "img", f)), f);
  const g = read("components", "cabin", "cabinGuide.ts");
  assert.match(g, /export type GuideScope = "all" \| "ent" \| "room"/);
});

test("voices always play on iPad: every player is unlocked on the first tap and retried once; room photo is labelled as a photo", () => {
  const eng = read("components", "cabin", "cabinEngine.ts");
  assert.match(eng, /ai\.preload\(\); ai\.unlock\(\); guide\.unlock\(\); toilet\.unlock\(\);/);
  for (const f of ["cabinAi.ts", "cabinGuide.ts", "cabinToilet.ts", "cabinEngine.ts"]) assert.match(read("components", "cabin", f), /playSafe\(/, f);
  assert.ok(!read("components", "cabin", "cabinMarkup.ts").includes("● LIVE"), "no LIVE label on the room photo");
  assert.match(eng, /ja: "📷 イメージ写真"/);
});

test("voices come out of the phone (Bluetooth): iPad queues them, phone polls and plays; guides stay on the iPad", () => {
  const eng = read("components", "cabin", "cabinEngine.ts"), ai = read("components", "cabin", "cabinAi.ts");
  assert.match(eng, /const remote = \(\) => !!trip && !trip\.id\.startsWith\("demo"\) && Date\.now\(\) - phoneSeen < 12000/, "falls back to the iPad when the phone is not polling");
  assert.match(eng, /hooks\.onSay\?\.\(trip!\.id, AUDIO \+ k \+ "\.mp3", ""\)/);
  assert.match(ai, /if \(rm\) \{ c\.send\(url, line\.en\)/);
  assert.match(read("app", "api", "cabin", "state", "route.ts"), /b\.op === "say"/);
  assert.match(read("app", "api", "cabin", "voice", "route.ts"), /voice_seen/);
  assert.match(read("components", "driver", "DriverCabin.tsx"), /startRemoteVoice\(trip\.id/);
  assert.match(read("components", "kaku", "kakuEngine.ts"), /rv = startRemoteVoice\(r\.id/);
  assert.ok(!/onSay|remote\(\)/.test(read("components", "cabin", "cabinGuide.ts") + read("components", "cabin", "cabinToilet.ts")), "room / restroom guides keep playing on the iPad");
  assert.ok(read("supabase", "migration_cabin_voice.sql").includes("voice_q"));
});

test("room lock guide (spring / autumn / winter): button on the arrival screen, real photos, 4 languages + voice; everything is saved to the iPad", async () => {
  const L = await load("cabinLock.ts");
  for (const k of Object.keys(L.LOCK_VOICE)) {
    for (const l of ["en", "ja", "zh", "ko"]) assert.ok(L.LOCK_VOICE[k][l].length > 5, `${k} ${l}`);
    assert.ok(fs.existsSync(path.join(root, "public", "cabin", "audio", "ai", `lock-${k}.mp3`)), `lock-${k}.mp3`);
  }
  for (const u of Object.values(L.LOCK_IMG)) assert.ok(fs.existsSync(path.join(root, "public", u)), u);
  assert.equal(L.hasRoomLock("room-spring"), true); assert.equal(L.hasRoomLock("room-autumn"), true); assert.equal(L.hasRoomLock("room-winter"), true);
  assert.equal(L.hasRoomLock("room-summer"), false, "summer keeps its own guide");
  assert.match(L.LOCK_VOICE.k1.en, /close the door first.*right, clockwise.*Vertical means locked/i);
  assert.match(L.LOCK_VOICE.k2.en, /left, counterclockwise.*Horizontal means unlocked/i);
  const e = read("components", "cabin", "cabinEngine.ts");
  assert.match(e, /if \(guide\.hasRoom\(\)\) guide\.start\("room"\); else lock\.start\(\);/, "the room button starts the lock guide for spring/autumn/winter");
  assert.match(e, /guide\.hasRoom\(\) \|\| lk \? "" : "none"/);
  const app = read("components", "cabin", "CabinApp.tsx");
  assert.match(app, /map\(lockAudio\), \.\.\.Object\.values\(LOCK_IMG\)/, "lock guide is saved with 📥");
  assert.match(app, /map\(toiletAudio\), \.\.\.Object\.values\(TOILET_IMG\)/, "restroom guide is saved with 📥");
  assert.match(app, /Object\.keys\(DH_LINES\)\.map\(dhAudio\)/, "deadhead voices are saved with 📥");
  assert.match(read("public", "cabin-sw.js"), /cabin-static-v2/, "cache version bumped so replaced voices are fetched again");
  assert.match(read("lib", "cabinAiTalk.ts"), /Socks are perfectly fine/, "no need to be barefoot");
  assert.match(L.LOCK_VOICE.k0.en, /enter your room code.*unlock key at the bottom right.*does not lock by itself/i, "outside: code → bottom-right key; no auto-lock");
  assert.match(read("components", "cabin", "cabinLock.ts"), /room: \(\) => \{ code: string \| null; name: string \}/);
  // ブーストの効果音もスマホから (音はそのまま)
  assert.match(e, /const sfx = \(k: string\) => \{ if \(remote\(\)\) \{ hooks\.onSay\?\.\(trip!\.id, AUDIO \+ k \+ "\.mp3", SFX_MARK\)/);
  assert.match(read("components", "cabin", "cabinDeadhead.ts"), /if \(c\.remote\(\)\) \{ c\.say\(u, SFX_MARK\)/);
  assert.match(read("lib", "remoteVoice.ts"), /if \(it\.s === SFX_MARK\) \{ void playFx/, "effects play at once on the phone, without ducking");
});

test("Sky Gate boost music always returns to the normal song (voice ducking can't freeze the fade), manual pick ends boost, next bridge boosts again", () => {
  const m = read("components", "driver", "DriverMusic.tsx"), c = read("components", "driver", "DriverCabin.tsx");
  assert.match(m, /duck\(on: boolean\) \{ duckWanted\.current = on; if \(!playing \|\| switching\.current\) return;/, "no ducking while switching songs");
  assert.match(m, /setTimeout\(\(\) => fadeTo\(0, 1800\), 200\);\s*setTimeout\(async \(\) => \{\s*if \(boost\.current !== b\) return;/, "boost-out switches back on a timer, not on the fade callback");
  assert.match(m, /if \(boost\.current\) \{ dropBoost\(\); const tr = list\[i\] \?\? null;/, "picking a song during boost ends boost and plays it");
  assert.match(m, /if \(boost\.current && Date\.now\(\) - boost\.current\.at > 600000\) dropBoost\(\);/, "a stuck boost never blocks the next bridge");
  assert.match(m, /boostSafety\.current = setTimeout\(\(\) => \{ if \(boost\.current === me\) apiRef\.current\?\.boostOut\(\); \}, 480000\);/, "8-minute safety return");
  assert.match(c, /else if \(bs\.phase === "off" && boosting && mRef\.current\.inBoost\(\)\)/, "left the bridge area but still boosting → back to normal");
  // BOOST の曲は iPad の「ブースト開始 / 完了」のセリフと一緒に
  assert.match(c, /if \(\/\(en-boost-on\|dh\\\/boostIn\)\\\.mp3\$\/\.test\(u\)\) \{ clearTimeout\(gT\); if \(!mRef\.current\.inBoost\(\)\) boosting = mRef\.current\.boostIn\(300\); \}/, "boost music starts with the boost-on line");
  assert.match(c, /else if \(\/\(en-boost-off\|dh\\\/boostOut\)\\\.mp3\$\/\.test\(u\)\) \{ clearTimeout\(gT\); if \(mRef\.current\.inBoost\(\)\) \{ boosting = false; mRef\.current\.boostOut\(\); \} \}/, "fades out with the boost-complete line");
  assert.match(c, /rv\.ok\(\) \? 12000 : 5000/, "phone GPS only as a fallback when no voice comes from the iPad");
  assert.match(read("lib", "remoteVoice.ts"), /try \{ h\.onPlay\?\.\(u\); \} catch/);
  assert.match(m, /duck\(on: boolean\) \{ duckWanted\.current = on;/, "music level follows the voice after the switch");
});

test("Crane Nest link: reservation QR with the booking's token, drop-off + passport shown to dad, prefill API for the form", async () => {
  const cn = read("lib", "craneNest.ts");
  assert.match(cn, /CRANENEST_SUPABASE_URL/); assert.match(cn, /CRANENEST_SUPABASE_SERVICE_KEY/);
  assert.match(cn, /const LEGACY: Record<string, string> = \{ "105": "松", "106": "竹", "107": "林", "108": "梅", "109": "荷" \}/, "old room numbers");
  assert.match(cn, /x\.reservation_token && x\.reservation_token === r\.token/, "① token link");
  assert.match(cn, /!x\.reservation_token && x\.transfer_date === d && cnRoomKanji\(x\.room_number\) === r\.roomKanji/, "② room + checkout date");
  assert.match(read("lib", "driverData.ts"), /for \(const r of res\) r\.drop = drops\[r\.id\] \?\? null;/);
  assert.match(read("components", "driver", "DriverApp.tsx"), /<DropInfo d=\{r\.drop \?\? null\} t=\{t\} \/>/, "departure card shows the drop-off booking");
  assert.match(read("components", "driver", "DriverCabin.tsx"), /drop\?\.dest \? placeFromText\(drop\.dest, drop\.terminal\)/, "iPad sheet uses the guest's chosen destination");
  assert.match(read("app", "api", "cabin", "state", "route.ts"), /checkinLinkFor\(String\(data\.guest_token\)\)/, "iPad gets a per-reservation check-in link");
  assert.match(read("components", "cabin", "CabinApp.tsx"), /QRCode\.toDataURL\(link/);
  assert.match(read("components", "cabin", "cabinMarkup.ts"), /data-q="ck"/, "check-in button on the arrival screen");
  const api = read("app", "api", "cn", "prefill", "route.ts");
  assert.match(api, /\/\^\[a-f0-9\]\{24,128\}\$\/i\.test\(r\)/, "token format checked");
  assert.match(api, /guest: name \? name\.split\(\/\\s\+\/\)\[0\] : null/, "only the first name leaves the system");
  assert.ok(!/unlock_pin|keypad|guest_token:/.test(api.split("NextResponse.json({ ok: true")[1] || ""), "no secrets in the prefill answer");
});
