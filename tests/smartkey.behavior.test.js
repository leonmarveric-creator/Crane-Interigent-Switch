const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const logicPath = path.join(root, "lib", "smartkeyLogic.ts");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

const H = 3600e3;
const NOW = Date.UTC(2026, 8, 23, 4, 47); // 2026-09-23 13:47 JST
const iso = (ms) => new Date(ms).toISOString();
const res = (over) => ({
  id: "r1", room_id: "haru", assigned_room_id: null, unlock_pin: "5678", guest_name: null, entrance_name: null,
  check_in: iso(NOW - 20 * H), check_out: iso(NOW + 20 * H), status: "active", ...over,
});

test("only a booking in this building with matching last-4 digits passes", async () => {
  const { pickReservation } = await import(logicPath);
  const rooms = ["haru", "natu"];
  assert.equal(pickReservation([res()], { name: "Chen", digits: "5678" }, rooms, NOW).ok, true);
  assert.deepEqual(pickReservation([res()], { name: "Chen", digits: "1234" }, rooms, NOW), { ok: false, error: "BAD_CODE" });
  // 別棟の部屋
  assert.equal(pickReservation([res({ room_id: "matsu" })], { name: "Chen", digits: "5678" }, rooms, NOW).ok, false);
  // 客室割り当てで別棟から寄せられた予約は通る
  assert.equal(pickReservation([res({ room_id: "matsu", assigned_room_id: "natu" })], { name: "x", digits: "5678" }, rooms, NOW).ok, true);
  // キャンセル・チェックアウト後・24時間より前は通らない
  assert.equal(pickReservation([res({ status: "cancelled" })], { name: "x", digits: "5678" }, rooms, NOW).ok, false);
  assert.equal(pickReservation([res({ check_out: iso(NOW - 1) })], { name: "x", digits: "5678" }, rooms, NOW).ok, false);
  assert.equal(pickReservation([res({ check_in: iso(NOW + 25 * H), check_out: iso(NOW + 60 * H) })], { name: "x", digits: "5678" }, rooms, NOW).ok, false);
  assert.equal(pickReservation([res({ check_in: iso(NOW + 23 * H), check_out: iso(NOW + 60 * H) })], { name: "x", digits: "5678" }, rooms, NOW).ok, true);
});

test("same digits in two rooms are disambiguated by name, otherwise AMBIGUOUS", async () => {
  const { pickReservation } = await import(logicPath);
  const rooms = ["haru", "natu"];
  const a = res({ id: "a", room_id: "haru", guest_name: "Chen Wei" });
  const b = res({ id: "b", room_id: "natu", guest_name: "Kim Minji" });
  const r = pickReservation([a, b], { name: "CHEN", digits: "5678" }, rooms, NOW);
  assert.equal(r.ok && r.reservation.id, "a");
  assert.deepEqual(pickReservation([a, b], { name: "Tanaka", digits: "5678" }, rooms, NOW), { ok: false, error: "AMBIGUOUS" });
});

test("key state follows the stay period", async () => {
  const { keyStateFor } = await import(logicPath);
  assert.equal(keyStateFor(null, NOW), "verify");
  assert.equal(keyStateFor(res(), NOW), "active");
  assert.equal(keyStateFor(res({ check_in: iso(NOW + H) }), NOW), "before");
  assert.equal(keyStateFor(res({ check_out: iso(NOW - H) }), NOW), "expired");
  assert.equal(keyStateFor(res({ status: "cancelled" }), NOW), "verify");
});

test("settings are clamped to safe ranges", async () => {
  const { sanitizeSettings } = await import(logicPath);
  const s = sanitizeSettings({ hold_ms: 50, countdown_sec: 999, show_wifi: false });
  assert.equal(s.hold_ms, 500);
  assert.equal(s.countdown_sec, 60);
  assert.equal(s.show_wifi, false);
  assert.equal(s.app_unlock_enabled, true);
});

test("secrets never leave the server and emergency stop guards unlock routes", () => {
  const page = read("app", "admin", "page.tsx");
  assert.match(page, /has_secret: !!e\.sesame_secret_key/);
  assert.doesNotMatch(page, /sesame_secret_key: e\./);
  assert.match(read("app", "api", "key", "[entrance]", "cmd", "route.ts"), /app_unlock_enabled/);
  assert.match(read("app", "api", "devices", "[room_id]", "route.ts"), /isAppUnlockStopped/);
  assert.match(read("supabase", "SETUP_ALL.sql"), /create table if not exists public\.entrances/);
});

test("lock mode is chosen per door: timer / door sensor / off", async () => {
  const { sanitizeSettings, DEFAULT_SMARTKEY_SETTINGS } = await import(logicPath);
  assert.equal(DEFAULT_SMARTKEY_SETTINGS.entrance_lock, "timer");
  const s = sanitizeSettings({ entrance_lock: "sensor", room_lock: "off" });
  assert.equal(s.entrance_lock, "sensor");
  assert.equal(s.room_lock, "off");
  assert.equal(sanitizeSettings({ room_lock: "bogus" }).room_lock, "timer");
  const screen = read("components", "smartkey", "SmartKeyScreen.tsx");
  assert.match(screen, /d === "entrance" \? p\.settings\.entrance_lock : p\.settings\.room_lock/);
  assert.match(screen, /cur\.mode !== "sensor" && \(p\.settings\.show_lock_now \|\| cur\.mode === "off"\)/);
  assert.match(read("app", "admin", "smartkeyActions.ts"), /entrance_lock: s\.entrance_lock/);
  assert.match(read("supabase", "migration_smartkey_lockmode.sql"), /add column if not exists entrance_lock text/);
});

test("room PIN flow asks for a name, greets the guest, and links to the entrance key", () => {
  const gate = read("components", "PinGate.tsx");
  assert.match(gate, /JSON\.stringify\(\{ pin, name: name\.trim\(\) \}\)/);
  const auth = read("app", "api", "room", "[room_id]", "auth", "route.ts");
  assert.match(auth, /entrance_name: name/);
  assert.match(auth, /signScopedSession\(ENTRANCE_SCOPE, match\.id, keyExp\)/);
  const page = read("app", "room", "[room_id]", "page.tsx");
  assert.match(page, /entranceHref = ent\?\.slug \? `\/key\/\$\{ent\.slug\}` : null/);
  for (const f of ["ControlPanel.tsx", "LiteControlPanel.tsx", "MagicalControlPanel.tsx"]) {
    const src = read("components", f);
    assert.match(src, /GX\[lang\]\.welcomeName\(guestName\)/, f);
    assert.match(src, /<EntranceKeyButton href=\{entranceHref\}/, f);
  }
});
