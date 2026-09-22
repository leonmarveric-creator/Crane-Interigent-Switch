const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "lib", "wakePrewake.ts");
const cronPath = path.join(root, "app", "api", "cron", "wake-alarm", "route.ts");
const guestAlarmPath = path.join(root, "app", "api", "alarms", "[room_id]", "route.ts");
const adminAlarmPath = path.join(root, "app", "api", "admin", "test-alarm", "route.ts");
const controlPanelPath = path.join(root, "components", "ControlPanel.tsx");
const litePanelPath = path.join(root, "components", "LiteControlPanel.tsx");
const magicPanelPath = path.join(root, "components", "MagicalControlPanel.tsx");
const i18nPath = path.join(root, "lib", "i18n.ts");
const schemaPath = path.join(root, "supabase", "schema.sql");
const setupPath = path.join(root, "supabase", "SETUP_ALL.sql");
const migrationPath = path.join(root, "supabase", "migration_wake_modes.sql");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("wafu prewake starts ten minutes before the main wake light and advances in brightness steps", async () => {
  const { PREWAKE_WINDOW_MS, PREWAKE_BRIGHTNESS_STEPS, getWafuPrewakeStep } = await import(helperPath);
  const fireAtMs = Date.UTC(2026, 8, 14, 22, 0, 0);

  assert.equal(PREWAKE_WINDOW_MS, 10 * 60 * 1000);
  assert.deepEqual(PREWAKE_BRIGHTNESS_STEPS, [15, 35, 55, 75, 100]);
  assert.equal(getWafuPrewakeStep(fireAtMs - PREWAKE_WINDOW_MS - 1, fireAtMs), null);
  assert.deepEqual(getWafuPrewakeStep(fireAtMs - PREWAKE_WINDOW_MS, fireAtMs), { step: 1, brightness: 15 });
  assert.deepEqual(getWafuPrewakeStep(fireAtMs - 5 * 60 * 1000, fireAtMs), { step: 3, brightness: 55 });
  assert.deepEqual(getWafuPrewakeStep(fireAtMs - 60 * 1000, fireAtMs), { step: 5, brightness: 100 });
  assert.equal(getWafuPrewakeStep(fireAtMs, fireAtMs), null);
  assert.equal(getWafuPrewakeStep(fireAtMs - 60 * 1000, fireAtMs, 5), null);
});

test("wake alarm cron and schema persist wafu prewake progress", () => {
  const cron = read(cronPath);
  const schema = read(schemaPath);
  const setup = read(setupPath);

  for (const expected of [
    "wafu_prewake_started_at",
    "wafu_prewake_step",
  ]) {
    assert.match(schema, new RegExp(expected));
    assert.match(setup, new RegExp(expected));
    assert.match(cron, new RegExp(expected));
  }

  assert.match(cron, /getWafuPrewakeStep/);
  assert.match(cron, /switchbot_wafu_device_id/);
  assert.match(cron, /bulbSetBrightness/);
  assert.match(cron, /wafu_prewake/);
});

test("wake modes define Flame On and the complete Horizon Rise timing", async () => {
  const {
    WAKE_LIGHT_MODES,
    WAFU_AUTO_OFF_DELAY_MS,
    getWafuAutoOffAtMs,
    isWakeLightMode,
  } = await import(helperPath);
  const fireAtMs = Date.UTC(2026, 8, 14, 22, 0, 0);

  assert.deepEqual(WAKE_LIGHT_MODES, ["flame_on", "horizon_rise"]);
  assert.equal(WAFU_AUTO_OFF_DELAY_MS, 5 * 60 * 1000);
  assert.equal(getWafuAutoOffAtMs(fireAtMs), fireAtMs + 5 * 60 * 1000);
  assert.equal(isWakeLightMode("flame_on"), true);
  assert.equal(isWakeLightMode("horizon_rise"), true);
  assert.equal(isWakeLightMode("legacy"), false);
  assert.equal(isWakeLightMode(null), false);
});

test("wake mode persistence and cron isolate Horizon Rise prewake and auto-off", () => {
  const cron = read(cronPath);
  const schema = read(schemaPath);
  const setup = read(setupPath);
  const migration = read(migrationPath);

  for (const source of [schema, setup, migration]) {
    for (const expected of [
      "wake_mode",
      "flame_on",
      "horizon_rise",
      "wafu_auto_off_at",
      "wafu_auto_off_completed_at",
    ]) {
      assert.match(source, new RegExp(expected));
    }
  }

  assert.match(cron, /\.eq\("wake_mode", "horizon_rise"\)/);
  assert.match(cron, /deviceTurnOff/);
  assert.match(cron, /wafu_auto_off_completed_at/);
  assert.match(cron, /wafu_wake_auto_off/);
});

test("guest and admin alarm APIs validate and persist the selected wake mode", () => {
  for (const source of [read(guestAlarmPath), read(adminAlarmPath)]) {
    assert.match(source, /isWakeLightMode/);
    assert.match(source, /wake_mode: wakeMode/);
    assert.match(source, /wafu_auto_off_at/);
    assert.match(source, /switchbot_wafu_device_id/);
    assert.match(source, /NO_WAFU/);
  }
});

test("every guest UI sends a wake mode and exposes localized mode explanations", () => {
  for (const source of [read(controlPanelPath), read(litePanelPath), read(magicPanelPath)]) {
    assert.match(source, /WakeLightMode/);
    assert.match(source, /flame_on/);
    assert.match(source, /horizon_rise/);
    assert.match(source, /JSON\.stringify\([\s\S]*?mode/);
    assert.match(source, /wakeFlameDescription/);
    assert.match(source, /wakeHorizonDescription/);
  }

  const i18n = read(i18nPath);
  for (const key of [
    "wakeFlameName",
    "wakeFlameDescription",
    "wakeHorizonName",
    "wakeHorizonDescription",
    "wakeHorizonUnavailable",
  ]) {
    assert.ok((i18n.match(new RegExp(`${key}:`, "g")) ?? []).length >= 5, `${key} should be typed and translated`);
  }

  for (const explanation of [
    "設定時刻にメインライトが点灯します。",
    "10分前から和風ライトが徐々に明るくなり、設定時刻にメインライトが点灯。5分後に和風ライトだけ自動消灯します。",
    "The main light turns on at the set time.",
    "The Japanese lamp gradually brightens from 10 minutes before, the main light turns on at the set time, and only the Japanese lamp turns off 5 minutes later.",
    "主灯会在设定时间亮起。",
    "和风灯从提前10分钟开始逐渐变亮，主灯在设定时间亮起，5分钟后仅自动关闭和风灯。",
    "설정 시간에 메인 조명이 켜집니다.",
    "10분 전부터 일본풍 조명이 서서히 밝아지고 설정 시간에 메인 조명이 켜진 뒤, 5분 후 일본풍 조명만 자동으로 꺼집니다.",
  ]) {
    assert.ok(i18n.includes(explanation), `${explanation} should be localized`);
  }
});
