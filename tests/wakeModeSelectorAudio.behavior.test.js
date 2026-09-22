const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function wakeComponent(fileName, functionName) {
  const source = fs.readFileSync(path.join(root, "components", fileName), "utf8");
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  assert.ok(component, `${functionName} should exist`);
  return { source, component };
}

function selector(component, mode) {
  let found;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === "onClick" && node.initializer &&
        ts.isJsxExpression(node.initializer) && node.initializer.expression &&
        node.initializer.getText().includes(`"${mode}"`)) {
      found = node.initializer.getText();
    }
    ts.forEachChild(node, visit);
  }
  visit(component);
  assert.ok(found, `${mode} selector should have a click handler`);
  return found;
}

function runSelection(component, savedMute, mode, label) {
  const declaration = component.body.statements.find((node) =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => entry.name.getText() === "selectMode"));
  assert.ok(declaration, "wake selector should share one feedback path");
  const code = ts.transpileModule(declaration.getText(), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const events = [];
  let muted = false;
  const selectMode = new Function(
    "setMode", "setState", "navTick", "speak", "sfxSetMuted", "localStorage", "t",
    `${code}\nreturn selectMode;`,
  )(
    (value) => events.push(["mode", value]),
    (value) => events.push(["state", value]),
    () => { if (!muted) events.push(["sfx"]); },
    (value) => { if (!muted) events.push(["voice", value]); },
    (value) => { muted = value; events.push(["mute", value]); },
    { getItem: (key) => { assert.equal(key, "guestMuted"); return savedMute; } },
    { wakeFlameName: "Flame On", wakeHorizonName: "Horizon Rise" },
  );
  selectMode(mode, label);
  return events;
}

for (const [fileName, functionName] of [
  ["ControlPanel.tsx", "WakeCard"],
  ["LiteControlPanel.tsx", "WakeLite"],
]) {
  test(`${fileName} announces both wake modes immediately from their selectors`, () => {
    const { component } = wakeComponent(fileName, functionName);
    assert.match(selector(component, "flame_on"), /selectMode\("flame_on", t\.wakeFlameName\)/);
    assert.match(selector(component, "horizon_rise"), /selectMode\("horizon_rise", t\.wakeHorizonName\)/);

    for (const [mode, label] of [["flame_on", "Flame On"], ["horizon_rise", "Horizon Rise"]]) {
      const events = runSelection(component, "0", mode, label);
      assert.deepEqual(events.slice(-4), [
        ["sfx"], ["voice", label], ["mode", mode], ["state", "idle"],
      ]);
    }
  });
}

test("lite wake selectors honor the persisted mute preference", () => {
  const { component } = wakeComponent("LiteControlPanel.tsx", "WakeLite");
  assert.deepEqual(runSelection(component, "1", "horizon_rise", "Horizon Rise"), [
    ["mute", true], ["mode", "horizon_rise"], ["state", "idle"],
  ]);
  assert.deepEqual(runSelection(component, "0", "flame_on", "Flame On"), [
    ["mute", false], ["sfx"], ["voice", "Flame On"], ["mode", "flame_on"], ["state", "idle"],
  ]);
});

test("hi-tech panel keeps its mute state connected to the shared SFX module", () => {
  const { source } = wakeComponent("ControlPanel.tsx", "WakeCard");
  assert.match(source, /useEffect\(\(\) => \{ sfxSetMuted\(muted\); \}, \[muted\]\)/);
});
