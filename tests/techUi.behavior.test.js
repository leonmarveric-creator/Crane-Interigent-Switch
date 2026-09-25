const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

test("high-tech UI uses the new arc reactor (header, boot, loader) and respects reduced motion", () => {
  const rx = read("components", "tech", "ArcReactorX.tsx");
  assert.match(rx, /rx-coil/);
  assert.match(rx, /progress/);
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /<ArcReactorX size=\{52\} active=\{ambientOn\}/);
  assert.match(cp, /<ArcReactorX size=\{190\} active progress=\{charged\}/);
  assert.match(cp, /useParallax\(mainRef\)/);
  assert.doesNotMatch(cp, /function ArcReactor\(/);
  assert.match(read("components", "HudLoader.tsx"), /<ArcReactorX size=\{210\} active progress=\{p\}/);
  const css = read("app", "globals.css");
  assert.match(css, /@keyframes rx-coil/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.rx-root \* \{ animation: none !important; \}/);
});

test("reactor parts rotate around the reactor center (no wobble) and percent uses the HUD readout", () => {
  const rx = read("components", "tech", "ArcReactorX.tsx");
  assert.match(rx, /transformBox: "view-box", transformOrigin: "100px 100px"/);
  assert.doesNotMatch(rx, /transformBox: "fill-box"/);
  assert.match(read("components", "HudLoader.tsx"), /<TechPercent /);
  assert.match(read("components", "ControlPanel.tsx"), /<TechPercent value=\{charged\}/);
});

test("tech UI extra effects: command beam, lock shield, network, 3D floor, telemetry HUD", () => {
  const fx = read("components", "tech", "TechFX.tsx");
  for (const k of ["export function TouchReticle", "export function LockShield", "export function NetworkField", "export function PerspectiveFloor", "export function LightStreaks", "export function TelemetryHud"]) {
    assert.ok(fx.includes(k), k);
  }
  assert.match(fx, /document\.hidden/); // 裏では描画しない
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /<TouchReticle containerRef=\{mainRef\} \/>/);
  assert.match(cp, /<LockShield trigger=\{shield\.n\} mode=\{shield\.mode\}/);
  assert.match(cp, /<TelemetryHud /);
});

test("layout kept (room art on top), lock card right under the header, holographic lock buttons, galaxy kept", () => {
  const cp = read("components", "ControlPanel.tsx");
  const hero = cp.indexOf("<HeroMedia url={imageUrl}");
  const header = cp.indexOf("<motion.header");
  const lock = cp.indexOf("<LockCard roomSlug");
  const telemetry = cp.indexOf("<TelemetryHud");
  assert.ok(hero > 0 && hero < header && header < lock && lock < telemetry, "room art → header → lock → HUD");
  assert.match(cp, /<TechButton tone="emerald" icon=\{LockKeyholeOpen\} label=\{t\.unlock\}/);
  assert.match(cp, /<ModeGrid /);
  assert.doesNotMatch(cp, /CommandBeamLayer/);
});

test("modes are right under the entrance button; normal returns to main light only; nest/cozy turn other lights off", () => {
  const cp = read("components", "ControlPanel.tsx");
  const entrance = cp.indexOf("<EntranceKeyButton");
  const modes = cp.indexOf("<ModeGrid ");
  const scenes = cp.indexOf("<SceneButtons part=\"rest\"");
  assert.ok(entrance > 0 && modes > entrance && scenes > modes);
  assert.match(cp, /action: "normal"/);
  assert.match(cp, /action: "galaxy_on"/);
  assert.match(cp, /action: "nest_on"/);
  assert.match(cp, /action: "welcome_cozy"/);
  const dc = read("lib", "deviceControl.ts");
  const normal = dc.slice(dc.indexOf('case "normal"'), dc.indexOf('case "good_night"'));
  assert.match(normal, /lightTurnOn\(sbCreds, room\.switchbot_light_device_id\)/);
  for (const h of ["offGalaxy()", "offNest()", "offWafu()"]) assert.ok(normal.includes(h), h);
  const nest = dc.slice(dc.indexOf('case "nest_on"'), dc.indexOf('case "wafu_on"'));
  assert.match(nest, /offLight\(\), offGalaxy\(\), offWafu\(\)/);
  const cozy = dc.slice(dc.indexOf('case "welcome_cozy"'), dc.indexOf('case "normal"'));
  assert.match(cozy, /offLight\(\), offGalaxy\(\), offNest\(\)/);
  assert.match(read("lib", "deviceClient.ts"), /"normal"/);
});

test("galaxy launch animation, no add-to-home card in the tech UI", () => {
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /<GalaxyLaunch trigger=\{galaxyLaunch\} \/>/);
  assert.match(cp, /if \(m\.k === "galaxy"\) \{ galaxyOn\(\); onGalaxyLaunch\?\.\(\); \}/);
  assert.doesNotMatch(cp, /<AddToHomePrompt/);
  assert.match(read("components", "tech", "TechFX.tsx"), /export function GalaxyLaunch/);
});

test("first language follows the phone setting (Accept-Language), ?lang= still wins", async () => {
  const { roomLangFromHeader, keyLangFromHeader, parseAcceptLanguage } = await import(path.join(root, "lib", "acceptLang.ts"));
  assert.deepEqual(parseAcceptLanguage("ko-KR,ko;q=0.9,en-US;q=0.8"), ["ko-kr", "ko", "en-us"]);
  assert.equal(roomLangFromHeader("ko-KR,ko;q=0.9,en-US;q=0.8"), "ko");
  assert.equal(roomLangFromHeader("fr-FR,fr;q=0.9,ja;q=0.5"), "ja");
  assert.equal(roomLangFromHeader("fr-FR"), null);
  assert.equal(roomLangFromHeader("zh-TW,zh;q=0.9"), "zh");
  assert.equal(keyLangFromHeader("zh-TW,zh;q=0.9"), "zh-TW");
  assert.equal(keyLangFromHeader("zh-Hant-HK"), "zh-TW");
  assert.equal(keyLangFromHeader("zh-CN"), "zh");
  assert.equal(keyLangFromHeader(null), null);
  const room = read("app", "room", "[room_id]", "page.tsx");
  assert.match(room, /isLang\(searchParams\.lang\)\s*\? searchParams\.lang/);
  assert.match(room, /: phoneLang/);
  assert.match(read("app", "key", "[entrance]", "page.tsx"), /keyLangFromHeader\(headers\(\)\.get\("accept-language"\)\)/);
});

test("a language the guest picked is remembered (cookie) and used before the phone setting", () => {
  for (const f of [["components", "ControlPanel.tsx"], ["components", "LiteControlPanel.tsx"], ["components", "MagicalControlPanel.tsx"], ["components", "PinGate.tsx"], ["components", "smartkey", "SmartKeyGuest.tsx"]]) {
    assert.match(read(...f), /rememberLang\(/, f.join("/"));
  }
  const room = read("app", "room", "[room_id]", "page.tsx");
  assert.ok(room.indexOf("isLang(saved)") < room.indexOf(": phoneLang"), "saved choice before phone language");
  assert.match(read("app", "key", "[entrance]", "page.tsx"), /searchParams\.lang \?\? cookies\(\)\.get\(LANG_COOKIE\)\?\.value \?\? keyLangFromHeader/);
});

test("mode grid: galaxy / nest / cozy / dream have ON and OFF in the same colored frame (original off sounds); full mode names", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../components/ControlPanel.tsx"), "utf8");
  const grid = src.slice(src.indexOf("function ModeGrid"), src.indexOf("function SceneButtons"));
  assert.match(grid, /"galaxy_off"/);
  assert.match(grid, /"nest_off"/);
  assert.match(grid, /"wafu_off"/);
  assert.match(grid, /galaxyOff\(\)/);
  assert.match(grid, /toggleServo\(false\)/);
  // ON と OFF は同じ枠 (HudPanel) の中で、別々のボタン + 仕切り、OFF は枠と同じ色
  assert.match(grid, /onClick=\{offKey \? undefined : \(\) => run\(m\)\}/);
  assert.match(grid, /<button type="button" onClick=\{\(\) => run\(m\)\}[\s\S]{0,900}aria-hidden className="relative my-3 w-px"[\s\S]{0,300}onClick=\{\(\) => stop\(offKey\)\}/);
  assert.match(grid, /OFF_STYLE\[m\.tone\]/);
  // ON と OFF の同時押し防止
  assert.match(grid, /if \(busy \|\| lock\.current\) return;\s*lock\.current = true;/);
  assert.match(grid, /const wide = offKey !== null/, "galaxy / nest / dream / cozy use the full width");
  assert.match(src, /function ModeScene\(\{ k, on \}/, "background animation differs by ON/OFF");
  assert.match(grid, /<ModeScene k=\{offKey\} on=\{on\} \/>/);
  assert.match(grid, /label: t\.galaxy, desc/);
  assert.match(grid, /label: t\.nest, desc/);
  assert.match(grid, /label: `\$\{t\.normalMode\}\$\{t\.modeSuffix\}`/);
});

test("alarm save failure returns DB detail; combined wake SQL exists", () => {
  const fs = require("node:fs"); const path = require("node:path");
  for (const f of ["app/api/alarms/[room_id]/route.ts", "app/api/admin/test-alarm/route.ts"]) {
    assert.match(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), /detail:/);
  }
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migration_wake_fix_all.sql"), "utf8");
  assert.match(sql, /reservation_id drop not null/);
  assert.match(sql, /wake_mode/);
  assert.match(sql, /wafu_prewake_step/);
});

test("away button sits above good-night / wafu-off", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../components/ControlPanel.tsx"), "utf8");
  const scene = src.slice(src.indexOf("function SceneButtons"));
  assert.match(scene, /order-first col-span-2">\s*<HudPanel tone="violet" onClick=\{\(\) => run\("away"\)\}/);
});

test("away button is rendered above the lock card; the rest stay below the mode grid", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../components/ControlPanel.tsx"), "utf8");
  const away = src.indexOf('<SceneButtons part="away"');
  const lock = src.indexOf("<LockCard ");
  const grid = src.indexOf("<ModeGrid ");
  const rest = src.indexOf('<SceneButtons part="rest"');
  assert.ok(away > 0 && away < lock, "away above lock");
  assert.ok(grid < rest, "good-night / wafu-off stay under the mode grid");
});

test("speed: quick boot on repeat visits, original geofence check, IR queue without resend, request timeout, server region next to Supabase (Sydney), light videos", () => {
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /techBooted:\$\{roomSlug\}/);
  assert.match(cp, /function QuickBoot/);
  assert.match(cp, /setTimeout\(\(\) => doneRef\.current\(\), 520\)/);
  assert.match(cp, /3分キャッシュ/, "geofence check is back to the original");
  assert.doesNotMatch(cp, /geoOkUntil|enableHighAccuracy: false/);
  const sb = read("lib", "switchbot.ts");
  assert.match(sb, /function isIrDevice/);
  assert.match(sb, /queueIr\(attempt\)/);
  assert.doesNotMatch(sb, /setTimeout\(res, 400\)/, "no automatic resend");
  assert.match(read("lib", "deviceClient.ts"), /ctrl\.abort\(\), 20000/);
  assert.deepEqual(JSON.parse(read("vercel.json")).regions, ["syd1"]);
  for (const f of ["room-take.mp4", "room-ume.mp4"]) {
    assert.ok(fs.statSync(path.join(root, "public", "rooms", f)).size < 1.5 * 1024 * 1024, f);
  }
});

test("boot sounds play once: boot effects do not re-run when the panel re-renders", () => {
  const cp = read("components", "ControlPanel.tsx");
  const boot = cp.slice(cp.indexOf("function BootSequence"), cp.indexOf("function BootSequence") + 2500);
  assert.match(boot, /doneRef\.current = onDone/);
  assert.doesNotMatch(boot, /\}, \[onDone\]\);/);
  const quick = cp.slice(cp.indexOf("function QuickBoot"), cp.indexOf("function BootSequence"));
  assert.match(quick, /doneRef\.current = onDone/);
  assert.doesNotMatch(quick, /\}, \[onDone\]\);/);
});
