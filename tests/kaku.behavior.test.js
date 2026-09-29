const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const load = (f) => import(path.join(root, "lib", f));

test("AGENT KAKU: own home-screen app (/kaku) behind the staff login", () => {
  const man = JSON.parse(read("public", "kaku", "manifest.webmanifest"));
  assert.equal(man.start_url, "/kaku"); assert.equal(man.scope, "/kaku"); assert.equal(man.display, "standalone");
  for (const i of man.icons) assert.ok(fs.existsSync(path.join(root, "public", i.src.split("?")[0])), i.src);
  assert.ok(fs.existsSync(path.join(root, "public", "kaku", "apple-touch-icon.png")));
  assert.match(read("app", "kaku", "layout.tsx"), /manifest: "\/kaku\/manifest\.webmanifest"/);
  assert.match(read("app", "kaku", "page.tsx"), /if \(!isStaff\(\)\) redirect\("\/staff\/login\?next=\/kaku"\)/);
  const api = read("app", "api", "kaku", "route.ts");
  assert.equal((api.match(/if \(!isStaff\(\)\) return J\(\{ ok: false, error: "UNAUTHORIZED" \}, 401\)/g) || []).length, 2, "GET and POST need login");
  for (const s of ["kaku_places", "kaku_missions", "kaku_bgm_normal", "kaku_bgm_cruise"]) assert.ok(read("supabase", "migration_kaku.sql").includes(s), s);
  for (const f of ["boot.webp", "home.webp", "hud.webp"]) assert.ok(fs.existsSync(path.join(root, "public", "kaku", f)), f);
});

test("AGENT KAKU: every ASTRAEA line has a voice and a subtitle (numbers filled in on the spot)", async () => {
  const K = await load("kakuLines.ts");
  const dyn = new Set(["ask_eta", "ask_conv", "ask_stats", "fbrief"]);
  for (const [k, v] of Object.entries(K.KAKU_LINES)) {
    assert.ok(v.en, k); if (!dyn.has(k)) assert.ok(v.ja, k);
    assert.ok(fs.existsSync(path.join(root, "public", K.kakuAudio(k))), k);
    assert.ok(!/JARVIS|Jarvis/.test(v.en + v.ja), "no copyrighted names");
  }
  for (const t of Object.values(K.TYPE_LINE)) assert.ok(K.KAKU_LINES[t], t);
  for (const t of [...Object.values(K.ARRIVE_LINE), ...Object.values(K.RETURN_LINE)]) assert.ok(K.KAKU_LINES[t], t);
  assert.ok(!/two guests|Room Natsu|eighteen minutes/.test(K.KAKU_LINES.gbrief.en + K.KAKU_LINES.go.en), "guest brief is not tied to one booking");
  assert.ok(!/driver knows|locked/.test(K.KAKU_LINES.farrive.en));
});

test("AGENT KAKU: engine rules (GPS, arrival, reroute, cruise, quiet chat, no log in demo)", () => {
  const e = read("components", "kaku", "kakuEngine.ts");
  assert.match(e, /navigator\.geolocation\.watchPosition/);
  assert.match(e, /if \(near < 60 \|\| \(near < 300 && gpsKmh < 5/, "arrives at the target (or stopped close to it)");
  assert.match(e, /Date\.now\(\) - offT > 20000 && Date\.now\(\) - lastReroute > 60000/, "reroutes after a detour");
  assert.match(e, /const cr = br \|\| hwOn/, "cruise on the bridge or the expressway");
  assert.match(e, /const CHAT_GAP = 180000/, "3 minutes between remarks");
  assert.match(e, /if \(cfg\.quiet && !prio\) return/, "quiet mode keeps only guidance and warnings");
  assert.match(e, /if \(!M\.demo\) \{\s*void post\(\{ op: "log"/, "demo drives are not recorded");
  assert.match(e, /wakeLock\(true\)/, "screen stays on during a mission");
  assert.ok(!read("app", "kaku", "kaku.css").includes(".kk .edge.on"), "no glowing screen edge in cruise mode");
});

test("AGENT KAKU drives the car iPad for the whole mission (deadhead → guest aboard → return)", () => {
  const e = read("components", "kaku", "kakuEngine.ts");
  assert.match(e, /dir: G\.dir, leg: 0 \}/, "iPad links from the first leg");
  assert.match(e, /phase: c\.dir === "in" \? "dead" : "guest"/, "pickup starts as deadhead");
  assert.match(e, /if \(M\.cab\?\.leg === 0\) void cabBegin\(\)/);
  assert.match(e, /else if \(M\.cab\?\.dir === "in" && cabTrip && leg === 1\) void cab\.board\(cabTrip\)/, "leaving the pickup = guest boarded");
  assert.match(e, /if \(M\.cab && cabTrip && l\.home\) \{/, "keeps sending until back at Crane Nest");
  assert.match(e, /cabStop\(true\)/, "abort ends the iPad trip");
  assert.match(read("components", "kaku", "KakuApp.tsx"), /import \{ cabinStart, cabinPos, cabinEnd, cabinBoard \} from "@\/app\/driver\/actions"/);
  assert.match(read("app", "staff", "login", "page.tsx"), /"\/kaku": "AGENT KAKU"/, "login returns to /kaku");
});

test("deadhead: blue co-pilot screen on the iPad, voices from the phone, guides stay on the iPad", () => {
  const dh = read("components", "cabin", "cabinDeadhead.ts"), app = read("components", "cabin", "CabinApp.tsx"), api = read("app", "api", "cabin", "state", "route.ts");
  assert.match(app, /t\.phase === "dead"/, "iPad switches to the deadhead screen");
  assert.match(api, /op === "board"|"board"/, "board op");
  assert.match(api, /"deadhead"/, "drop-off turns into the return leg");
  assert.match(read("components", "driver", "DriverCabin.tsx"), /cabinBoard/, "phone has a guest boarded button");
  assert.ok(dh.length > 1000);
  assert.ok(!read("components", "cabin", "cabinGuide.ts").includes("onSay"), "guides play on the iPad");
  assert.ok(!read("components", "cabin", "cabinToilet.ts").includes("onSay"), "restroom guide plays on the iPad");
});

test("AGENT KAKU: portrait/landscape, lock-on TARGET REACHED, new boot sound + uploadable boot BGM", () => {
  const e = read("components", "kaku", "kakuEngine.ts"), css = read("app", "kaku", "kaku.css");
  assert.match(e, /const W = land \? 1448 : 1086, H = land \? 1086 : 1448/);
  assert.ok(css.includes(".kk .stage.land"), "landscape layout");
  assert.match(e, /function showReached\(l: Leg\)/); assert.match(read("components", "kaku", "kakuMarkup.ts"), /LOCK CONFIRMED/);
  assert.match(e, /function powerUp\(\)/); assert.match(e, /function impact\(\)/);
  assert.match(e, /const MODES: BgmMode\[\] = \["boot", "normal", "cruise"\]/);
  assert.match(read("components", "kaku", "kakuMarkup.ts"), /id="upB"/);
  assert.match(read("app", "api", "kaku", "route.ts"), /b\.which === "boot" \? "boot"/);
  assert.ok(read("supabase", "migration_kaku.sql").includes("kaku_bgm_boot"));
});

test("AGENT KAKU playlists: many tracks per mode, order/shuffle, reorder/delete, next button, normal resumes after cruise", () => {
  const e = read("components", "kaku", "kakuEngine.ts"), api = read("app", "api", "kaku", "route.ts"), mk = read("components", "kaku", "kakuMarkup.ts");
  assert.ok(read("supabase", "migration_kaku.sql").includes("create table if not exists public.kaku_tracks"));
  for (const op of ["trackAdd", "trackDel", "trackOrder"]) assert.ok(api.includes(`b.op === "${op}"`), op);
  for (const id of ["upB", "upN", "upC"]) assert.match(mk, new RegExp(`multiple id="${id}"`));
  assert.match(mk, /id="npN">⏭/); assert.match(mk, /id="shTg"/);
  assert.match(e, /a\.onended = \(\) => nextTrack\(m\)/, "next track when one ends");
  assert.match(e, /if \(cfg\.shuffle\) for \(let i = n - 1/, "shuffle");
  assert.match(e, /else if \(to === 0\) a\.pause\(\)/, "fading out pauses (keeps the position) so normal resumes after cruise");
});
