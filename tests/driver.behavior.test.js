const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const load = (f) => import(path.join(root, "lib", f));

const NOW = Date.parse("2026-09-26T01:00:00Z"); // 日本時間 10:00
const R = (o) => ({ id: "r", roomId: "a", guest: "Li", lang: "zh", checkIn: "2026-09-26T06:00:00Z", checkOut: "2026-09-28T01:00:00Z", pin: "1234",
  pickupPlace: null, pickupAt: null, pickupNone: false, flightNo: null, flightInfo: null, flightCheckedAt: null, preparedAt: null, ...o });

test("driver: today's board, next arrival and auto-prepare timing (JST)", async () => {
  const L = await load("driverLogic.ts");
  const a = R({ id: "1", checkIn: "2026-09-26T07:00:00Z" });
  const b = R({ id: "2", checkIn: "2026-09-26T05:00:00Z", pickupAt: "2026-09-26T08:00:00Z", preparedAt: "2026-09-26T00:30:00Z" });
  const out = R({ id: "3", checkIn: "2026-09-24T06:00:00Z", checkOut: "2026-09-26T01:30:00Z" });
  const stay = R({ id: "4", checkIn: "2026-09-25T06:00:00Z", checkOut: "2026-09-27T01:00:00Z" });
  const later = R({ id: "5", checkIn: "2026-09-27T15:30:00Z" }); // 日本時間 9/28 00:30
  const bd = L.todayBoard([a, b, out, stay, later], NOW);
  assert.deepEqual(bd.arrivals.map((r) => r.id), ["1", "2"], "sorted by pickup time");
  assert.deepEqual(bd.departures.map((r) => r.id), ["3"]);
  assert.deepEqual(bd.staying.map((r) => r.id), ["4"]);
  assert.equal(L.nextArrival(bd).id, "1", "first not prepared");
  assert.deepEqual(L.upcomingArrivals([a, later], NOW, 3).map((r) => r.id), ["5"]);
  assert.equal(L.jstTime("2026-09-26T07:00:00Z"), "16:00");
  assert.equal(L.prepDue(a, NOW, 30), false, "too early");
  assert.equal(L.prepDue(a, Date.parse("2026-09-26T06:31:00Z"), 30), true, "30 min before");
  assert.equal(L.prepDue(b, Date.parse("2026-09-26T07:40:00Z"), 30), false, "already prepared");
  assert.equal(L.prepDue(later, Date.parse("2026-09-27T14:50:00Z"), 60), false, "not today (JST) yet");
  assert.equal(L.prepDue(later, Date.parse("2026-09-27T15:05:00Z"), 60), true, "after JST midnight");
  assert.equal(L.langOf("zh-TW"), "zh"); assert.equal(L.langOf("ko-KR"), "ko"); assert.equal(L.langOf("fr"), "en"); assert.equal(L.langOf(null), "en");
});

test("driver: lock battery only 3 days before check-in / every 60 days when idle, replace if it won't last", async () => {
  const L = await load("driverLogic.ts");
  const rooms = [{ id: "a", hasLock: true }, { id: "b", hasLock: true }, { id: "c", hasLock: false }, { id: "d", hasLock: true }];
  const res = [R({ roomId: "a", checkIn: "2026-09-29T06:00:00Z" }), R({ id: "x", roomId: "d", checkIn: "2026-09-26T06:00:00Z" })];
  const t = L.batteryTargets(rooms, res, { b: "2026-09-01T00:00:00Z" }, NOW);
  assert.deepEqual(t.map((x) => [x.roomId, x.reason]), [["a", "checkin"]], "b checked 25 days ago, c has no lock, d is busy");
  assert.deepEqual(L.batteryTargets(rooms, res, { a: "2026-09-24T00:00:00Z", b: "2026-07-01T00:00:00Z" }, NOW).map((x) => x.roomId), ["b"], "a checked 2 days ago, b over 60 days");
  assert.equal(L.batteryVerdict(25, [], NOW, NOW).replace, true, "no history: below 30");
  assert.equal(L.batteryVerdict(45, [], NOW, NOW).replace, false);
  const logs = [{ battery: 80, checked_at: "2026-07-28T00:00:00Z" }, { battery: 50, checked_at: "2026-09-26T00:00:00Z" }]; // 0.5%/日
  const v = L.batteryVerdict(50, logs, NOW, NOW + 50 * 86400e3);
  assert.equal(v.predicted, 25); assert.equal(v.replace, false);
  assert.equal(L.batteryVerdict(50, logs, NOW, NOW + 70 * 86400e3).replace, true, "would drop below 20 before check-out");
});

test("driver: LRC lyrics parse, current line and round trip", async () => {
  const L = await load("driverLogic.ts");
  const lines = L.parseLrc("[ti:x]\n[00:12.50]hello\n[00:05.00][01:00.00]again\n[00:20]\n");
  assert.deepEqual(lines, [{ t: 5, s: "again" }, { t: 12.5, s: "hello" }, { t: 60, s: "again" }]);
  assert.equal(L.lyricIndex(lines, 1), -1); assert.equal(L.lyricIndex(lines, 12.46), 1); assert.equal(L.lyricIndex(lines, 99), 2);
  assert.deepEqual(L.parseLrc(L.toLrc(lines)), lines);
  // いろいろな書き方の LRC (Windows 改行・BOM・[mm:ss:xx]・3 桁ミリ秒・offset・1 語ごとのタイム)
  const v = L.parseLrc("\uFEFF[offset:+500]\r\n[00:10:50]a\r\n[0:20.125]<00:20.20>b <00:21.00>c\r[100:00]d");
  assert.deepEqual(v, [{ t: 10, s: "a" }, { t: 19.625, s: "b c" }, { t: 5999.5, s: "d" }]);
  const enc = (s) => new TextEncoder().encode(s);
  assert.equal(L.decodeLrcBytes(enc("[00:01]你好")), "[00:01]你好");
  const u16 = Buffer.from("\ufeff[00:01]歌", "utf16le");
  assert.equal(L.decodeLrcBytes(new Uint8Array(u16)).replace(/^\uFEFF/, ""), "[00:01]歌");
  const gbk = new Uint8Array([0x5b, 0x30, 0x30, 0x3a, 0x30, 0x31, 0x5d, 0xc4, 0xe3, 0xba, 0xc3]); // [00:01]你好 (GBK)
  assert.equal(L.parseLrc(L.decodeLrcBytes(gbk))[0].s, "你好");
});

test("driver: flight summary picks the Japan arrival leg and computes delay", async () => {
  const L = await load("driverLogic.ts");
  const f = L.summarizeFlight([
    { status: "Expected", departure: { airport: { iata: "TPE" } }, arrival: { airport: { iata: "KIX" }, terminal: "1", gate: "B2",
      scheduledTime: { utc: "2026-09-26 06:00Z" }, revisedTime: { utc: "2026-09-26 06:25Z" } } },
  ]);
  assert.equal(f.from, "TPE"); assert.equal(f.to, "KIX"); assert.equal(f.terminal, "1"); assert.equal(f.delayMin, 25);
  assert.equal(L.summarizeFlight([]), null);
});

test("driver: guide text fills values safely and skips missing steps", async () => {
  const G = await load("driverGuide.ts");
  const s = G.guideSteps("en", { code: "<9>", pin: "1234", ssid: null, pass: null });
  assert.equal(s.length, 4, "no Wi-Fi step");
  assert.equal(s[0].big, "&lt;9&gt; ✓");
  assert.equal(s[1].big, "PIN 1234");
  for (const l of ["en", "zh", "ko", "ja"]) assert.equal(G.GUIDE[l].length, 5);
});

test("driver: Simplified Chinese is the default and every screen string is translated", async () => {
  const I = await load("driverI18n.ts");
  const zh = I.makeT("zh"), ja = I.makeT("ja");
  assert.equal(zh("お迎え"), "接机"); assert.equal(zh("様"), "贵宾");
  assert.equal(zh("あと {n}分", { n: 5 }), "还有 5 分钟"); assert.equal(ja("あと {n}分", { n: 5 }), "あと 5分");
  const src = read("components", "driver", "DriverApp.tsx") + read("components", "driver", "DriverMusic.tsx");
  const keys = new Set([...src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/\bt\(\s*[^")][^,)]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"(?:\s*:\s*"([^"]+)")?/g)) [m[1], m[2], m[3]].filter(Boolean).forEach((k) => keys.add(k));
  const dict = read("lib", "driverI18n.ts");
  const missing = [...keys].filter((k) => /[぀-ヿ一-鿿]/.test(k) && zh(k) === k && !dict.includes(JSON.stringify(k) + ":"));
  assert.deepEqual(missing, []);
  const app = read("components", "driver", "DriverApp.tsx");
  assert.match(app, /useState<UiLang>\("zh"\)/, "default zh");
  assert.match(app, /localStorage\.getItem\("drvLang"\)/);
});

test("driver: page is staff-only, sheets/voices/sw in place, API use kept small", () => {
  const page = read("app", "driver", "page.tsx");
  assert.match(page, /if \(!isStaff\(\)\) redirect\("\/staff\/login\?next=\/driver"\)/);
  const acts = read("app", "driver", "actions.ts");
  assert.match(acts, /requireStaff/);
  const app = read("components", "driver", "DriverApp.tsx");
  for (const k of [...app.matchAll(/say\(\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1])))
    assert.ok(fs.existsSync(path.join(root, "public", "audio", "driver", `${k}.mp3`)), `voice ${k}.mp3`);
  for (const f of ["boot.jpg", "dash.jpg", "nav.jpg", "icon.png", "icon-192.png", "apple-touch-icon.png", "manifest.webmanifest"]) assert.ok(fs.existsSync(path.join(root, "public", "driver", f)), f);
  assert.ok(fs.existsSync(path.join(root, "public", "driver-sw.js")));
  const css = read("app", "driver", "driver.css");
  assert.doesNotMatch(css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""), /(^|\})\s*\.(?!drv)[a-z]/m, "every rule scoped under .drv");
  // 飛行機: 便名がなければ API を呼ばない
  const flight = read("lib", "flight.ts");
  assert.match(flight, /AERODATABOX_KEY/);
  const sql = read("supabase", "migration_driver.sql");
  for (const tb of ["driver_places", "driver_tracks", "lock_battery_logs", "driver_alerts", "driver_flight_usage"]) assert.match(sql, new RegExp(`create table if not exists (public\\.)?${tb}`));
});
