const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("boarding: pickup (in) trips with a room switch on only the AC, once (dead → guest only)", () => {
  const s = R("lib/cabinRoomPrep.ts");
  assert.match(s, /before\.phase !== "dead" \|\| before\.direction !== "in" \|\| !before\.room_id/);
  assert.match(s, /const act = "ac_comfort"/);
  assert.match(s, /ai_cmd: \{ c: "room", n: prep\.n, auto: 1/);
  assert.match(R("lib/deviceControl.ts"), /case "ac_comfort":[\s\S]{0,160}sceneAcComfort/);
  assert.match(R("app/driver/actions.ts"), /await boardTrip\(tripId\)/);
  assert.match(R("app/api/cabin/state/route.ts"), /b\.op === "board"[\s\S]{0,80}boardTrip\(b\.trip\)/);
});
test("boarding: iPad speaks the room line after the greeting; phone shows a stop button (AC off)", () => {
  assert.match(R("components/cabin/cabinAi.ts"), /cmd\.auto \? 20000 : 0/);
  const d = R("components/driver/DriverCabin.tsx");
  assert.match(d, /function PrepNote/);
  assert.match(d, /cabinRoomPrepStop\(tr\.id\)/);
  assert.match(R("lib/cabinRoomPrep.ts"), /executeDeviceAction\(room, "ac_off"/);
});
test("arrival: first unlock turns on the light the guest chose in the concierge (default 和)", () => {
  const a = R("lib/arrivalLight.ts");
  assert.match(a, /if \(!room\?\.switchbot_wafu_device_id\) return "welcome";/);
  assert.match(a, /pref === "normal" \? "welcome" : "welcome_cozy"/);
  for (const f of ["app/api/devices/[room_id]/route.ts", "app/api/key/[entrance]/cmd/route.ts"]) {
    const s = R(f);
    assert.match(s, /welcomeActionFor\(/);
    assert.doesNotMatch(s, /executeDeviceAction\([^)]*"welcome", "Auto Welcome"/);
  }
});
test("concierge: before arrival the choice is only saved; after arrival it switches live", () => {
  const g = R("app/api/guide-light/[room]/route.ts");
  assert.match(g, /if \(!cur\.welcomed_at \|\| !stay\)[\s\S]{0,140}live: false/);
  assert.match(g, /mode === "wafu" \? "wafu_mode" : "normal"/);
  assert.match(R("lib/nfcGuide.ts"), /\/api\/guide-light\//);
  const h = R("lib/nfcPage.ts");
  assert.match(h, /function renderLight/);
  assert.match(R("supabase/migration_light_pref.sql"), /add column if not exists light_pref text/);
});
test("concierge light choice also works before check-in time (signed ?k after the 4 digits)", () => {
  const g = R("app/api/guide-light/[room]/route.ts");
  assert.match(g, /guideRidFromKey\(/);
  assert.match(g, /if \(!cur\.welcomed_at \|\| !stay\)/);
  // iPad の QR は今までどおり (4 桁でゲストの予約 → そのゲストのお部屋へ)
  assert.doesNotMatch(R("components/cabin/cabinEngine.ts"), /conKey/);
});
test("iPad: concierge QR in the bottom-right box 20 s after a pickup starts; ✕ / 10 min → small 🛎 QR button; gone on arrival; phone can show it again", () => {
  const e = R("components/cabin/cabinEngine.ts");
  assert.match(e, /if \(t\.dir === "in"\) T_\(20000, \(\) => cqShow\(\)\)/);
  assert.match(e, /cqT = setTimeout\(cqHide, 600000\)/);
  assert.match(e, /arrived = true; const id = trip\.id; cqOff\(\)/);
  assert.match(e, /const cqBox = \(\) => \$\("recBox"\)/);
  assert.match(R("components/cabin/cabinAi.ts"), /if \(cmd\.c === "qr"\) \{ c\.conQr\(\); return; \}/);
  assert.match(R("lib/cabinAiTalk.ts"), /"unknown", "qr"\]/);
  assert.match(R("components/driver/DriverCabin.tsx"), /tr\.dir === "in" \? \[QR_BTN\]/);
  const css = R("app/cabin/cabin.css");
  assert.match(css, /\.cab #cq\{position:absolute;inset:0/);
});
test("concierge: check-in is the most visible thing during the stay (gold card under the light card + first tile) until opened", () => {
  const h = R("lib/nfcPage.ts");
  assert.match(h, /id=\\"ciBan\\"|id="ciBan"/);
  assert.match(h, /function renderCi\(\)/);
  assert.match(h, /ciT\[3\]\?\[ciT,\.\.\.rest\]/);
  assert.match(h, /cn\.ciOpen\./);
  assert.match(R("lib/nfcGuide.ts"), /out\.arrive = \{ arrived: ls\.arrived \}/);
});
