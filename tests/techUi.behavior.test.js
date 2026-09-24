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
  for (const k of ["export function CommandBeamLayer", "export function LockShield", "export function NetworkField", "export function PerspectiveFloor", "export function LightStreaks", "export function TelemetryHud"]) {
    assert.ok(fx.includes(k), k);
  }
  assert.match(fx, /document\.hidden/); // 裏では描画しない
  const cp = read("components", "ControlPanel.tsx");
  assert.match(cp, /<CommandBeamLayer sourceRef=\{reactorRef\} containerRef=\{mainRef\} \/>/);
  assert.match(cp, /<LockShield trigger=\{shield\.n\} mode=\{shield\.mode\} \/>/);
  assert.match(cp, /<TelemetryHud /);
});
