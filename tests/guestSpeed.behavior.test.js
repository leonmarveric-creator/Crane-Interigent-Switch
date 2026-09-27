const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const size = (...p) => fs.statSync(path.join(root, ...p)).size;

test("guest UI: heavy files are light (frame, posters, room art, galaxy sound)", () => {
  assert.ok(size("public", "magic-portraits", "ornate-frame.webp") < 300_000);
  for (const f of fs.readdirSync(path.join(root, "public", "rooms")).filter((x) => /\.(jpg|mp4)$/.test(x))) {
    assert.ok(size("public", "rooms", f) < 900_000, `${f} is light`);
  }
  assert.ok(size("public", "audio", "sfx", "galaxy-sfx-05-arc-reactor-ignition.mp3") < 100_000);
});

test("guest UI: pictures/sounds cached a week, saved on the phone; pages and PIN never cached", () => {
  const cfg = read("next.config.mjs");
  assert.match(cfg, /max-age=604800/);
  for (const s of ["/magic-portraits/:path*", "/rooms/:path*", "/audio/:path*"]) assert.ok(cfg.includes(`"${s}"`), s);
  assert.ok(!/"\/room\/:path\*"|"\/cabin\/:path\*"/.test(cfg), "pages are not cached");
  const sw = read("public", "room-sw.js");
  assert.match(sw, /magic-portraits\|rooms\|audio\\\/voice\|audio\\\/sfx/);
  assert.match(sw, /status: 206/, "video/audio range requests work from the saved copy");
  const sw2 = sw.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/api|\/room\//.test(sw2.replace(/room-static|room-art/g, "")), "no API / page caching");
  const rm = read("components", "RoomModeSwitch.tsx");
  assert.match(rm, /register\("\/room-sw\.js", \{ scope: "\/room\/" \}\)/);
  assert.match(rm, /if \(props\.admin \|\|/);
});
