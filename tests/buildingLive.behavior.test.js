const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("admin LIVE: state from our own operation log (no extra SwitchBot calls) + SwitchBot webhook, newest wins", () => {
  const b = R("lib/buildingState.ts");
  for (const a of ["light_on", "welcome_cozy", "good_night", "away", "dream_fade", "galaxy_on", "nest_on", "wafu_mode", "ac_comfort"]) assert.match(b, new RegExp(`\\b${a}: \\{`), a);
  assert.match(b, /if \(!id \|\| id\.includes\("-"\)\) continue;/); // IR remotes never get webhooks
  assert.match(b, /return occ === "vacant" && PARTS\.some/); // alert only when vacant (arriving rooms get AC at pickup)
  const api = R("app/api/admin/live/route.ts");
  assert.match(api, /token !== process\.env\.ADMIN_SESSION_TOKEN|t === process\.env\.ADMIN_SESSION_TOKEN/);
  assert.doesNotMatch(api.split("export async function GET")[1].split("export async function POST")[0], /webhookQuery|webhookSetup|sendCommand|devices\//); // GET reads the database only
  assert.match(api, /if \(b\.op === "hook" && !mine && !other\)/); // never overwrites someone else's webhook URL
});
test("SwitchBot webhook: secret URL token, display-only, upsert one row per device", () => {
  const w = R("lib/switchbotWebhook.ts");
  assert.match(w, /timingSafeEqual/);
  const r = R("app/api/switchbot/webhook/[token]/route.ts");
  assert.match(r, /if \(!tokenOk\(params\.token\)\) return NextResponse\.json\(\{ ok: false \}, \{ status: 404 \}\)/);
  assert.match(r, /upsert\(row, \{ onConflict: "device_id" \}\)/);
  assert.doesNotMatch(r, /executeDeviceAction|sesame/i);
  assert.match(R("supabase/migration_device_state.sql"), /create table if not exists public\.device_state/);
  assert.match(R("lib/switchbot.ts"), /export async function webhookSetup/);
});
test("admin LIVE card: on top of the Today tab, polls only while visible, hologram version matches", () => {
  const a = R("app/admin/AdminClient.tsx");
  assert.match(a, /<LiveBuilding lang=\{lang\} \/>/);
  const c = R("components/admin/LiveBuilding.tsx");
  assert.match(c, /IntersectionObserver/); assert.match(c, /document\.hidden/);
  assert.match(c, /const POLL_MS = 20000;/);
  const v = c.match(/BUILDING_V = "([0-9a-f]+)"/)[1];
  assert.ok(R("public/holo/building.html").includes(`/holo/building.js?v=${v}`));
  assert.ok(!/new AudioContext|webkitAudioContext/.test(R("public/holo/building.js")));
});
test("deadhead BOOST: the iPad's effect-sound AudioContext is started on touch, and falls back to an audio element", () => {
  assert.match(R("components/cabin/cabinDeadhead.ts"), /unlock: \(\) => \{ unlockAudio\(el, dhAudio\("boot"\)\); const a = c\.ac\(\);/);
  assert.match(R("components/cabin/CabinApp.tsx"), /document\.addEventListener\("pointerdown", wake, true\)/);
  assert.match(R("lib/cabinAudio.ts"), /if \(ac\.state === "running"\) play\(\); else \{ const a = new Audio\(url\); a\.play\(\)/);
});
