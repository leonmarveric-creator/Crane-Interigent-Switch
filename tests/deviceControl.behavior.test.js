const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deviceControlPath = path.join(root, "lib", "deviceControl.ts");
const deviceClientPath = path.join(root, "lib", "deviceClient.ts");
const controlPanelPath = path.join(root, "components", "ControlPanel.tsx");
const cronPath = path.join(root, "app", "api", "cron", "galaxy-auto-off", "route.ts");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractCase(source, action) {
  const start = source.indexOf(`case "${action}":`);
  assert.notEqual(start, -1, `missing case for ${action}`);

  const blockStart = source.indexOf("{", start);
  assert.notEqual(blockStart, -1, `missing case block for ${action}`);
  let depth = 0;
  for (let i = blockStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return source.slice(blockStart, i + 1);
  }
  throw new Error(`unterminated case block for ${action}`);
}

test("good_night is exposed as a client and server device action", () => {
  assert.match(read(deviceControlPath), /"good_night"/);
  assert.match(read(deviceClientPath), /"good_night"/);
});

test("good_night turns off every light-capable device without touching air conditioning", () => {
  const block = extractCase(read(deviceControlPath), "good_night");

  for (const expected of [
    "switchbot_light_device_id",
    "switchbot_galaxy_device_id",
    "switchbot_nest_device_id",
    "switchbot_wafu_device_id",
    "lightTurnOff",
    "deviceTurnOff",
  ]) {
    assert.match(block, new RegExp(expected), `${expected} should be used by good_night`);
  }

  assert.doesNotMatch(block, /switchbot_ac_device_id|acTurnOn|acTurnOff|acSetAll/);
});

test("galaxy_on stores a ninety-minute auto-off deadline and galaxy_off clears it", () => {
  const source = read(deviceControlPath);
  assert.match(source, /GALAXY_AUTO_OFF_MS\s*=\s*90\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /galaxy_auto_off_at/);
  assert.match(extractCase(source, "galaxy_on"), /setGalaxyAutoOffAt\(room,\s*autoOffAt\)/);
  assert.match(extractCase(source, "galaxy_off"), /setGalaxyAutoOffAt\(room,\s*null/);
});

test("galaxy auto-off cron route processes rooms whose deadline has passed", () => {
  const source = read(cronPath);
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /galaxy_auto_off_at/);
  assert.match(source, /\.update\(\{\s*galaxy_auto_off_at:\s*null\s*\}\)/);
  assert.match(source, /\.eq\("galaxy_auto_off_at",\s*dueAt\)/);
  assert.match(source, /\.maybeSingle\(\)/);
  assert.match(source, /executeDeviceAction\(room,\s*"galaxy_off"/);
  assert.match(source, /\.update\(\{\s*galaxy_auto_off_at:\s*dueAt\s*\}\)/);
  assert.match(source, /logDevice/);
});

test("high-tech scene controls expose a quick Japanese lamp off action", () => {
  const source = read(controlPanelPath);
  const start = source.indexOf("function SceneButtons");
  assert.notEqual(start, -1, "missing SceneButtons");
  const end = source.indexOf("/* スマートロック", start);
  assert.notEqual(end, -1, "missing end of SceneButtons section");
  const section = source.slice(start, end);

  assert.match(section, /"wafu_off"/);
  assert.match(section, /run\("wafu_off"\)/);
  assert.match(section, /\{t\.wafu\}.*\{t\.off\}/s);
});
