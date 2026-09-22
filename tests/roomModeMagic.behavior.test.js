const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const switchPath = path.join(root, "components", "RoomModeSwitch.tsx");
const magicPath = path.join(root, "components", "MagicalControlPanel.tsx");
const magicVoiceDir = path.join(root, "public", "audio", "voice", "magic");
const magicSeasonDir = path.join(root, "public", "magic-seasons");
const magicPortraitDir = path.join(root, "public", "magic-portraits");
const ornateFramePath = path.join(magicPortraitDir, "ornate-frame.png");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("room mode switch exposes a third magical guest UI mode", () => {
  const source = read(switchPath);

  assert.match(source, /type Mode = "select" \| "normal" \| "lite" \| "magic"/);
  assert.match(source, /MagicalControlPanel/);
  assert.match(source, /magicTitle/);
  assert.match(source, /choose\("magic"\)/);
});

test("magical mode uses corresponding spell names with room-fixed adult female voice feedback", () => {
  const source = read(magicPath);

  assert.match(source, /Wand/);
  assert.match(source, /spellCast/);
  assert.match(source, /incantation/i);
  assert.match(source, /const SPELL_INCANTATIONS/);
  assert.match(source, /ROOM_VOICE_VARIANT/);
  assert.match(source, /SPELL_VOICE_AUDIO_BASE/);
  assert.match(source, /SPELL_VOICE_AUDIO_BY_TEXT/);
  assert.match(source, /playNaturalIncantation/);
  assert.match(source, /pickSpellVoiceUrl/);
  assert.match(source, /pickSpellVoiceUrl\(text: string, season: MagicSeasonKey\)/);
  assert.match(source, /spring: "emma"/);
  assert.match(source, /summer: "libby"/);
  assert.match(source, /autumn: "sonia"/);
  assert.match(source, /winter: "natasha"/);
  assert.doesNotMatch(source, /options\?\.\[Math\.floor\(Math\.random\(\) \* options\.length\)\]/);
  assert.match(source, /new Audio/);
  assert.match(source, /spell-01-alohomora\.mp3/);
  assert.match(source, /variants\/emma\/spell-01-alohomora\.mp3/);
  assert.match(source, /variants\/maisie\/spell-01-alohomora\.mp3/);
  assert.match(source, /variants\/libby\/spell-01-alohomora\.mp3/);
  assert.match(source, /variants\/natasha\/spell-01-alohomora\.mp3/);
  assert.match(source, /variants\/sonia\/spell-01-alohomora\.mp3/);
  assert.match(source, /NATURAL_FEMALE_VOICE_NAMES/);
  assert.match(source, /pickFemaleIncantationVoice/);
  assert.match(source, /scoreIncantationVoice/);
  assert.match(source, /natural\|premium\|enhanced\|neural\|online/i);
  assert.match(source, /utterance\.rate = 0\.9/);
  assert.match(source, /utterance\.pitch = 1;/);
  assert.match(source, /wand-grain/);
  assert.match(source, /wand-knot/);
  assert.match(source, /wand-ring/);
  assert.match(source, /realistic-wand-svg/);
  assert.match(source, /wand-body-path/);
  assert.match(source, /wand-highlight-path/);
  assert.match(source, /wand-shadow-path/);
  assert.match(source, /wand-handle-ridge/);
  assert.match(source, /wood-grain-line/);
  assert.match(source, /wand-tip-glow/);
  assert.match(source, /linearGradient id="wandWood"/);
  assert.match(source, /radialGradient id="knotGlow"/);

  for (const expected of [
    ["Alo", "homora"].join(""),
    "Colloportus",
    ["Lu", "mos"].join(""),
    ["No", "x"].join(""),
    "Glacius",
    "Finite Incantatem",
    "Rennervate",
  ]) {
    assert.match(source, new RegExp(expected, "i"));
  }
});

test("magical mode renders an enchanted school hall with animated atmosphere", () => {
  const source = read(magicPath);

  assert.match(source, /CASTLE_SILHOUETTES/);
  assert.match(source, /STAINED_GLASS_WINDOWS/);
  assert.match(source, /HOUSE_BANNERS/);
  assert.match(source, /GRAND_STAIRCASES/);
  assert.match(source, /FLOATING_CANDLES/);
  assert.match(source, /RUNE_GLYPHS/);
  assert.match(source, /enchanted-ceiling/);
  assert.match(source, /stained-window/);
  assert.match(source, /house-banner/);
  assert.match(source, /grand-stair/);
  assert.match(source, /wax-seal/);
  assert.match(source, /castle-window/);
  assert.match(source, /floating-candle/);
  assert.match(source, /rune-ring/);
  assert.match(source, /WAND_PARTICLES/);
  assert.match(source, /wand-particle/);
  assert.match(source, /enchanted-mote/);
  assert.match(source, /parchment-panel/);
  assert.match(source, /MagicCircle/);
  assert.match(source, /grand-magic-circle/);
  assert.match(source, /circle-geometry/);
  assert.match(source, /portrait-dust/);
  assert.match(source, /circle-sigil/);
  assert.match(source, /circle-radial/);
  assert.match(source, /circle-cast-flash/);
  assert.match(source, /button-magic-circle/);
  assert.match(source, /button-rune-burst/);
  assert.match(source, /button-spell-wave/);
  assert.match(source, /castPulse/);
  assert.match(source, /castTone/);
  assert.match(source, /key=\{`circle-\$\{castPulse\}`\}/);
  assert.match(source, /greatHallDrift/);
  assert.match(source, /glassGlow/);
  assert.match(source, /bannerSway/);
  assert.match(source, /staircaseShift/);
  assert.match(source, /candleFloat/);
  assert.match(source, /flameFlicker/);
  assert.match(source, /runeOrbit/);
  assert.match(source, /wandParticleDrift/);
  assert.match(source, /enchantedMoteDrift/);
  assert.match(source, /circleOpen/);
  assert.match(source, /circleSpin/);
  assert.match(source, /circleFlash/);
  assert.match(source, /portraitDustOrbit/);
  assert.match(source, /buttonCircleCast/);
  assert.match(source, /buttonRuneBurst/);
  assert.match(source, /buttonSpellWave/);
});

test("magical mode keeps room-specific portrait without a second artwork card", () => {
  const source = read(magicPath);

  assert.match(source, /type MagicSeasonKey = "spring" \| "summer" \| "autumn" \| "winter"/);
  assert.match(source, /const SEASONAL_CONCEPTS/);
  assert.match(source, /living-portrait/);
  assert.match(source, /seasonFromRoomName/);
  assert.match(source, /const roomSeason = seasonFromRoomName\(roomName\)/);
  assert.match(source, /getSeasonConcept\(roomSeason \?\? "spring"\)/);
  assert.doesNotMatch(source, /season-concept-gallery|season-feature-card|season-card-copy/);
  assert.doesNotMatch(source, /MOVING_PORTRAITS|portrait-gallery|moving-portrait|portrait-face/);
  assert.doesNotMatch(source, /season-thumb-rail/);
  assert.doesNotMatch(source, /season-thumb-card/);
  assert.doesNotMatch(source, /selectedSeason/);
  assert.doesNotMatch(source, /setSelectedSeason/);
  assert.doesNotMatch(source, /aria-pressed=\{concept\.key/);

  assert.doesNotMatch(source, /\/magic-seasons\//);
});

test("seasonal concept image assets remain bundled", () => {
  for (const filename of ["spring.jpg", "summer.jpg", "autumn.jpg", "winter.jpg"]) {
    const filePath = path.join(magicSeasonDir, filename);
    assert.equal(fs.existsSync(filePath), true, `${filename} should exist`);
    assert.ok(fs.statSync(filePath).size > 80_000, `${filename} should contain optimized concept art`);
  }
});

test("magical moving portrait is fixed to the current room and plays silently", () => {
  const source = read(magicPath);

  for (const [room, file] of [
    ["HARU", "spring.mp4"],
    ["NATU", "summer.mp4"],
    ["AKI", "autumn.mp4"],
    ["FUYU", "winter.mp4"],
  ]) {
    assert.match(source, new RegExp(`title: "${room}"[\\s\\S]*?portrait: "/magic-portraits/${file}\\?v=frame-crop-1"`));
    const videoPath = path.join(magicPortraitDir, file);
    const posterPath = videoPath.replace(/\.mp4$/, ".jpg");
    assert.equal(fs.existsSync(videoPath), true);
    assert.ok(fs.statSync(videoPath).size > 100_000, `${file} should contain video`);
    assert.equal(fs.existsSync(posterPath), true);
    assert.ok(fs.statSync(posterPath).size > 10_000, `${file} should have a matching still poster`);
  }

  assert.match(source, /src=\{roomConcept\.portrait\}/);
  assert.match(source, /roomSeason && \(/);
  assert.match(source, /<video[\s\S]*?autoPlay[\s\S]*?loop[\s\S]*?muted[\s\S]*?playsInline/);
  assert.doesNotMatch(source, /\.living-portrait\s*\{[^}]*mix-blend-mode/);
  assert.match(source, /\.living-portrait\s*\{[^}]*drop-shadow/);
  assert.doesNotMatch(source, /aspect-ratio: 9 \/ 16/);
  assert.doesNotMatch(source, /season-thumb-rail/);
});

test("supplied ornate frame overlays the cropped moving portrait in every room", () => {
  const source = read(magicPath);

  assert.equal(fs.existsSync(ornateFramePath), true);
  assert.ok(fs.statSync(ornateFramePath).size > 100_000);
  assert.match(source, /className="portrait-window"/);
  assert.match(source, /className="portrait-frame-image"/);
  assert.match(source, /src="\/magic-portraits\/ornate-frame\.png"/);
  assert.match(source, /\.portrait-window video\s*\{[^}]*width: 116%/);
  assert.match(source, /\.portrait-window\s*\{[^}]*left: 19%/);
});

test("magical hero gives the moving portrait priority over the wand", () => {
  const source = read(magicPath);

  assert.match(source, /className="magic-hero-art"/);
  assert.match(source, /\.magic-hero-art\s*\{[^}]*position: relative/);
  assert.match(source, /\.magic-hero-art\s*\{[^}]*height: 320px/);
  assert.match(source, /\.living-portrait\s*\{[^}]*width: min\(63vw, 220px\)/);
  assert.match(source, /\.hero-casting-stage \.wand-stage\s*\{[^}]*scale\(0\.34\)/);
  assert.match(source, /className="magic-primary-grid grid grid-cols-2 gap-1\.5"/);
  assert.match(source, /className="magic-light-grid grid grid-cols-4 gap-1\.5"/);
  assert.match(source, /className="magic-scene-grid grid grid-cols-3 gap-1\.5"/);
  assert.match(source, /min-h-\[52px\]/);
  assert.doesNotMatch(source, /min-h-\[88px\]/);
});

test("galaxy controls have distinct celestial icons and a casting effect", () => {
  const source = read(magicPath);

  assert.match(source, /galaxy-rite/);
  assert.match(source, /action="galaxy_on"[^>]*Icon=\{Orbit\}/);
  assert.match(source, /action="galaxy_off"[^>]*Icon=\{Eclipse\}/);
  assert.match(source, /galaxy-cast-veil/);
  assert.match(source, /@keyframes galaxyBloom/);
  assert.match(source, /onCast\(incantation, tone, action\)/);
});

test("each magical action gives its lucide icon a runic seal", () => {
  const source = read(magicPath);

  assert.match(source, /const ACTION_SIGILS/);
  assert.match(source, /className="spell-seal"/);
  assert.match(source, /className="spell-seal-rune"/);
  assert.match(source, /\.spell-seal\s*\{/);
  assert.match(source, /@keyframes sealGlimmer/);
});

test("magical controls use engraved spell tiles and compact ritual buttons", () => {
  const source = read(magicPath);

  assert.match(source, /className=\{`spell-tile parchment-panel/);
  assert.match(source, /className="spell-tile-engraving"/);
  assert.match(source, /className="spell-tile-label\b/);
  assert.match(source, /className=\{`spell-choice/);
  assert.match(source, /className=\{`spell-command/);
  assert.match(source, /\.spell-tile::before/);
  assert.match(source, /\.spell-tile::after/);
  assert.match(source, /@keyframes spellTileSheen/);
  assert.match(source, /\.spell-tile:focus-visible/);
});

test("each spell family has a distinct emblem silhouette and off-state", () => {
  const source = read(magicPath);

  assert.match(source, /const ACTION_EMBLEM/);
  for (const emblem of ["ward", "frost", "radiance", "lantern", "cosmos", "hearth", "dream", "passage"]) {
    assert.match(source, new RegExp(`data-emblem="${emblem}"`));
  }
  assert.match(source, /data-emblem=\{ACTION_EMBLEM\[action\]/);
  assert.match(source, /data-dormant=\{action\.endsWith\("_off"\)/);
  assert.match(source, /\.spell-tile\[data-dormant="true"\] \.spell-seal::after/);
  assert.match(source, /action="ac_off"[^\n]*Icon=\{Snowflake\}/);
  assert.match(source, /action="wafu_off"[^\n]*Icon=\{Lamp\}/);
  assert.match(source, /action="away"[^\n]*Icon=\{DoorOpen\}/);
});

test("magical wake light renders both localized wake modes", () => {
  const source = read(magicPath);

  assert.match(source, /wake-mode-selector/);
  assert.match(source, /wakeFlameName/);
  assert.match(source, /wakeFlameDescription/);
  assert.match(source, /wakeHorizonName/);
  assert.match(source, /wakeHorizonDescription/);
  assert.match(source, /selectWakeMode\("flame_on"\)/);
  assert.match(source, /selectWakeMode\("horizon_rise"\)/);
  assert.match(source, /nextMode === "flame_on" \? "Lumos" : "Rennervate"/);
  assert.match(source, /whisperIncantation\(incantation, roomSeason, muted, tone\)/);
});

test("magical buttons cast after the spoken spell and animate on press", () => {
  const source = read(magicPath);

  assert.match(source, /audio\.onended = \(\) => \{[\s\S]*?onFinished\(\)/);
  assert.match(source, /utterance\.onend = onFinished/);
  assert.match(source, /utterance\.onerror = onFinished/);
  assert.match(source, /if \(sequence !== activeIncantationSequence\) return;/);
  assert.match(source, /magicIncantationEcho\(tone\)/);
  assert.match(source, /primeMagicAudio\(\)/);
  assert.doesNotMatch(source, /magicActionStart\(/);
  assert.doesNotMatch(source, /magicActionResolve\(/);
  assert.match(source, /onCast: \(text: string, tone: keyof typeof TONE\) => void/);
  assert.match(source, /onCast\(incantation, tone\)/);
  assert.match(source, /setCastPulse/);
  assert.match(source, /setCastTone/);
  assert.match(source, /castTarget/);
  assert.match(source, /wake-set-circle/);
  assert.match(source, /wake-clear-circle/);
  assert.match(source, /is-casting/);
});

test("magical spell voice mp3 assets are bundled for natural female playback", () => {
  const spells = [
    "spell-01-alohomora.mp3",
    "spell-02-colloportus.mp3",
    "spell-03-glacius.mp3",
    "spell-04-finite-incantatem.mp3",
    "spell-05-lumos.mp3",
    "spell-06-nox.mp3",
    "spell-07-lumos-solem.mp3",
    "spell-08-lumos-maxima.mp3",
    "spell-09-revelio.mp3",
    "spell-10-muffliato.mp3",
    "spell-11-rennervate.mp3",
  ];
  const variantDirs = ["", "variants/emma", "variants/maisie", "variants/libby", "variants/natasha", "variants/sonia"];

  for (const variantDir of variantDirs) {
    for (const filename of spells) {
      const relativePath = path.join(variantDir, filename);
      const filePath = path.join(magicVoiceDir, relativePath);
      assert.equal(fs.existsSync(filePath), true, `${relativePath} should exist`);
      assert.ok(fs.statSync(filePath).size > 5_000, `${relativePath} should contain generated voice audio`);
    }
  }
});
