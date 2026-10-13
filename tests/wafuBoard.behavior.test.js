const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("boarding: pickup (in) trips with a room switch on wafu + AC once (dead → guest only)", () => {
  const s = R("lib/cabinRoomPrep.ts");
  assert.match(s, /before\.phase !== "dead" \|\| before\.direction !== "in" \|\| !before\.room_id/);
  assert.match(s, /switchbot_wafu_device_id \? "welcome_cozy" : "welcome"/);
  assert.match(s, /ai_cmd: \{ c: "room", n: prep\.n, auto: 1/);
  assert.match(R("app/driver/actions.ts"), /await boardTrip\(tripId\)/);
  assert.match(R("app/api/cabin/state/route.ts"), /b\.op === "board"[\s\S]{0,80}boardTrip\(b\.trip\)/);
});
test("boarding: iPad speaks the room line after the boarding greeting; phone shows a stop button", () => {
  assert.match(R("components/cabin/cabinAi.ts"), /cmd\.auto \? 20000 : 0/);
  const d = R("components/driver/DriverCabin.tsx");
  assert.match(d, /function PrepNote/);
  assert.match(d, /cabinRoomPrepStop\(tr\.id\)/);
  assert.match(R("lib/cabinRoomPrep.ts"), /executeDeviceAction\(room, "away"/);
});
test("concierge: room light card (wafu_mode / normal) only during the stay in rooms with a wafu light", () => {
  const g = R("lib/nfcGuide.ts");
  assert.match(g, /switchbot_wafu_device_id && !co\?\.done\) out\.light/);
  const h = R("lib/nfcPage.ts");
  assert.match(h, /function renderLight/);
  assert.match(h, /wafu_mode/);
  assert.ok(!fs.existsSync(path.join(root, "components/LightToggle.tsx")));
});
