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
