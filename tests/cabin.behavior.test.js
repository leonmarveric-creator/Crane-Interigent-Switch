const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const load = (f) => import(path.join(root, "lib", f));
const routes = JSON.parse(read("public", "cabin", "routes.json"));

test("cabin: pickup place guessed from the reservation text (T1/T2, Rinku x2, Hineno)", async () => {
  const G = await load("cabinGeo.ts");
  assert.equal(G.placeFromText("関西空港 第1ターミナル"), "kix");
  assert.equal(G.placeFromText("関空 第2ターミナル"), "kix2");
  assert.equal(G.placeFromText("KIX T2"), "kix2");
  assert.equal(G.placeFromText(null, "2"), "kix2", "flight terminal 2");
  assert.equal(G.placeFromText("りんくうタウン駅"), "rinku");
  assert.equal(G.placeFromText("りんくう往来北1-833"), "r833");
  assert.equal(G.placeFromText("日根野駅"), "hineno");
  assert.equal(G.placeFromText("京都駅"), null);
  assert.equal(G.acModeFor(Date.parse("2026-08-01T00:00:00Z")), "cool");
  assert.equal(G.acModeFor(Date.parse("2026-12-01T00:00:00Z")), "heat");
  assert.deepEqual([G.bufferMin(1.7), G.bufferMin(5), G.bufferMin(16), G.bufferMin(40)], [3, 4, 6, 6], "3–6 min extra for traffic");
});

test("cabin: all 10 fixed routes start/end at the right places, ETA counts down to 0", async () => {
  const G = await load("cabinGeo.ts");
  for (const k of ["kix", "kix2", "rinku", "r833", "hineno"]) for (const dir of ["in", "out"]) {
    const r = G.makeRoute(routes[`${k}_${dir}`]);
    const a = dir === "in" ? G.PLACES[k].ll : G.CRANE_NEST, b = dir === "in" ? G.CRANE_NEST : G.PLACES[k].ll;
    assert.ok(G.dist(r.pts[0], a) < 400, `${k}_${dir} start`);
    assert.ok(G.dist(r.pts[r.pts.length - 1], b) < 400, `${k}_${dir} end`);
    const base = G.BASE_MIN[`${k}_${dir}`]; assert.ok(base >= 7 && base <= 25);
    assert.equal(G.etaMin(base, r.total, r.total), base); assert.equal(G.etaMin(base, 0, r.total), 0);
  }
  const t1 = G.makeRoute(routes.kix_in); assert.ok(Math.abs(t1.total - 11900) < 300, "T1 about 11.9 km");
  // position → progress along the route (and far away = off route)
  const mid = G.pointAt(t1, 5000), pr = G.project(t1, mid);
  assert.ok(Math.abs(pr.d - 5000) < 30 && pr.off < 5);
  assert.ok(G.project(t1, [34.30, 135.40]).off > 5000);
  assert.deepEqual(G.decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@").map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
});

test("cabin: SKY GATE BOOST starts ~300 m before the bridge at speed, ends after crossing, both directions, not in traffic", async () => {
  const G = await load("cabinGeo.ts");
  const run = (key, kmh) => {
    const r = G.makeRoute(routes[key]); let s = { ...G.BOOST_INIT }; const ev = [];
    for (let d = 0; d <= r.total; d += 40) { const p = G.pointAt(r, d); const x = G.boostStep(s, p, kmh); s = x.s; if (x.event) ev.push([x.event, Math.round(d), G.bridgePos(p)]); }
    return ev;
  };
  for (const key of ["kix_in", "kix2_in", "kix_out", "kix2_out"]) {
    const ev = run(key, 80);
    assert.deepEqual(ev.map((e) => e[0]), ["start", "end"], key);
    const pre = ev[0][2], post = ev[1][2];
    const before = key.endsWith("_in") ? (pre.t - 1) * G.BRIDGE.len : -pre.t * G.BRIDGE.len;
    assert.ok(before > -60 && before < 350, `${key}: starts just before the bridge (${Math.round(before)} m)`);
    assert.ok(key.endsWith("_in") ? post.t < 0 : post.t > 1, `${key}: ends after crossing`);
  }
  assert.deepEqual(run("kix_in", 30), [], "no boost in a traffic jam");
  assert.deepEqual(run("rinku_in", 80), [], "station routes never boost");
});

test("cabin: sights along each route; room photos (summer = 4th photo, winter = 2nd)", async () => {
  const G = await load("cabinGeo.ts");
  assert.deepEqual(G.poisFor(G.makeRoute(routes.kix_in), "in").sort(), ["bridge", "izumi", "rinku"]);
  assert.ok(!G.poisFor(G.makeRoute(routes.kix_out), "out").includes("izumi"), "no 'welcome to Izumisano' when leaving");
  const P = await load("cabinPhotos.ts");
  const pick = (slug) => P.DEFAULT_PHOTO.find(([re]) => re.test(slug))[1];
  assert.deepEqual(["room-spring", "room-summer", "room-autumn", "room-winter"].map(pick), ["r1", "r4", "r3", "r2"]);
  for (const k of Object.keys(P.BUILTIN_PHOTOS)) assert.ok(fs.existsSync(path.join(root, "public", P.BUILTIN_PHOTOS[k].src)), k);
});

test("cabin: every voice the iPad plays exists (English only) and assets are local", () => {
  const eng = read("components", "cabin", "cabinEngine.ts");
  const keys = ["en-arrive", "en-bridge", "en-rinku", "en-izumi", "en-boost-on", "en-boost-off", "boost-sfx", "boost-end",
    ...["kix", "kix2", "rinku", "r833", "hineno", "other"].flatMap((k) => [`en-${k}_in-go`, `en-${k}_out-go`, `en-${k}_out-arrive`])];
  for (const k of keys) {
    const f = path.join(root, "public", "cabin", "audio", k + ".mp3");
    if (/_in-go|_out-go|_out-arrive/.test(k) || !k.startsWith("en-kix_in")) assert.ok(fs.existsSync(f), k);
  }
  assert.ok(!fs.readdirSync(path.join(root, "public", "cabin", "audio")).some((f) => f.startsWith("zh-")), "no Chinese voice files");
  assert.match(eng, /void say\(`en-\$\{p\.k\}`\)/, "sight voices are English");
  assert.ok(fs.existsSync(path.join(root, "public", "cabin", "leaflet", "leaflet.js")), "map library is served from our own site");
  const sw = read("public", "cabin-sw.js");
  assert.match(sw, /precache/); assert.match(sw, /\/cabin\\\/\.\+\\\.\(mp3/);
});

test("cabin: phone → iPad flow (auth, SQL, boost music, GPS relay keeps the screen on)", () => {
  const api = read("app", "api", "cabin", "state", "route.ts");
  assert.match(api, /if \(!isStaff\(\)\) return J\(\{ ok: false, error: "UNAUTHORIZED" \}, 401\)/g);
  const sql = read("supabase", "migration_cabin.sql");
  for (const s of ["create table if not exists public.cabin_devices", "create table if not exists public.cabin_trips", "check (purpose in ('in', 'out', 'boost'))", "add column if not exists start_sec", "add column if not exists cabin_photo", "add column if not exists cabin_spots", "enable row level security"]) assert.ok(sql.includes(s), s);
  const act = read("app", "driver", "actions.ts");
  for (const f of ["cabinStart", "cabinPos", "cabinEnd", "cabinSetRoomPhoto", "cabinPhotoUploadUrl"]) assert.match(act, new RegExp(`export async function ${f}\\(`));
  assert.match(act, /\.eq\("status", "active"\)\.select\("id"\)/, "position only for an active trip");
  const cab = read("components", "driver", "DriverCabin.tsx");
  assert.match(cab, /boostIn\(5000\)/); assert.match(cab, /boostOut\(\)/); assert.match(cab, /wakeLock/);
  const mus = read("components", "driver", "DriverMusic.tsx");
  assert.match(mus, /x\.purpose === "boost"/); assert.match(mus, /a\.currentTime = tr\.startSec/);
  assert.match(read("app", "staff", "login", "page.tsx"), /"\/cabin": "車内 iPad"/);
});

test("cabin: can be added to the home screen (own manifest opening /cabin, icons, full screen)", () => {
  const m = JSON.parse(read("public", "cabin", "manifest.webmanifest"));
  assert.equal(m.start_url, "/cabin"); assert.equal(m.id, "/cabin"); assert.equal(m.display, "standalone");
  assert.equal(m.scope, "/", "login page stays inside the home-screen app");
  for (const f of ["icon.png", "icon-192.png", "apple-touch-icon.png"]) assert.ok(fs.existsSync(path.join(root, "public", "cabin", f)), f);
  const lay = read("app", "cabin", "layout.tsx");
  assert.match(lay, /manifest: "\/cabin\/manifest\.webmanifest"/); assert.match(lay, /apple-touch-icon/); assert.match(lay, /capable: true/);
});
