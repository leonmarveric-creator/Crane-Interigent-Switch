const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const sfxPath = path.join(root, "lib", "sfx.ts");
const voiceDir = path.join(root, "public", "audio", "voice", "current");
const sfxDir = path.join(root, "public", "audio", "sfx");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const expectedVoiceAssets = [
  ["All systems online", "current-natural-voice-01-all-systems-online.mp3"],
  ["Good evening. Systems online", "current-natural-voice-02-good-evening-systems-online.mp3"],
  ["J.A.R.V.I.S online", "current-natural-voice-03-jarvis-online.mp3"],
  ["Access granted. Welcome", "current-natural-voice-04-access-granted-welcome.mp3"],
  ["Goodbye", "current-natural-voice-05-goodbye.mp3"],
  ["Powering down", "current-natural-voice-06-powering-down.mp3"],
  ["Have a safe trip", "current-natural-voice-07-have-a-safe-trip.mp3"],
  ["Good night", "current-natural-voice-08-good-night.mp3"],
  ["Lights dimmed", "current-natural-voice-09-lights-dimmed.mp3"],
  ["Rest mode engaged", "current-natural-voice-10-rest-mode-engaged.mp3"],
  ["Japanese Lamp offline", "current-natural-voice-11-japanese-lamp-offline.mp3"],
  ["Japanese lamp off", "current-natural-voice-12-japanese-lamp-off.mp3"],
  ["Ambient lighting off", "current-natural-voice-13-ambient-lighting-off.mp3"],
  ["Cozy mode engaged", "current-natural-voice-14-cozy-mode-engaged.mp3"],
  ["Setting a warm mood", "current-natural-voice-15-setting-a-warm-mood.mp3"],
  ["Relax and unwind", "current-natural-voice-16-relax-and-unwind.mp3"],
  ["Welcome home", "current-natural-voice-17-welcome-home.mp3"],
  ["Comfort mode engaged", "current-natural-voice-18-comfort-mode-engaged.mp3"],
  ["Systems set for your return", "current-natural-voice-19-systems-set-for-your-return.mp3"],
  ["Door unlocked", "current-natural-voice-20-door-unlocked.mp3"],
  ["Access granted", "current-natural-voice-21-access-granted.mp3"],
  ["Welcome in", "current-natural-voice-22-welcome-in.mp3"],
  ["Door secured", "current-natural-voice-23-door-secured.mp3"],
  ["Locked and secured", "current-natural-voice-24-locked-and-secured.mp3"],
  ["Lockdown engaged", "current-natural-voice-25-lockdown-engaged.mp3"],
  ["Air Con online", "current-natural-voice-26-air-con-online.mp3"],
  ["Air Con engaged", "current-natural-voice-27-air-con-engaged.mp3"],
  ["Air Con activated", "current-natural-voice-28-air-con-activated.mp3"],
  ["Air Con offline", "current-natural-voice-29-air-con-offline.mp3"],
  ["Air Con standby", "current-natural-voice-30-air-con-standby.mp3"],
  ["Air Con deactivated", "current-natural-voice-31-air-con-deactivated.mp3"],
  ["Light online", "current-natural-voice-32-light-online.mp3"],
  ["Light engaged", "current-natural-voice-33-light-engaged.mp3"],
  ["Light activated", "current-natural-voice-34-light-activated.mp3"],
  ["Light offline", "current-natural-voice-35-light-offline.mp3"],
  ["Light standby", "current-natural-voice-36-light-standby.mp3"],
  ["Light deactivated", "current-natural-voice-37-light-deactivated.mp3"],
  ["Japanese Lamp online", "current-natural-voice-38-japanese-lamp-online.mp3"],
  ["Ambient lighting engaged", "current-natural-voice-39-ambient-lighting-engaged.mp3"],
  ["Warm glow activated", "current-natural-voice-40-warm-glow-activated.mp3"],
  ["Restoring warm tone", "current-natural-voice-41-restoring-warm-tone.mp3"],
  ["Warm preset applied", "current-natural-voice-42-warm-preset-applied.mp3"],
  ["Galaxy mode engaged", "current-natural-voice-43-galaxy-mode-engaged.mp3"],
  ["Opening the cosmos", "current-natural-voice-44-opening-the-cosmos.mp3"],
  ["Enjoy the stars", "current-natural-voice-45-enjoy-the-stars.mp3"],
  ["Returning to Earth", "current-natural-voice-46-returning-to-earth.mp3"],
  ["Galaxy mode off", "current-natural-voice-47-galaxy-mode-off.mp3"],
  ["Goodnight, stargazer", "current-natural-voice-48-goodnight-stargazer.mp3"],
  ["Nest mode engaged", "current-natural-voice-49-nest-mode-engaged.mp3"],
  ["Warm light online", "current-natural-voice-50-warm-light-online.mp3"],
  ["Cozy glow, activated", "current-natural-voice-51-cozy-glow-activated.mp3"],
  ["Nest mode off", "current-natural-voice-52-nest-mode-off.mp3"],
  ["Warm light standby", "current-natural-voice-53-warm-light-standby.mp3"],
  ["Dimming the glow", "current-natural-voice-54-dimming-the-glow.mp3"],
];

test("sfx prefers bundled natural voice assets for existing spoken lines", () => {
  const source = read(sfxPath);

  assert.match(source, /VOICE_AUDIO_BASE\s*=\s*"\/audio\/voice\/current\/"/);
  assert.match(source, /VOICE_AUDIO_BY_TEXT/);
  assert.match(source, /function playNaturalVoice/);
  assert.match(source, /new Audio/);
  assert.match(source, /function speakWithBrowser/);
  assert.match(source, /GALAXY_ON_AUDIO_URL/);
  assert.match(source, /galaxy-sfx-05-arc-reactor-ignition\.wav/);

  for (const [line, filename] of expectedVoiceAssets) {
    assert.ok(source.includes(JSON.stringify(line)), `${line} should be mapped`);
    assert.ok(source.includes(JSON.stringify(filename)), `${filename} should be mapped`);
  }
});

test("all natural voice assets referenced by sfx are bundled in public", () => {
  for (const [, filename] of expectedVoiceAssets) {
    assert.equal(fs.existsSync(path.join(voiceDir, filename)), true, `${filename} should exist`);
  }
});

test("selected galaxy ignition asset is bundled in public", () => {
  assert.equal(
    fs.existsSync(path.join(sfxDir, "galaxy-sfx-05-arc-reactor-ignition.wav")),
    true,
    "galaxy-sfx-05-arc-reactor-ignition.wav should exist",
  );
});

test("localized device labels resolve to the same natural voice assets", () => {
  const source = read(sfxPath);

  for (const expected of [
    "VOICE_LABEL_ALIASES",
    "エアコン",
    "照明",
    "和風ライト",
    "Air Con",
    "Light",
    "Japanese Lamp",
  ]) {
    assert.ok(source.includes(expected), `${expected} should be included in label aliases`);
  }
});
