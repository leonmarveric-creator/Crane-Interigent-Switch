"use client";

import { rememberLang } from "@/lib/langCookie";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import {
  AlarmClock,
  Check,
  DoorOpen,
  Flame,
  Globe,
  Home,
  Lamp,
  Lightbulb,
  Loader2,
  LockKeyhole,
  LockKeyholeOpen,
  Moon,
  Orbit,
  Eclipse,
  PanelsTopLeft,
  Power,
  Snowflake,
  Sunrise,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { callDevice, type DeviceAction } from "@/lib/deviceClient";
import { GX, LANGS, LANG_LABEL, T, type Lang } from "@/lib/i18n";
import EntranceKeyButton from "@/components/EntranceKeyButton";
import type { WakeLightMode } from "@/lib/wakePrewake";
import { magicIncantationEcho, primeMagicAudio, setMuted as sfxSetMuted, spellCast } from "@/lib/sfx";
import AddToHomePrompt from "@/components/AddToHomePrompt";

export interface MagicalProps {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean;
  posterUrl?: string | null;
  hasGalaxy?: boolean;
  hasNest?: boolean;
  hasWafu?: boolean;
  onSwitchTech?: () => void;
  onSwitchWafu?: () => void;
  guestName?: string | null;
  entranceHref?: string | null;
}

const MAGIC_COPY: Record<Lang, {
  mode: string;
  tech: string;
  wafu: string;
  circles: string;
  lights: string;
  scenes: string;
  muted: string;
  sound: string;
}> = {
  ja: {
    mode: "マジカル",
    tech: "ハイテク",
    wafu: "和風",
    circles: "コントロール",
    lights: "光の術式",
    scenes: "シーン",
    muted: "消音",
    sound: "音あり",
  },
  en: {
    mode: "Magical",
    tech: "Hi-Tech",
    wafu: "Wafu",
    circles: "Controls",
    lights: "Lightwork",
    scenes: "Scenes",
    muted: "Muted",
    sound: "Sound",
  },
  zh: {
    mode: "魔法",
    tech: "高科技",
    wafu: "和风",
    circles: "控制",
    lights: "灯光术式",
    scenes: "场景",
    muted: "静音",
    sound: "声音",
  },
  ko: {
    mode: "매지컬",
    tech: "하이테크",
    wafu: "와풍",
    circles: "컨트롤",
    lights: "빛의 주문",
    scenes: "장면",
    muted: "음소거",
    sound: "소리",
  },
};

const SPELL_INCANTATIONS: Partial<Record<DeviceAction | "alarm", string[]>> = {
  unlock: ["Alohomora"],
  lock: ["Colloportus"],
  ac_on: ["Glacius"],
  ac_off: ["Finite Incantatem"],
  light_on: ["Lumos"],
  light_off: ["Nox"],
  wafu_on: ["Lumos Solem"],
  wafu_on_warm: ["Lumos Solem"],
  wafu_off: ["Nox"],
  galaxy_on: ["Lumos Maxima"],
  galaxy_off: ["Nox"],
  nest_on: ["Lumos Solem"],
  nest_off: ["Nox"],
  welcome: ["Revelio"],
  good_night: ["Muffliato", "Nox"],
  dream_fade: ["Muffliato", "Nox"],
  away: ["Finite Incantatem"],
  alarm: ["Rennervate"],
};

const SPELL_VOICE_AUDIO_BASE = "/audio/voice/magic/";
type MagicSeasonKey = "spring" | "summer" | "autumn" | "winter";
const ROOM_VOICE_VARIANT: Record<MagicSeasonKey, string> = {
  spring: "emma",
  summer: "libby",
  autumn: "sonia",
  winter: "natasha",
};
const ROOM_BROWSER_VOICES: Record<MagicSeasonKey, string[]> = {
  spring: ["Microsoft Emma Online (Natural) - English (United States)", "Samantha"],
  summer: ["Microsoft Libby Online (Natural) - English (United Kingdom)", "Moira"],
  autumn: ["Microsoft Sonia Online (Natural) - English (United Kingdom)", "Tessa"],
  winter: ["Microsoft Natasha Online (Natural) - English (Australia)", "Karen"],
};
const SPELL_VOICE_AUDIO_BY_TEXT: Record<string, string[]> = {
  Alohomora: [
    "spell-01-alohomora.mp3",
    "variants/emma/spell-01-alohomora.mp3",
    "variants/maisie/spell-01-alohomora.mp3",
    "variants/libby/spell-01-alohomora.mp3",
    "variants/natasha/spell-01-alohomora.mp3",
    "variants/sonia/spell-01-alohomora.mp3",
  ],
  Colloportus: [
    "spell-02-colloportus.mp3",
    "variants/emma/spell-02-colloportus.mp3",
    "variants/maisie/spell-02-colloportus.mp3",
    "variants/libby/spell-02-colloportus.mp3",
    "variants/natasha/spell-02-colloportus.mp3",
    "variants/sonia/spell-02-colloportus.mp3",
  ],
  Glacius: [
    "spell-03-glacius.mp3",
    "variants/emma/spell-03-glacius.mp3",
    "variants/maisie/spell-03-glacius.mp3",
    "variants/libby/spell-03-glacius.mp3",
    "variants/natasha/spell-03-glacius.mp3",
    "variants/sonia/spell-03-glacius.mp3",
  ],
  "Finite Incantatem": [
    "spell-04-finite-incantatem.mp3",
    "variants/emma/spell-04-finite-incantatem.mp3",
    "variants/maisie/spell-04-finite-incantatem.mp3",
    "variants/libby/spell-04-finite-incantatem.mp3",
    "variants/natasha/spell-04-finite-incantatem.mp3",
    "variants/sonia/spell-04-finite-incantatem.mp3",
  ],
  Lumos: [
    "spell-05-lumos.mp3",
    "variants/emma/spell-05-lumos.mp3",
    "variants/maisie/spell-05-lumos.mp3",
    "variants/libby/spell-05-lumos.mp3",
    "variants/natasha/spell-05-lumos.mp3",
    "variants/sonia/spell-05-lumos.mp3",
  ],
  Nox: [
    "spell-06-nox.mp3",
    "variants/emma/spell-06-nox.mp3",
    "variants/maisie/spell-06-nox.mp3",
    "variants/libby/spell-06-nox.mp3",
    "variants/natasha/spell-06-nox.mp3",
    "variants/sonia/spell-06-nox.mp3",
  ],
  "Lumos Solem": [
    "spell-07-lumos-solem.mp3",
    "variants/emma/spell-07-lumos-solem.mp3",
    "variants/maisie/spell-07-lumos-solem.mp3",
    "variants/libby/spell-07-lumos-solem.mp3",
    "variants/natasha/spell-07-lumos-solem.mp3",
    "variants/sonia/spell-07-lumos-solem.mp3",
  ],
  "Lumos Maxima": [
    "spell-08-lumos-maxima.mp3",
    "variants/emma/spell-08-lumos-maxima.mp3",
    "variants/maisie/spell-08-lumos-maxima.mp3",
    "variants/libby/spell-08-lumos-maxima.mp3",
    "variants/natasha/spell-08-lumos-maxima.mp3",
    "variants/sonia/spell-08-lumos-maxima.mp3",
  ],
  Revelio: [
    "spell-09-revelio.mp3",
    "variants/emma/spell-09-revelio.mp3",
    "variants/maisie/spell-09-revelio.mp3",
    "variants/libby/spell-09-revelio.mp3",
    "variants/natasha/spell-09-revelio.mp3",
    "variants/sonia/spell-09-revelio.mp3",
  ],
  Muffliato: [
    "spell-10-muffliato.mp3",
    "variants/emma/spell-10-muffliato.mp3",
    "variants/maisie/spell-10-muffliato.mp3",
    "variants/libby/spell-10-muffliato.mp3",
    "variants/natasha/spell-10-muffliato.mp3",
    "variants/sonia/spell-10-muffliato.mp3",
  ],
  Rennervate: [
    "spell-11-rennervate.mp3",
    "variants/emma/spell-11-rennervate.mp3",
    "variants/maisie/spell-11-rennervate.mp3",
    "variants/libby/spell-11-rennervate.mp3",
    "variants/natasha/spell-11-rennervate.mp3",
    "variants/sonia/spell-11-rennervate.mp3",
  ],
};

const NATURAL_FEMALE_VOICE_NAMES = [
  "Ava (Premium)",
  "Microsoft Emma Online (Natural) - English (United States)",
  "Microsoft Ava Online (Natural) - English (United States)",
  "Microsoft Maisie Online (Natural) - English (United Kingdom)",
  "Microsoft Sonia Online (Natural) - English (United Kingdom)",
  "Microsoft Libby Online (Natural) - English (United Kingdom)",
  "Microsoft Natasha Online (Natural) - English (Australia)",
  "Samantha",
  "Ava",
  "Emma",
  "Maisie",
  "Allison",
  "Serena",
  "Tessa",
  "Moira",
  "Karen",
  "Susan",
  "Zira",
  "Hazel",
  "Google US English",
  "Google UK English Female",
] as const;

const REALISTIC_VOICE_RE = /natural|premium|enhanced|neural|online/i;
const FEMALE_VOICE_RE = /female|samantha|ava|emma|maisie|allison|serena|tessa|moira|sonia|libby|natasha|susan|zira|hazel|karen|kate|fiona|nicky|victoria|joanna|salli|kendra|kimberly|google us english/i;

let activeSpellVoiceAudio: HTMLAudioElement | null = null;
let activeIncantationSequence = 0;

const SEASONAL_CONCEPTS: Array<{
  key: MagicSeasonKey;
  portrait: string;
  portraitPoster: string;
  title: string;
  bg: string;
}> = [
  {
    key: "spring",
    title: "HARU",
    portrait: "/magic-portraits/spring.mp4?v=frame-crop-1",
    portraitPoster: "/magic-portraits/spring.jpg?v=frame-crop-1",
    bg: "radial-gradient(circle at 20% 18%, rgba(255, 181, 205, 0.32), transparent 34%)",
  },
  {
    key: "summer",
    title: "NATU",
    portrait: "/magic-portraits/summer.mp4?v=frame-crop-1",
    portraitPoster: "/magic-portraits/summer.jpg?v=frame-crop-1",
    bg: "radial-gradient(circle at 72% 16%, rgba(103, 218, 255, 0.32), transparent 34%)",
  },
  {
    key: "autumn",
    title: "AKI",
    portrait: "/magic-portraits/autumn.mp4?v=frame-crop-1",
    portraitPoster: "/magic-portraits/autumn.jpg?v=frame-crop-1",
    bg: "radial-gradient(circle at 76% 26%, rgba(255, 134, 83, 0.34), transparent 36%)",
  },
  {
    key: "winter",
    title: "FUYU",
    portrait: "/magic-portraits/winter.mp4?v=frame-crop-1",
    portraitPoster: "/magic-portraits/winter.jpg?v=frame-crop-1",
    bg: "radial-gradient(circle at 50% 6%, rgba(188, 215, 255, 0.34), transparent 36%)",
  },
];

const STAR_POINTS = [
  [8, 12, 1.5, 0.1], [18, 26, 1, 1.2], [29, 9, 1.4, 0.6], [43, 18, 1, 1.8],
  [59, 11, 1.5, 0.3], [72, 28, 1, 1.4], [88, 14, 1.2, 0.8], [13, 58, 1.4, 1.6],
  [35, 73, 1, 0.4], [52, 63, 1.5, 1.1], [79, 70, 1, 0.2], [91, 52, 1.3, 1.7],
] as const;

const ENCHANTED_MOTES = [
  { left: 7, top: 78, size: 3, delay: 0.2, duration: 8.4, x: 24, y: -54, color: "#ffe8a8" },
  { left: 16, top: 48, size: 2, delay: 2.1, duration: 7.2, x: -18, y: -42, color: "#b8e8ff" },
  { left: 27, top: 88, size: 4, delay: 1.2, duration: 9.1, x: 32, y: -68, color: "#ffd1d9" },
  { left: 39, top: 62, size: 2, delay: 3.4, duration: 6.8, x: -26, y: -48, color: "#d7c5ff" },
  { left: 54, top: 92, size: 3, delay: 0.8, duration: 8.8, x: 19, y: -72, color: "#fff1bd" },
  { left: 66, top: 68, size: 2, delay: 2.8, duration: 7.6, x: -21, y: -58, color: "#aef5df" },
  { left: 78, top: 86, size: 4, delay: 1.7, duration: 9.4, x: 26, y: -64, color: "#ffd6a1" },
  { left: 91, top: 58, size: 2, delay: 4.1, duration: 7.1, x: -17, y: -46, color: "#c7dcff" },
] as const;

const WAND_PARTICLES = [
  { x: 18, y: -24, size: 4, delay: 0.0, duration: 2.8, color: "#fff4c9" },
  { x: 34, y: -8, size: 2, delay: 0.35, duration: 3.2, color: "#b9e8ff" },
  { x: 24, y: 17, size: 3, delay: 0.72, duration: 2.6, color: "#ffe0a0" },
  { x: -8, y: -30, size: 2, delay: 1.05, duration: 3.4, color: "#e7d6ff" },
  { x: 42, y: -28, size: 3, delay: 1.42, duration: 3.0, color: "#fff7dc" },
  { x: 13, y: 31, size: 2, delay: 1.78, duration: 2.7, color: "#aef5df" },
  { x: -18, y: 15, size: 3, delay: 2.1, duration: 3.3, color: "#ffd2d9" },
  { x: 53, y: 9, size: 2, delay: 2.46, duration: 2.9, color: "#c8dcff" },
  { x: 4, y: -44, size: 2, delay: 2.75, duration: 3.5, color: "#ffe8a8" },
] as const;

const CASTLE_SILHOUETTES = [
  [8, 36, 168, 0.1], [18, 58, 118, 0.7], [31, 42, 148, 0.3], [54, 64, 132, 0.9],
  [69, 40, 162, 0.5], [83, 54, 124, 1.1],
] as const;

const STAINED_GLASS_WINDOWS = [
  { left: 9, top: 15, width: 48, height: 118, a: "#7a1930", b: "#d6aa4b", c: "#244f69", delay: 0.1 },
  { left: 45, top: 8, width: 58, height: 146, a: "#224c55", b: "#f2d089", c: "#6f2237", delay: 0.7 },
  { left: 82, top: 16, width: 46, height: 112, a: "#1e513b", b: "#b9c76a", c: "#633472", delay: 1.2 },
] as const;

const HOUSE_BANNERS = [
  { left: 4, top: 27, width: 36, height: 132, a: "#6c1730", b: "#d5a94d", sigil: "✦", delay: 0.2 },
  { left: 18, top: 22, width: 32, height: 116, a: "#1e4a43", b: "#c7c78f", sigil: "◇", delay: 0.9 },
  { left: 78, top: 24, width: 34, height: 124, a: "#1f426a", b: "#b9c9d9", sigil: "☾", delay: 0.4 },
  { left: 91, top: 30, width: 30, height: 106, a: "#4f2b67", b: "#c29f67", sigil: "✧", delay: 1.4 },
] as const;

const GRAND_STAIRCASES = [
  { left: -4, top: 76, width: 154, tilt: -17, delay: 0.2 },
  { left: 62, top: 74, width: 168, tilt: 15, delay: 1.1 },
] as const;

const FLOATING_CANDLES = [
  [12, 18, 0.78, 0.2], [24, 12, 0.62, 1.0], [38, 20, 0.72, 0.5], [52, 13, 0.58, 1.5],
  [67, 22, 0.76, 0.8], [82, 15, 0.64, 1.2], [17, 40, 0.52, 1.8], [76, 42, 0.5, 0.4],
] as const;

const RUNE_GLYPHS = ["✦", "◇", "✧", "☾", "✶", "✷"] as const;
const MAGIC_CIRCLE_RADIALS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const PORTRAIT_DUST = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5,
  delay: (i % 5) * -0.83,
  size: i % 4 === 0 ? 3 : 2,
}));
const BUTTON_RUNE_GLYPHS = ["✦", "✧", "☾", "◇"] as const;

const TONE: Record<string, { border: string; ink: string; glow: string; fill: string }> = {
  gold: { border: "rgba(245, 194, 107, 0.45)", ink: "#ffe7b3", glow: "rgba(245, 194, 107, 0.42)", fill: "rgba(88, 55, 25, 0.46)" },
  teal: { border: "rgba(114, 220, 205, 0.42)", ink: "#b7fff5", glow: "rgba(72, 205, 190, 0.35)", fill: "rgba(16, 69, 73, 0.48)" },
  rose: { border: "rgba(255, 151, 156, 0.42)", ink: "#ffd1d4", glow: "rgba(218, 88, 98, 0.34)", fill: "rgba(86, 29, 43, 0.48)" },
  blue: { border: "rgba(143, 199, 255, 0.42)", ink: "#d5ebff", glow: "rgba(70, 142, 220, 0.34)", fill: "rgba(23, 52, 86, 0.5)" },
  green: { border: "rgba(164, 228, 143, 0.4)", ink: "#d9ffd0", glow: "rgba(106, 189, 92, 0.32)", fill: "rgba(40, 77, 43, 0.44)" },
};

const ACTION_SIGILS: Partial<Record<DeviceAction, string>> = {
  unlock: "◇", lock: "✦", ac_on: "❄", ac_off: "✧",
  light_on: "☼", light_off: "☾", wafu_on: "✺", wafu_on_warm: "✺", wafu_off: "☾",
  galaxy_on: "✶", galaxy_off: "◈", nest_on: "✿", nest_off: "✧",
  welcome: "✧", good_night: "☾", away: "◇", dream_fade: "☾",
};

const ACTION_EMBLEM: Partial<Record<DeviceAction, "ward" | "frost" | "radiance" | "lantern" | "nest" | "cosmos" | "hearth" | "dream" | "passage">> = {
  unlock: "ward", lock: "ward",
  ac_on: "frost", ac_off: "frost",
  light_on: "radiance", light_off: "radiance",
  wafu_on: "lantern", wafu_on_warm: "lantern", wafu_off: "lantern",
  nest_on: "nest", nest_off: "nest",
  galaxy_on: "cosmos", galaxy_off: "cosmos",
  welcome: "hearth", good_night: "dream", away: "passage", dream_fade: "dream",
};

function seasonFromRoomName(roomName: string): MagicSeasonKey | null {
  const normalized = roomName.toLowerCase();
  if (/haru|spring|春/.test(normalized)) return "spring";
  if (/natu|natsu|summer|夏/.test(normalized)) return "summer";
  if (/aki|autumn|fall|秋/.test(normalized)) return "autumn";
  if (/fuyu|winter|冬|雪/.test(normalized)) return "winter";
  return null;
}

function getSeasonConcept(key: MagicSeasonKey) {
  return SEASONAL_CONCEPTS.find((concept) => concept.key === key) ?? SEASONAL_CONCEPTS[0];
}

function vibe() {
  try {
    (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(16);
  } catch {
    /* noop */
  }
}

function pickIncantation(action: DeviceAction | "alarm") {
  const options = SPELL_INCANTATIONS[action] ?? SPELL_INCANTATIONS.welcome ?? ["Revelio"];
  return options[Math.floor(Math.random() * options.length)];
}

function pickSpellVoiceUrl(text: string, season: MagicSeasonKey): string | null {
  const variant = ROOM_VOICE_VARIANT[season];
  const filename = SPELL_VOICE_AUDIO_BY_TEXT[text]?.find((path) => path.startsWith(`variants/${variant}/`));
  return filename ? `${SPELL_VOICE_AUDIO_BASE}${filename}` : null;
}

function stopNaturalIncantation() {
  if (!activeSpellVoiceAudio) return;
  activeSpellVoiceAudio.onended = null;
  activeSpellVoiceAudio.onerror = null;
  activeSpellVoiceAudio.pause();
  activeSpellVoiceAudio.currentTime = 0;
  activeSpellVoiceAudio = null;
}

function scoreIncantationVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  return (
    (NATURAL_FEMALE_VOICE_NAMES.some((voiceName) => voiceName.toLowerCase() === name) ? 500 : 0) +
    (REALISTIC_VOICE_RE.test(name) ? 180 : 0) +
    (FEMALE_VOICE_RE.test(name) ? 140 : 0) +
    (lang === "en-us" ? 50 : 0) +
    (lang.startsWith("en") ? 30 : 0) +
    (voice.localService ? 8 : 0)
  );
}

function pickFemaleIncantationVoice(season: MagicSeasonKey): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = Array.from(window.speechSynthesis.getVoices());
  if (!voices.length) return null;
  const namedVoice = ROOM_BROWSER_VOICES[season]
    .map((name) => voices.find((voice) => voice.name === name))
    .find(Boolean);
  if (namedVoice) return namedVoice;
  const naturalVoice = NATURAL_FEMALE_VOICE_NAMES
    .map((name) => voices.find((voice) => voice.name === name))
    .find(Boolean);
  if (naturalVoice) return naturalVoice;
  return [...voices].sort((a, b) => scoreIncantationVoice(b) - scoreIncantationVoice(a))[0] ?? null;
}

function speakIncantationWithBrowser(text: string, season: MagicSeasonKey, onFinished: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onFinished();
    return;
  }
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickFemaleIncantationVoice(season);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.82;
    utterance.onend = onFinished;
    utterance.onerror = onFinished;
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.();
    window.speechSynthesis.speak(utterance);
  } catch {
    onFinished();
  }
}

function playNaturalIncantation(text: string, season: MagicSeasonKey, onFinished: () => void, isCurrent: () => boolean): boolean {
  const url = pickSpellVoiceUrl(text, season);
  if (!url || typeof Audio === "undefined") return false;
  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    activeSpellVoiceAudio = audio;
    audio.onended = () => {
      if (activeSpellVoiceAudio === audio) activeSpellVoiceAudio = null;
      onFinished();
    };
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted || !isCurrent()) return;
      fallbackStarted = true;
      if (activeSpellVoiceAudio === audio) activeSpellVoiceAudio = null;
      speakIncantationWithBrowser(text, season, onFinished);
    };
    audio.onerror = fallback;
    void audio.play().catch(fallback);
    return true;
  } catch {
    return false;
  }
}

function whisperIncantation(text: string, season: MagicSeasonKey, muted: boolean, tone: keyof typeof TONE) {
  const sequence = ++activeIncantationSequence;
  stopNaturalIncantation();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  if (muted) return;
  primeMagicAudio();
  let finished = false;
  const isCurrent = () => sequence === activeIncantationSequence;
  const onFinished = () => {
    if (finished) return;
    finished = true;
    if (sequence !== activeIncantationSequence) return;
    magicIncantationEcho(tone);
  };
  if (playNaturalIncantation(text, season, onFinished, isCurrent)) return;
  speakIncantationWithBrowser(text, season, onFinished);
}

function MagicCircle({
  activeKey,
  tone,
}: {
  activeKey: number;
  tone: keyof typeof TONE;
}) {
  const skin = TONE[tone];
  const style = {
    "--circle-ink": skin.ink,
    "--circle-border": skin.border,
    "--circle-glow": skin.glow,
  } as CSSProperties;

  return (
    <div className={`grand-magic-circle ${activeKey > 0 ? "circle-active" : ""}`} style={style} aria-hidden="true">
      <span className="circle-orbit orbit-a" />
      <span className="circle-orbit orbit-b" />
      <span className="circle-orbit orbit-c" />
      <svg className="circle-geometry" viewBox="0 0 240 240" focusable="false">
        <circle cx="120" cy="120" r="106" fill="none" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 5" />
        <circle cx="120" cy="120" r="74" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <path d="M120 30 198 165 42 165Z M120 210 42 75 198 75Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <path d="M120 46 194 120 120 194 46 120Z M120 60 180 120 120 180 60 120Z" fill="none" stroke="currentColor" strokeWidth="0.65" />
      </svg>
      {MAGIC_CIRCLE_RADIALS.map((angle) => (
        <span key={angle} className="circle-radial" style={{ transform: `rotate(${angle}deg)` }} />
      ))}
      {RUNE_GLYPHS.map((glyph, i) => (
        <span key={`${glyph}-${i}`} className="circle-sigil" style={{ transform: `rotate(${i * 60}deg) translateY(-122px) rotate(${-i * 60}deg)` }}>
          {glyph}
        </span>
      ))}
      <span key={`flash-${activeKey}`} className="circle-cast-flash" />
      <span className="circle-core" />
    </div>
  );
}

function Wand({ active }: { active: boolean }) {
  return (
    <div className={`wand-stage ${active ? "wand-stage-active" : ""}`} aria-hidden="true">
      <span className="rune-ring">
        {RUNE_GLYPHS.map((glyph, i) => (
          <span key={glyph} className="rune-glyph" style={{ transform: `rotate(${i * 60}deg) translateY(-82px) rotate(${-i * 60}deg)` }}>
            {glyph}
          </span>
        ))}
      </span>
      <span className="wand-aura" />
      <svg className="realistic-wand-svg" viewBox="0 0 360 150" role="img" aria-label="wooden magic wand">
        <defs>
          <linearGradient id="wandWood" x1="18" y1="114" x2="321" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1a0c07" />
            <stop offset="0.18" stopColor="#3a1f12" />
            <stop offset="0.42" stopColor="#8a5429" />
            <stop offset="0.62" stopColor="#b47a3a" />
            <stop offset="0.82" stopColor="#5e3218" />
            <stop offset="1" stopColor="#1c0d08" />
          </linearGradient>
          <linearGradient id="wandHighlight" x1="42" y1="92" x2="302" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffe29e" stopOpacity="0" />
            <stop offset="0.42" stopColor="#ffe29e" stopOpacity="0.62" />
            <stop offset="1" stopColor="#ffe29e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wandShadow" x1="34" y1="112" x2="308" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#000000" stopOpacity="0.68" />
            <stop offset="0.52" stopColor="#000000" stopOpacity="0.18" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.58" />
          </linearGradient>
          <radialGradient id="knotGlow" cx="50%" cy="50%" r="62%">
            <stop offset="0" stopColor="#ffd89a" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="#6b3418" stopOpacity="0.9" />
            <stop offset="1" stopColor="#120805" stopOpacity="0.95" />
          </radialGradient>
          <filter id="wandDropShadow" x="-18%" y="-40%" width="136%" height="190%">
            <feDropShadow dx="0" dy="10" stdDeviation="7" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        <path className="wand-shadow-path" d="M37 111 C72 93 105 83 143 72 C199 55 252 39 328 27 C333 26 337 27 338 30 C339 33 336 36 331 37 C256 54 203 68 148 85 C109 97 78 109 45 126 C37 130 27 127 24 120 C21 114 29 115 37 111 Z" fill="url(#wandShadow)" opacity="0.48" filter="url(#wandDropShadow)" />
        <path className="wand-body-path" d="M34 102 C73 84 107 75 146 64 C204 48 253 34 329 23 C334 22 338 23 339 26 C340 30 337 32 332 33 C257 48 205 62 150 78 C112 89 81 101 44 119 C36 123 26 121 23 114 C20 107 26 106 34 102 Z" fill="url(#wandWood)" />
        <path className="wand-highlight-path" d="M48 101 C92 82 140 69 206 52 C246 42 285 33 322 27" fill="none" stroke="url(#wandHighlight)" strokeWidth="3.2" strokeLinecap="round" opacity="0.82" />
        <path className="wand-shadow-path" d="M49 116 C86 100 116 91 155 80 C208 65 262 48 330 32" fill="none" stroke="rgba(27,12,6,0.72)" strokeWidth="3.7" strokeLinecap="round" opacity="0.72" />
        <g className="wand-handle-ridge">
          <path d="M25 107 C42 94 62 89 77 91 C83 93 86 101 84 110 C78 120 55 126 38 125 C29 124 22 117 25 107 Z" fill="#211007" />
          <path d="M34 100 C50 92 68 91 80 96" fill="none" stroke="#c8914d" strokeWidth="3" strokeLinecap="round" opacity="0.56" />
          <path d="M43 123 C57 119 71 113 82 105" fill="none" stroke="#6b3b1e" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
          <path className="wand-ring ring-a" d="M75 91 C83 94 87 103 83 111" fill="none" stroke="#e6b669" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
          <path className="wand-ring ring-b" d="M93 84 C101 88 104 96 101 104" fill="none" stroke="#bd8242" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
        </g>
        <g className="wood-grain-line">
          <path className="wand-grain grain-a" d="M73 96 C119 75 173 65 224 49" fill="none" />
          <path className="wand-grain grain-b" d="M84 108 C126 92 167 81 229 61" fill="none" />
          <path className="wand-grain grain-c" d="M133 72 C177 58 210 49 254 39" fill="none" />
          <path className="wand-grain" d="M171 75 C198 69 221 63 244 55" fill="none" opacity="0.46" />
        </g>
        <ellipse className="wand-knot knot-a" cx="143" cy="70" rx="11" ry="6.5" transform="rotate(-17 143 70)" fill="url(#knotGlow)" />
        <ellipse className="wand-knot knot-b" cx="219" cy="51" rx="7" ry="4.4" transform="rotate(-14 219 51)" fill="url(#knotGlow)" opacity="0.72" />
        <path d="M310 25 C319 23 328 22 337 24" fill="none" stroke="#d8a65d" strokeWidth="1.6" strokeLinecap="round" opacity="0.76" />
        <circle className="wand-tip-glow" cx="334" cy="27" r="4.5" />
      </svg>
      {WAND_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="wand-particle"
          style={{
            "--particle-x": `${particle.x}px`,
            "--particle-y": `${particle.y}px`,
            "--particle-size": `${particle.size}px`,
            "--particle-delay": `${particle.delay}s`,
            "--particle-duration": `${particle.duration}s`,
            "--particle-color": particle.color,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#efd79f]/82">
      <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(216,191,134,0.55),transparent)]" />
      {children}
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(216,191,134,0.55))]" />
    </p>
  );
}

function MagicAction({
  roomSlug,
  roomSeason,
  muted,
  admin,
  action,
  value,
  label,
  Icon,
  tone,
  onCast,
}: {
  roomSlug: string;
  roomSeason: MagicSeasonKey;
  muted: boolean;
  admin?: boolean;
  action: DeviceAction;
  value?: string;
  label: string;
  Icon: LucideIcon;
  tone: keyof typeof TONE;
  onCast: (text: string, tone: keyof typeof TONE, action?: DeviceAction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<null | boolean>(null);
  const [castKey, setCastKey] = useState(0);
  const skin = TONE[tone];
  const isGalaxy = action === "galaxy_on" || action === "galaxy_off";
  const style = {
    "--spell-ink": skin.ink,
    "--spell-border": skin.border,
    "--spell-fill": skin.fill,
    "--spell-glow": skin.glow,
  } as CSSProperties;

  const run = async () => {
    if (busy) return;
    const incantation = pickIncantation(action);
    vibe();
    setCastKey((next) => next + 1);
    whisperIncantation(incantation, roomSeason, muted, tone);
    onCast(incantation, tone, action);
    setBusy(true);
    setRes(null);
    const ok = await callDevice(roomSlug, action, admin, value);
    setBusy(false);
    setRes(ok);
    setTimeout(() => setRes(null), 1700);
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      style={style}
      data-action={action}
      data-emblem={ACTION_EMBLEM[action] ?? "radiance"}
      data-dormant={action.endsWith("_off")}
      className={`spell-tile parchment-panel relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden border p-1 text-center disabled:opacity-65 ${isGalaxy ? "galaxy-action" : ""} ${castKey > 0 ? "is-casting" : ""}`}
    >
      <span key={`engraving-${castKey}`} className="spell-tile-engraving" aria-hidden="true" />
      {castKey > 0 && (
        <>
          <span key={`button-circle-${castKey}`} className="button-magic-circle" />
          <span key={`button-runes-${castKey}`} className="button-rune-burst">
            {BUTTON_RUNE_GLYPHS.map((glyph) => <span key={glyph}>{glyph}</span>)}
          </span>
          <span key={`button-wave-${castKey}`} className="button-spell-wave" />
        </>
      )}
      <span className="spell-seal" aria-hidden="true">
        <span className="spell-seal-orbit" />
        {busy ? <Loader2 className="spell-seal-icon h-[18px] w-[18px] animate-spin" /> : <Icon className="spell-seal-icon h-[18px] w-[18px]" strokeWidth={1.55} />}
        <span className="spell-seal-rune">{ACTION_SIGILS[action] ?? "✦"}</span>
      </span>
      <span className="spell-tile-label relative z-10 max-w-full break-words text-[11px] font-semibold leading-[1.15]">{label}</span>
      {res !== null && (
        <span className={`absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${res ? "bg-[#a4e48f] text-[#152316]" : "bg-[#ff979c] text-[#2b1014]"}`}>
          {res ? "✓" : "×"}
        </span>
      )}
    </button>
  );
}

function WakeMagic({
  roomSlug,
  roomSeason,
  muted,
  admin,
  t,
  hasWafu,
  onCast,
}: {
  roomSlug: string;
  roomSeason: MagicSeasonKey;
  muted: boolean;
  admin?: boolean;
  t: typeof T["ja"];
  hasWafu?: boolean;
  onCast: (text: string, tone: keyof typeof TONE) => void;
}) {
  const [time, setTime] = useState("07:00");
  const [mode, setMode] = useState<WakeLightMode>("flame_on");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [castKey, setCastKey] = useState(0);
  const [castTarget, setCastTarget] = useState<"set" | "clear">("set");

  const selectWakeMode = (nextMode: WakeLightMode) => {
    const incantation = nextMode === "flame_on" ? "Lumos" : "Rennervate";
    const tone = nextMode === "flame_on" ? "gold" : "teal";
    setMode(nextMode);
    setState("idle");
    vibe();
    whisperIncantation(incantation, roomSeason, muted, tone);
    onCast(incantation, tone);
  };

  const send = async (clear?: boolean) => {
    const incantation = pickIncantation("alarm");
    vibe();
    setCastTarget(clear ? "clear" : "set");
    setCastKey((next) => next + 1);
    whisperIncantation(incantation, roomSeason, muted, "gold");
    onCast(incantation, "gold");
    setState("busy");
    setErr(null);
    let fireAtIso: string | undefined;
    if (!clear) {
      const [h, m] = time.split(":").map(Number);
      const nowMs = Date.now();
      const jstNow = new Date(nowMs + 9 * 3600 * 1000);
      let fireMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), h - 9, m, 0, 0);
      if (fireMs <= nowMs) fireMs += 24 * 3600 * 1000;
      fireAtIso = new Date(fireMs).toISOString();
    }

    try {
      const res = await fetch(admin ? "/api/admin/test-alarm" : `/api/alarms/${roomSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          admin
            ? { roomSlug, ...(clear ? { clear: true } : { fireAtIso, mode }) }
            : clear
              ? { clear: true }
              : { fireAtIso, mode },
        ),
      });
      if (res.ok) {
        setState(clear ? "idle" : "set");
      } else {
        const j = await res.json().catch(() => ({} as { error?: string }));
        setErr(j?.error === "OUT_OF_STAY" ? "チェックアウト前の時刻にしてください / Set a time before check-out" : j?.error || `ERR ${res.status}`);
        setState("idle");
      }
    } catch (e) {
      setErr((e as Error)?.message || "network error");
      setState("idle");
    }
  };

  return (
    <div className="parchment-panel relative overflow-hidden rounded-lg border border-[#e7ce96]/44 bg-[#2a293b]/88 p-2.5 shadow-[0_0_34px_-15px_rgba(255,205,115,0.72)]">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#ffe7b3]">
        <AlarmClock className="h-[18px] w-[18px]" strokeWidth={1.5} />
        {t.wakeLight}
        <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[#d8bf86]/58">
          {mode === "horizon_rise" ? t.wakeHorizonName : t.wakeFlameName}
        </span>
      </div>
      <div className="wake-mode-selector mt-2" aria-label={t.wakeLight}>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
          <button
            type="button"
            aria-pressed={mode === "flame_on"}
            onClick={() => selectWakeMode("flame_on")}
            className={`spell-choice flex min-h-10 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold ${mode === "flame_on" ? "is-selected" : ""}`}
            data-wake-mode="flame_on"
          >
            <Flame className="h-3.5 w-3.5" strokeWidth={1.6} />
            {t.wakeFlameName}
          </button>
          <button
            type="button"
            aria-pressed={mode === "horizon_rise"}
            disabled={!hasWafu}
            onClick={() => selectWakeMode("horizon_rise")}
            className={`spell-choice flex min-h-10 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${mode === "horizon_rise" ? "is-selected" : ""}`}
            data-wake-mode="horizon_rise"
          >
            <Sunrise className="h-3.5 w-3.5" strokeWidth={1.6} />
            {t.wakeHorizonName}
          </button>
        </div>
        <p className="mt-1.5 min-h-[30px] text-left text-[10.5px] leading-snug text-[#f8ecd1]/72">
          {mode === "horizon_rise" ? t.wakeHorizonDescription : t.wakeFlameDescription}
        </p>
        {!hasWafu && <p className="mt-1 text-left text-[10px] text-[#f5c26b]/58">{t.wakeHorizonUnavailable}</p>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(ev) => { setTime(ev.target.value); setState("idle"); }}
          className="min-w-0 flex-1 rounded-lg border border-[#e7ce96]/36 bg-[#202234]/88 px-2 py-1.5 text-center font-mono text-[20px] text-[#fff0c7] [color-scheme:dark] focus:border-[#f5c26b]/70 focus:outline-none"
        />
        <button
          onClick={() => send(false)}
          disabled={state === "busy"}
          className={`spell-command spell-command-primary relative flex h-[42px] items-center gap-1.5 overflow-hidden px-3 text-[12px] font-semibold disabled:opacity-60 ${castTarget === "set" && castKey > 0 ? "is-casting" : ""}`}
        >
          {castTarget === "set" && castKey > 0 && (
            <>
              <span key={`wake-set-circle-${castKey}`} className="button-magic-circle" />
              <span key={`wake-set-runes-${castKey}`} className="button-rune-burst">
                {BUTTON_RUNE_GLYPHS.map((glyph) => <span key={glyph}>{glyph}</span>)}
              </span>
              <span key={`wake-set-wave-${castKey}`} className="button-spell-wave" />
            </>
          )}
          {state === "busy" && <Loader2 className="relative z-10 h-4 w-4 animate-spin" />}
          {state === "set" && <Check className="relative z-10 h-4 w-4 text-[#a4e48f]" />}
          <span className="relative z-10">{state === "set" ? t.alarmSet : t.setAlarm}</span>
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <button
          onClick={() => send(true)}
          disabled={state === "busy"}
          className={`spell-command spell-command-clear relative overflow-hidden px-2 py-1 text-[12px] font-medium disabled:opacity-60 ${castTarget === "clear" && castKey > 0 ? "is-casting" : ""}`}
        >
          {castTarget === "clear" && castKey > 0 && (
            <>
              <span key={`wake-clear-circle-${castKey}`} className="button-magic-circle" />
              <span key={`wake-clear-runes-${castKey}`} className="button-rune-burst">
                {BUTTON_RUNE_GLYPHS.map((glyph) => <span key={glyph}>{glyph}</span>)}
              </span>
              <span key={`wake-clear-wave-${castKey}`} className="button-spell-wave" />
            </>
          )}
          <span className="relative z-10">{t.clearAlarm}</span>
        </button>
        {err && <p className="text-right text-[11px] text-[#ff979c]">{err}</p>}
      </div>
    </div>
  );
}

export default function MagicalControlPanel({
  roomSlug,
  roomName,
  checkOut,
  initialLang,
  admin,
  posterUrl,
  hasGalaxy,
  hasNest,
  hasWafu,
  onSwitchTech,
  onSwitchWafu,
  guestName,
  entranceHref,
}: MagicalProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [muted, setMuted] = useState(false);
  const [lastIncantation, setLastIncantation] = useState("Revelio");
  const [castPulse, setCastPulse] = useState(0);
  const [castTone, setCastTone] = useState<keyof typeof TONE>("gold");
  const [galaxyCast, setGalaxyCast] = useState<"on" | "off" | null>(null);
  // Dream Fade の説明: 押したあとにだけ表示し、しばらくすると自動で閉じる
  const [dreamInfo, setDreamInfo] = useState(false);
  useEffect(() => {
    if (!dreamInfo) return;
    const id = setTimeout(() => setDreamInfo(false), 20000);
    return () => clearTimeout(id);
  }, [dreamInfo]);
  const t = T[lang];
  const copy = MAGIC_COPY[lang];
  const roomSeason = seasonFromRoomName(roomName);
  const roomConcept = getSeasonConcept(roomSeason ?? "spring");
  const bgStyle = useMemo<CSSProperties>(() => ({
    backgroundImage: posterUrl
      ? `${roomConcept.bg}, linear-gradient(180deg, rgba(28,31,47,0.48), rgba(42,31,47,0.82)), url(${posterUrl})`
      : `${roomConcept.bg}, radial-gradient(circle at 50% 4%, rgba(255,222,155,0.34), transparent 28%), radial-gradient(circle at 22% 26%, rgba(60,145,137,0.38), transparent 32%), radial-gradient(circle at 80% 34%, rgba(173,70,91,0.34), transparent 34%), linear-gradient(180deg, #28364b, #3a2d42 48%, #193331)`,
    backgroundSize: "cover",
    backgroundPosition: "center top",
  }), [posterUrl, roomConcept.bg]);
  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem("guestMuted") === "1"; } catch { /* noop */ }
    setMuted(saved);
    sfxSetMuted(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const speech = window.speechSynthesis;
    const warmVoices = () => { void speech.getVoices(); };
    warmVoices();
    speech.addEventListener?.("voiceschanged", warmVoices);
    return () => speech.removeEventListener?.("voiceschanged", warmVoices);
  }, []);

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem("guestMuted", next ? "1" : "0"); } catch { /* noop */ }
    sfxSetMuted(next);
    if (next) {
      activeIncantationSequence += 1;
      stopNaturalIncantation();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    }
    if (!next) spellCast(true);
  };

  const onCast = (text: string, tone: keyof typeof TONE, action?: DeviceAction) => {
    setLastIncantation(text);
    setCastTone(tone);
    setCastPulse((next) => next + 1);
    setGalaxyCast(action === "galaxy_on" ? "on" : action === "galaxy_off" ? "off" : null);
    if (action === "dream_fade") setDreamInfo(true);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#24243a] text-[#fff5dd]" style={bgStyle}>
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(115deg,rgba(47,126,125,0.24),transparent_34%,rgba(155,66,93,0.22)_68%,rgba(30,27,43,0.3))]" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-95" aria-hidden="true">
        <span className="great-hall-haze" />
        <span className="vault-arch arch-a" />
        <span className="vault-arch arch-b" />
        <span className="vault-arch arch-c" />
        <span className="moon-window" />
        <span className="enchanted-ceiling" />
        <div className="stained-gallery">
          {STAINED_GLASS_WINDOWS.map((windowSkin, i) => (
            <span
              key={i}
              className="stained-window"
              style={{
                left: `${windowSkin.left}%`,
                top: `${windowSkin.top}%`,
                width: windowSkin.width,
                height: windowSkin.height,
                animationDelay: `${windowSkin.delay}s`,
                "--glass-a": windowSkin.a,
                "--glass-b": windowSkin.b,
                "--glass-c": windowSkin.c,
              } as CSSProperties}
            >
              <span className="lead-line lead-a" />
              <span className="lead-line lead-b" />
              <span className="lead-line lead-c" />
            </span>
          ))}
        </div>
        <div className="banner-gallery">
          {HOUSE_BANNERS.map((banner, i) => (
            <span
              key={i}
              className="house-banner"
              style={{
                left: `${banner.left}%`,
                top: `${banner.top}%`,
                width: banner.width,
                height: banner.height,
                animationDelay: `${banner.delay}s`,
                "--banner-a": banner.a,
                "--banner-b": banner.b,
              } as CSSProperties}
            >
              <span className="banner-pole" />
              <span className="banner-crest">{banner.sigil}</span>
              <span className="banner-fringe" />
            </span>
          ))}
        </div>
        <div className="stair-gallery">
          {GRAND_STAIRCASES.map((stair, i) => (
            <span
              key={i}
              className="grand-stair"
              style={{
                left: `${stair.left}%`,
                top: `${stair.top}%`,
                width: stair.width,
                animationDelay: `${stair.delay}s`,
                "--stair-tilt": `${stair.tilt}deg`,
              } as CSSProperties}
            >
              {Array.from({ length: 9 }, (_, step) => <span key={step} className="stair-step" style={{ left: `${step * 11}%` }} />)}
            </span>
          ))}
        </div>
        <div className="castle-skyline">
          {CASTLE_SILHOUETTES.map(([left, width, height, delay], i) => (
            <span
              key={i}
              className="castle-spire"
              style={{ left: `${left}%`, width, height, animationDelay: `${delay}s` }}
            >
              <span className="castle-roof" />
              <span className="castle-window window-a" />
              <span className="castle-window window-b" />
            </span>
          ))}
        </div>
      </div>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {FLOATING_CANDLES.map(([left, top, scale, delay], i) => (
          <span
            key={i}
            className="floating-candle"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              "--candle-scale": scale,
            } as CSSProperties}
          >
            <span className="candle-halo" />
            <span className="candle-flame" />
            <span className="candle-wax" />
            <span className="candle-drip" />
          </span>
        ))}
      </div>
      {galaxyCast && (
        <span key={`galaxy-${castPulse}`} className={`galaxy-cast-veil ${galaxyCast === "off" ? "galaxy-cast-close" : ""}`} aria-hidden="true">
          <span className="galaxy-cast-ring" />
          <span className="galaxy-cast-stars" />
        </span>
      )}
      <div className="pointer-events-none fixed inset-0 opacity-80">
        {STAR_POINTS.map(([left, top, size, delay], i) => (
          <span
            key={i}
            className="magic-star absolute rounded-full bg-[#fff3cd]"
            style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }}
          />
        ))}
        {ENCHANTED_MOTES.map((mote, i) => (
          <span
            key={`mote-${i}`}
            className="enchanted-mote absolute rounded-full"
            style={{
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              width: mote.size,
              height: mote.size,
              "--mote-x": `${mote.x}px`,
              "--mote-y": `${mote.y}px`,
              "--mote-delay": `${mote.delay}s`,
              "--mote-duration": `${mote.duration}s`,
              "--mote-color": mote.color,
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-md px-3.5 pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="magic-utility flex items-center gap-1 px-2 py-1 text-[11px] backdrop-blur">
            <Globe className="h-3.5 w-3.5 text-[#d8bf86]" />
            <select
              value={lang}
              onChange={(ev) => { setLang(ev.target.value as Lang); rememberLang(ev.target.value); }}
              className="bg-transparent focus:outline-none [&>option]:text-black"
            >
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </label>
          <button
            onClick={toggleMuted}
            className="magic-utility flex items-center gap-1 px-2 py-1 text-[11px] backdrop-blur"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-[#d8bf86]" /> : <Volume2 className="h-3.5 w-3.5 text-[#d8bf86]" />}
            {muted ? copy.muted : copy.sound}
          </button>
          {onSwitchTech && (
            <button onClick={onSwitchTech} className="magic-utility magic-utility-blue flex items-center gap-1 px-2 py-1 text-[11px] backdrop-blur">
              <PanelsTopLeft className="h-3.5 w-3.5" /> {copy.tech}
            </button>
          )}
          {onSwitchWafu && (
            <button onClick={onSwitchWafu} className="magic-utility flex items-center gap-1 px-2 py-1 text-[11px] backdrop-blur">
              <Lamp className="h-3.5 w-3.5" /> {copy.wafu}
            </button>
          )}
        </div>

        <section className="pt-2 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#d8bf86]/70">{copy.mode}</p>
          {guestName && (
            <p className="truncate text-[13px] font-semibold text-[#ffe7b3]">✦ {GX[lang].welcomeName(guestName)} ✦</p>
          )}
          <h1 className="truncate text-[24px] font-semibold leading-tight text-[#fff6dd]">{roomName}</h1>
          {!admin && (
            <p className="text-[10px] text-[#d8bf86]/64">
              {t.checkout}: <span className="text-[#f8ecd1]">{new Date(checkOut).toLocaleString(lang, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}</span>
            </p>
          )}
          <div className="magic-hero-art">
            <div className="hero-casting-stage">
              <MagicCircle key={`circle-${castPulse}`} activeKey={castPulse} tone={castTone} />
              <Wand active={castPulse > 0} />
            </div>
            {roomSeason && (
              <div className="living-portrait" aria-label={`${roomConcept.title} moving portrait`}>
                <div className="portrait-window">
                  <video
                    key={roomConcept.key}
                    src={roomConcept.portrait}
                    poster={roomConcept.portraitPoster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                  />
                </div>
                <Image className="portrait-frame-image" src="/magic-portraits/ornate-frame.png" alt="" fill sizes="220px" unoptimized />
              </div>
            )}
            <div className="portrait-dust-field" aria-hidden="true">
              {PORTRAIT_DUST.map((dust, i) => (
                <span
                  key={i}
                  className="portrait-dust"
                  style={{
                    "--dust-angle": `${dust.angle}deg`,
                    "--dust-delay": `${dust.delay}s`,
                    "--dust-size": `${dust.size}px`,
                  } as CSSProperties}
                />
              ))}
            </div>
          </div>
          <p className="parchment-panel relative mx-auto max-w-[190px] overflow-hidden rounded-lg border border-[#e7ce96]/36 bg-[#292a3b]/78 px-2 py-1 font-serif text-[14px] italic text-[#fff0c7] shadow-[0_0_30px_-16px_rgba(255,205,115,0.85)]">
            <span className="wax-seal" aria-hidden="true"><span /></span>
            {lastIncantation}
          </p>
        </section>

        {entranceHref && (
          <div className="mb-2">
            <EntranceKeyButton href={entranceHref} lang={lang} variant="magic" />
          </div>
        )}

        <SectionLabel>{copy.circles}</SectionLabel>
        <div className="magic-primary-grid grid grid-cols-2 gap-1.5">
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="unlock" label={t.unlock} Icon={LockKeyholeOpen} tone="green" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="lock" label={t.lock} Icon={LockKeyhole} tone="blue" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="ac_on" label={`${t.ac} ${t.on}`} Icon={Snowflake} tone="teal" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="ac_off" label={`${t.ac} ${t.off}`} Icon={Snowflake} tone="rose" onCast={onCast} />
        </div>

        <SectionLabel>{copy.lights}</SectionLabel>
        <div className="magic-light-grid grid grid-cols-4 gap-1.5">
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="light_on" label={`${t.light} ${t.on}`} Icon={Lightbulb} tone="gold" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="light_off" label={`${t.light} ${t.off}`} Icon={Lightbulb} tone="rose" onCast={onCast} />
          {hasWafu && (
            <>
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action={admin ? "wafu_on_warm" : "wafu_on"} label={`${t.wafu} ${t.on}`} Icon={Lamp} tone="gold" onCast={onCast} />
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="wafu_off" label={`${t.wafu} ${t.off}`} Icon={Lamp} tone="rose" onCast={onCast} />
            </>
          )}
          {hasNest && (
            <>
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="nest_on" label={`${t.nest} ${t.on}`} Icon={Moon} tone="green" onCast={onCast} />
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="nest_off" label={`${t.nest} ${t.off}`} Icon={Moon} tone="rose" onCast={onCast} />
            </>
          )}
        </div>

        {hasGalaxy && (
          <div className="galaxy-rite relative mt-2 overflow-hidden border-y border-[#bdd5ff]/35 py-2">
            <span className="galaxy-rite-sky" aria-hidden="true" />
            <div className="relative z-10 mb-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#d8e8ff]">
              <Orbit className="h-4 w-4" strokeWidth={1.4} />
              <span>{t.galaxy}</span>
              <span className="galaxy-rite-mark" aria-hidden="true">✶</span>
            </div>
            <div className="relative z-10 grid grid-cols-2 gap-1.5">
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="galaxy_on" label={`${t.galaxy} ${t.on}`} Icon={Orbit} tone="blue" onCast={onCast} />
              <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="galaxy_off" label={`${t.galaxy} ${t.off}`} Icon={Eclipse} tone="rose" onCast={onCast} />
            </div>
          </div>
        )}

        <SectionLabel>{copy.scenes}</SectionLabel>
        <div className="magic-scene-grid grid grid-cols-3 gap-1.5">
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="welcome" label={t.comfortMode} Icon={Home} tone="green" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="good_night" label={t.goodNightMode} Icon={Moon} tone="blue" onCast={onCast} />
          <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="away" label={t.awayMode} Icon={DoorOpen} tone="rose" onCast={onCast} />
        </div>
        {/* Dream Fade: 和風ライトだけにして 30 分でゆっくり消灯 */}
        {hasWafu && (
          <div className="mt-1.5">
            <MagicAction roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} action="dream_fade" label={`${t.dreamMode} · ${t.dreamDesc}`} Icon={Moon} tone="blue" onCast={onCast} />
            {dreamInfo && (
              <div className="relative mt-1 rounded-md border border-[#f5c26b]/25 bg-black/20 px-2.5 py-2 text-[11px] leading-relaxed">
                <p className="pr-5 font-semibold">{t.dreamStarted}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 opacity-85">{t.dreamSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                <p className="mt-1 opacity-60">{t.dreamNote}</p>
                <button type="button" onClick={() => setDreamInfo(false)} aria-label="close" className="absolute right-1.5 top-1 text-[15px] opacity-60">×</button>
              </div>
            )}
          </div>
        )}

        <div className="mt-2.5">
          <WakeMagic roomSlug={roomSlug} roomSeason={roomConcept.key} muted={muted} admin={admin} t={t} hasWafu={hasWafu} onCast={onCast} />
        </div>
        {!admin && (
          <div className="mt-3">
            <AddToHomePrompt lang={lang} roomName={roomName} variant="tech" />
          </div>
        )}
      </div>

      <style jsx global>{`
        .great-hall-haze {
          position: absolute;
          inset: -8% -10% auto;
          height: 62%;
          background:
            radial-gradient(ellipse at center, rgba(255, 218, 139, 0.3), transparent 46%),
            repeating-linear-gradient(90deg, rgba(255, 225, 164, 0.12) 0 1px, transparent 1px 82px);
          mask-image: linear-gradient(180deg, black, transparent 78%);
          animation: greatHallDrift 12s ease-in-out infinite;
        }
        .vault-arch {
          position: absolute;
          left: 50%;
          top: -132px;
          width: 430px;
          height: 430px;
          border: 1px solid rgba(216, 191, 134, 0.16);
          border-bottom: 0;
          border-radius: 50% 50% 0 0;
          transform: translateX(-50%);
          box-shadow: inset 0 28px 60px rgba(245, 194, 107, 0.04);
        }
        .arch-b {
          width: 590px;
          height: 520px;
          top: -178px;
          opacity: 0.62;
        }
        .arch-c {
          width: 740px;
          height: 610px;
          top: -224px;
          opacity: 0.36;
        }
        .moon-window {
          position: absolute;
          left: 50%;
          top: 52px;
          width: 132px;
          height: 186px;
          border: 1px solid rgba(216, 191, 134, 0.18);
          border-radius: 999px 999px 8px 8px;
          transform: translateX(-50%);
          background:
            linear-gradient(90deg, transparent 48%, rgba(216, 191, 134, 0.16) 49% 51%, transparent 52%),
            linear-gradient(180deg, transparent 33%, rgba(216, 191, 134, 0.12) 34% 35%, transparent 36%),
            radial-gradient(circle at 50% 24%, rgba(255, 236, 185, 0.18), transparent 38%);
          box-shadow: 0 0 48px rgba(245, 194, 107, 0.12);
        }
        .enchanted-ceiling {
          position: absolute;
          inset: -4% 0 auto;
          height: 44%;
          background:
            radial-gradient(circle at 18% 24%, rgba(255, 231, 179, 0.34) 0 1px, transparent 2px),
            radial-gradient(circle at 48% 15%, rgba(143, 199, 255, 0.32) 0 1px, transparent 2px),
            radial-gradient(circle at 76% 32%, rgba(245, 194, 107, 0.3) 0 1px, transparent 2px),
            linear-gradient(180deg, rgba(25, 31, 48, 0.38), transparent 82%);
          background-size: 118px 92px, 154px 108px, 132px 104px, auto;
          mask-image: linear-gradient(180deg, black, transparent 78%);
          opacity: 0.84;
          animation: greatHallDrift 14s ease-in-out infinite;
        }
        .enchanted-ceiling::before,
        .enchanted-ceiling::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 34px;
          width: 210px;
          height: 1px;
          transform: translateX(-50%) rotate(-8deg);
          background: linear-gradient(90deg, transparent, rgba(216, 191, 134, 0.22), transparent);
          box-shadow:
            -74px 32px 0 rgba(216, 191, 134, 0.18),
            68px 54px 0 rgba(143, 199, 255, 0.12),
            24px 96px 0 rgba(245, 194, 107, 0.12);
        }
        .enchanted-ceiling::after {
          width: 164px;
          top: 92px;
          transform: translateX(-50%) rotate(16deg);
          opacity: 0.72;
        }
        .stained-gallery,
        .banner-gallery,
        .stair-gallery {
          position: absolute;
          inset: 0;
        }
        .stained-window {
          position: absolute;
          border: 1px solid rgba(216, 191, 134, 0.18);
          border-radius: 999px 999px 7px 7px;
          background:
            linear-gradient(90deg, transparent 47%, rgba(19, 20, 22, 0.52) 48% 52%, transparent 53%),
            linear-gradient(180deg, transparent 31%, rgba(19, 20, 22, 0.5) 32% 34%, transparent 35%, transparent 64%, rgba(19, 20, 22, 0.46) 65% 67%, transparent 68%),
            radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--glass-b) 70%, transparent), transparent 22%),
            conic-gradient(from 20deg, var(--glass-a), var(--glass-b), var(--glass-c), var(--glass-a));
          box-shadow:
            inset 0 0 24px rgba(255,255,255,0.08),
            0 0 34px -16px color-mix(in srgb, var(--glass-b) 80%, transparent);
          opacity: 0.58;
          overflow: hidden;
          animation: glassGlow 5.8s ease-in-out infinite;
        }
        .stained-window::before {
          content: "";
          position: absolute;
          inset: 8px;
          border: 1px solid rgba(8, 10, 14, 0.48);
          border-radius: 999px 999px 5px 5px;
        }
        .stained-window::after {
          content: "";
          position: absolute;
          inset: -40% -20%;
          background: linear-gradient(110deg, transparent 36%, rgba(255,255,255,0.22) 48%, transparent 58%);
          transform: translateX(-70%);
          animation: glassGlow 7s ease-in-out infinite reverse;
        }
        .lead-line {
          position: absolute;
          left: 50%;
          top: 4px;
          width: 1px;
          height: calc(100% - 8px);
          background: rgba(9, 11, 14, 0.62);
        }
        .lead-a { transform: translateX(-50%) rotate(22deg); }
        .lead-b { transform: translateX(-50%) rotate(-22deg); }
        .lead-c { transform: translateX(-50%); }
        .house-banner {
          position: absolute;
          transform-origin: center top;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.1), transparent 18%, rgba(0,0,0,0.18) 78%),
            repeating-linear-gradient(90deg, color-mix(in srgb, var(--banner-a) 88%, black 12%) 0 8px, var(--banner-a) 8px 16px),
            linear-gradient(180deg, var(--banner-a), color-mix(in srgb, var(--banner-a) 76%, black 24%));
          clip-path: polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%);
          border: 1px solid color-mix(in srgb, var(--banner-b) 48%, transparent);
          box-shadow: inset 0 0 18px rgba(0,0,0,0.32), 0 12px 24px rgba(0,0,0,0.18);
          opacity: 0.76;
          animation: bannerSway 6.8s ease-in-out infinite;
        }
        .banner-pole {
          position: absolute;
          inset: -5px -4px auto;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #5d331a, var(--banner-b), #3b2418);
          box-shadow: 0 0 10px rgba(245, 194, 107, 0.2);
        }
        .banner-crest {
          position: absolute;
          left: 50%;
          top: 24%;
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--banner-b) 68%, transparent);
          border-radius: 50%;
          transform: translateX(-50%);
          color: var(--banner-b);
          font-family: Georgia, serif;
          text-shadow: 0 0 10px color-mix(in srgb, var(--banner-b) 78%, transparent);
        }
        .banner-fringe {
          position: absolute;
          inset: auto 3px 7%;
          height: 9px;
          background: repeating-linear-gradient(90deg, var(--banner-b) 0 2px, transparent 2px 6px);
          opacity: 0.64;
        }
        .grand-stair {
          position: absolute;
          height: 64px;
          transform: rotate(var(--stair-tilt));
          transform-origin: center;
          opacity: 0.46;
          animation: staircaseShift 9s ease-in-out infinite;
        }
        .grand-stair::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 19px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(85, 62, 45, 0.12), rgba(216, 191, 134, 0.34), rgba(85, 62, 45, 0.12));
          box-shadow: 0 8px 14px rgba(0,0,0,0.24);
        }
        .stair-step {
          position: absolute;
          top: 8px;
          width: 19%;
          height: 32px;
          transform: skewX(-22deg);
          border: 1px solid rgba(216, 191, 134, 0.13);
          background: linear-gradient(180deg, rgba(110, 82, 58, 0.42), rgba(19, 18, 19, 0.52));
          box-shadow: inset 0 3px 4px rgba(255,255,255,0.04);
        }
        .wax-seal {
          position: absolute;
          left: 10px;
          top: 50%;
          display: grid;
          width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 50%;
          transform: translateY(-50%) rotate(-12deg);
          background:
            radial-gradient(circle at 38% 34%, rgba(255, 177, 124, 0.44), transparent 18%),
            radial-gradient(circle, #8c2631, #4a1018 76%);
          box-shadow: inset 0 -3px 4px rgba(0,0,0,0.28), 0 0 14px rgba(170, 42, 52, 0.28);
        }
        .wax-seal span {
          width: 9px;
          height: 9px;
          border: 1px solid rgba(255, 211, 156, 0.46);
          border-radius: 50%;
        }
        .living-portrait {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 3;
          width: min(63vw, 220px);
          aspect-ratio: 2 / 3;
          transform: translate(-50%, -50%);
          filter: brightness(1.07) saturate(1.06) drop-shadow(0 14px 20px rgba(0, 0, 0, 0.48)) drop-shadow(0 0 20px rgba(245, 204, 135, 0.42));
          animation: portraitLevitate 6.8s ease-in-out infinite;
        }
        .portrait-window {
          position: absolute;
          left: 19%;
          top: 21.2%;
          width: 62%;
          height: 61.8%;
          overflow: hidden;
          background: #24182a;
        }
        .portrait-window video {
          position: absolute;
          display: block;
          left: -8%;
          top: -8%;
          width: 116%;
          height: 116%;
          max-width: none;
          object-fit: cover;
          object-position: center;
        }
        .portrait-frame-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          z-index: 2;
          pointer-events: none;
        }
        .living-portrait::after {
          content: "";
          position: absolute;
          inset: 22% 20%;
          z-index: 3;
          pointer-events: none;
          background: linear-gradient(112deg, transparent 18%, rgba(255,255,255,0.16) 42%, transparent 61%);
          mix-blend-mode: screen;
          animation: portraitShimmer 5.2s ease-in-out infinite;
        }
        .portrait-dust-field {
          position: absolute;
          inset: 0;
          z-index: 4;
          overflow: hidden;
          pointer-events: none;
        }
        .portrait-dust {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--dust-size);
          height: var(--dust-size);
          border-radius: 50%;
          background: #fff2c6;
          box-shadow: 0 0 7px #fff2c6, 0 0 17px rgba(245, 194, 107, 0.7);
          opacity: 0;
          animation: portraitDustOrbit 6.8s ease-in-out var(--dust-delay) infinite;
        }
        .galaxy-rite {
          background: linear-gradient(90deg, rgba(26, 37, 70, 0.15), rgba(77, 43, 87, 0.3), rgba(26, 37, 70, 0.15));
        }
        .galaxy-rite-sky {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 28%, #fff5cb 0 1px, transparent 2px),
            radial-gradient(circle at 68% 16%, #b6ddff 0 1px, transparent 2px),
            radial-gradient(circle at 82% 76%, #ffd4ed 0 1px, transparent 2px),
            radial-gradient(ellipse at 50% 50%, rgba(84, 112, 190, 0.28), transparent 64%);
          background-size: 86px 68px, 126px 88px, 104px 72px, auto;
          opacity: 0.72;
          animation: galaxySkyShift 9s ease-in-out infinite;
        }
        .galaxy-rite-mark {
          color: #ffe4a6;
          text-shadow: 0 0 11px #c9b7ff;
          animation: sealGlimmer 4s ease-in-out infinite;
        }
        .galaxy-action .spell-seal {
          border-color: rgba(190, 212, 255, 0.74);
          box-shadow: 0 0 16px rgba(156, 184, 255, 0.42), inset 0 0 10px rgba(210, 187, 255, 0.19);
        }
        .galaxy-action .spell-seal-orbit {
          border-color: rgba(255, 230, 175, 0.74);
          animation-duration: 5s;
        }
        .galaxy-cast-veil {
          position: fixed;
          inset: 0;
          z-index: 11;
          overflow: hidden;
          pointer-events: none;
          background: radial-gradient(circle at 50% 43%, rgba(129, 144, 250, 0.16), transparent 48%);
          animation: galaxyVeil 1.25s ease-out both;
        }
        .galaxy-cast-ring {
          position: absolute;
          left: 50%;
          top: 43%;
          width: min(86vw, 420px);
          aspect-ratio: 1;
          border: 1px solid rgba(233, 217, 255, 0.78);
          border-radius: 50%;
          background: repeating-conic-gradient(from 0deg, rgba(255, 235, 176, 0.55) 0 1deg, transparent 1deg 20deg);
          box-shadow: 0 0 40px rgba(161, 182, 255, 0.5), inset 0 0 55px rgba(140, 94, 205, 0.22);
          mask-image: radial-gradient(circle, transparent 0 48%, black 50% 51%, transparent 54% 66%, black 68% 69%, transparent 72%);
          animation: galaxyBloom 1.2s ease-out both;
        }
        .galaxy-cast-stars {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 22% 24%, #fff5cb 0 2px, transparent 3px),
            radial-gradient(circle at 74% 30%, #cbdeff 0 2px, transparent 3px),
            radial-gradient(circle at 58% 72%, #ffd1e5 0 2px, transparent 3px),
            radial-gradient(circle at 83% 68%, #ffffff 0 1px, transparent 2px);
          animation: galaxyStarFlight 1.2s ease-out both;
        }
        .galaxy-cast-close { filter: hue-rotate(32deg) brightness(0.7); }
        .castle-skyline {
          position: absolute;
          inset: auto -5% 0;
          height: 250px;
          background: linear-gradient(180deg, transparent, rgba(23, 27, 38, 0.46) 72%, rgba(20, 22, 34, 0.78));
          opacity: 0.74;
        }
        .castle-spire {
          position: absolute;
          bottom: 0;
          border: 1px solid rgba(216, 191, 134, 0.13);
          border-bottom: 0;
          border-radius: 8px 8px 0 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.05), transparent 22%, rgba(0,0,0,0.3) 72%),
            linear-gradient(180deg, rgba(39, 32, 30, 0.9), rgba(9, 10, 13, 0.94));
          box-shadow: inset 0 16px 38px rgba(245, 194, 107, 0.04);
          animation: greatHallDrift 9s ease-in-out infinite;
        }
        .castle-spire::before {
          content: "";
          position: absolute;
          inset: -10px 0 auto;
          height: 10px;
          background: repeating-linear-gradient(90deg, rgba(216, 191, 134, 0.15) 0 6px, transparent 6px 12px);
        }
        .castle-roof {
          position: absolute;
          left: 50%;
          top: -42px;
          width: 92%;
          height: 44px;
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(73, 44, 37, 0.95), rgba(16, 12, 15, 0.96));
          border: 1px solid rgba(216, 191, 134, 0.11);
        }
        .castle-window {
          position: absolute;
          left: 50%;
          width: 8px;
          height: 22px;
          border-radius: 999px 999px 2px 2px;
          transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(255, 230, 164, 0.9), rgba(188, 109, 55, 0.22));
          box-shadow: 0 0 12px rgba(245, 194, 107, 0.48);
          animation: flameFlicker 2.4s ease-in-out infinite;
        }
        .window-a { top: 34%; }
        .window-b { top: 58%; opacity: 0.72; animation-delay: 0.6s; }
        .floating-candle {
          position: absolute;
          width: 18px;
          height: 70px;
          transform: translateY(0) scale(var(--candle-scale));
          transform-origin: center top;
          animation: candleFloat 6.4s ease-in-out infinite;
          opacity: 0.9;
        }
        .candle-halo {
          position: absolute;
          left: 50%;
          top: -22px;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(255, 231, 179, 0.32), transparent 68%);
          filter: blur(1px);
        }
        .candle-flame {
          position: absolute;
          left: 50%;
          top: 0;
          width: 11px;
          height: 18px;
          border-radius: 50% 50% 44% 44%;
          transform: translateX(-50%);
          background: radial-gradient(circle at 50% 70%, #fff8ce 0 22%, #f5c26b 48%, rgba(255, 126, 79, 0.72) 72%, transparent 78%);
          box-shadow: 0 0 14px rgba(245, 194, 107, 0.8), 0 0 28px rgba(255, 145, 88, 0.28);
          animation: flameFlicker 1.6s ease-in-out infinite;
        }
        .candle-wax {
          position: absolute;
          left: 50%;
          top: 16px;
          width: 13px;
          height: 48px;
          border-radius: 4px 4px 7px 7px;
          transform: translateX(-50%);
          background:
            radial-gradient(circle at 68% 24%, rgba(217, 188, 136, 0.42) 0 9%, transparent 11%),
            linear-gradient(90deg, #f5dfad, #fff1c9 48%, #c79e65);
          box-shadow: inset -3px 0 4px rgba(111, 67, 36, 0.28), 0 0 16px rgba(245, 194, 107, 0.16);
        }
        .candle-drip {
          position: absolute;
          left: 10px;
          top: 31px;
          width: 4px;
          height: 16px;
          border-radius: 999px;
          background: rgba(255, 241, 201, 0.86);
        }
        .magic-star {
          box-shadow: 0 0 10px rgba(255, 243, 205, 0.9);
          animation: magicTwinkle 3.4s ease-in-out infinite;
        }
        .enchanted-mote {
          background: var(--mote-color);
          box-shadow: 0 0 8px var(--mote-color), 0 0 18px color-mix(in srgb, var(--mote-color) 58%, transparent);
          opacity: 0;
          animation: enchantedMoteDrift var(--mote-duration) ease-in-out var(--mote-delay) infinite;
        }
        .parchment-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 16%, rgba(255, 236, 185, 0.16), transparent 22%),
            radial-gradient(circle at 78% 74%, rgba(95, 48, 23, 0.18), transparent 24%),
            repeating-linear-gradient(120deg, transparent 0 11px, rgba(255, 232, 180, 0.035) 12px 13px);
          opacity: 0.85;
          mix-blend-mode: screen;
        }
        .magic-hero-art {
          position: relative;
          height: 320px;
          max-width: 350px;
          margin: 4px auto 2px;
        }
        .hero-casting-stage {
          position: absolute;
          inset: 0;
          isolation: isolate;
        }
        .grand-magic-circle {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(78vw, 280px);
          aspect-ratio: 1;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          color: var(--circle-ink);
          filter: drop-shadow(0 0 28px var(--circle-glow));
          animation: circleOpen 0.9s ease-out both;
          z-index: 1;
        }
        .grand-magic-circle::before,
        .grand-magic-circle::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle, transparent 0 28%, color-mix(in srgb, var(--circle-ink) 18%, transparent) 29% 30%, transparent 31% 46%, color-mix(in srgb, var(--circle-ink) 26%, transparent) 47% 48%, transparent 49%),
            conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--circle-ink) 34%, transparent), transparent 28%, color-mix(in srgb, #8fc7ff 28%, transparent), transparent 64%, color-mix(in srgb, var(--circle-ink) 30%, transparent), transparent);
          border: 1px solid var(--circle-border);
          box-shadow:
            inset 0 0 28px color-mix(in srgb, var(--circle-ink) 12%, transparent),
            0 0 42px -18px var(--circle-glow);
        }
        .grand-magic-circle::after {
          inset: 14px;
          border-style: dashed;
          opacity: 0.7;
          animation: circleSpin 24s linear infinite reverse;
        }
        .circle-geometry {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          color: color-mix(in srgb, var(--circle-ink) 75%, white 25%);
          opacity: 0.8;
          filter: drop-shadow(0 0 7px var(--circle-glow));
          animation: circleGeometryBreath 5.4s ease-in-out infinite;
        }
        .circle-active {
          animation: circleOpen 0.56s ease-out both;
        }
        .circle-orbit,
        .circle-radial,
        .circle-sigil,
        .circle-cast-flash,
        .circle-core {
          position: absolute;
          pointer-events: none;
        }
        .circle-orbit {
          inset: 27px;
          border-radius: 50%;
          border: 1px solid color-mix(in srgb, var(--circle-ink) 32%, transparent);
          animation: circleSpin 18s linear infinite;
        }
        .orbit-b {
          inset: 49px;
          border-style: dashed;
          animation-duration: 14s;
          animation-direction: reverse;
        }
        .orbit-c {
          inset: 72px;
          border-color: color-mix(in srgb, #8fc7ff 30%, transparent);
          animation-duration: 10s;
        }
        .circle-radial {
          left: 50%;
          top: 50%;
          width: 1px;
          height: 48%;
          transform-origin: 50% 0;
          background: linear-gradient(180deg, color-mix(in srgb, var(--circle-ink) 28%, transparent), transparent 68%);
        }
        .circle-sigil {
          left: 50%;
          top: 50%;
          display: grid;
          width: 24px;
          height: 24px;
          margin: -12px 0 0 -12px;
          place-items: center;
          color: color-mix(in srgb, var(--circle-ink) 86%, white 14%);
          font-family: Georgia, serif;
          font-size: 18px;
          text-shadow: 0 0 14px var(--circle-glow);
          animation: sigilBreathe 3.6s ease-in-out infinite;
        }
        .circle-cast-flash {
          inset: 16px;
          border-radius: 50%;
          background:
            radial-gradient(circle, color-mix(in srgb, var(--circle-ink) 38%, transparent), transparent 58%),
            conic-gradient(from 40deg, transparent, color-mix(in srgb, white 44%, transparent), transparent 26%, color-mix(in srgb, var(--circle-ink) 52%, transparent), transparent 54%);
          opacity: 0;
          animation: circleFlash 1.08s ease-out both;
        }
        .circle-core {
          inset: 47%;
          border-radius: 50%;
          background: color-mix(in srgb, var(--circle-ink) 78%, white 22%);
          box-shadow: 0 0 24px var(--circle-glow), 0 0 46px color-mix(in srgb, #8fc7ff 24%, transparent);
          animation: corePulse 2.2s ease-in-out infinite;
        }
        .hero-casting-stage .wand-stage {
          position: absolute;
          left: 12px;
          bottom: -30px;
          margin: 0;
          transform: scale(0.34);
          transform-origin: left bottom;
          opacity: 0.82;
          z-index: 5;
        }
        .magic-utility {
          border: 1px solid rgba(224, 196, 142, 0.45);
          border-radius: 5px;
          color: #fff3dc;
          background: linear-gradient(155deg, rgba(99, 72, 49, 0.52), rgba(30, 32, 48, 0.89));
          box-shadow: inset 0 0 0 2px rgba(20, 24, 38, 0.45), inset 0 1px 0 rgba(255, 240, 200, 0.16);
          transition: border-color 180ms ease, background 180ms ease;
        }
        .magic-utility-blue { border-color: rgba(169, 211, 255, 0.5); color: #e4f2ff; }
        .magic-utility:hover { border-color: #f5db9d; background: rgba(72, 61, 67, 0.92); }
        .magic-utility:focus-within,
        .magic-utility:focus-visible { outline: 2px solid #fff4cf; outline-offset: 2px; }
        .spell-tile {
          isolation: isolate;
          border: 1px solid var(--spell-border);
          border-radius: 6px;
          color: var(--spell-ink);
          background:
            radial-gradient(ellipse at 50% -28%, color-mix(in srgb, var(--spell-ink) 24%, transparent), transparent 63%),
            linear-gradient(155deg, var(--spell-fill), rgba(29, 31, 46, 0.96) 80%);
          box-shadow:
            inset 0 1px 0 rgba(255, 246, 215, 0.25),
            inset 0 -8px 12px rgba(10, 12, 23, 0.28),
            0 3px 8px rgba(9, 12, 22, 0.24),
            0 0 19px -9px var(--spell-glow);
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .spell-tile::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid color-mix(in srgb, var(--spell-ink) 29%, transparent);
          border-radius: 3px;
          background:
            radial-gradient(circle at 0 0, var(--spell-ink) 0 1px, transparent 2px),
            radial-gradient(circle at 100% 0, var(--spell-ink) 0 1px, transparent 2px),
            radial-gradient(circle at 0 100%, var(--spell-ink) 0 1px, transparent 2px),
            radial-gradient(circle at 100% 100%, var(--spell-ink) 0 1px, transparent 2px);
          pointer-events: none;
          opacity: 0.8;
        }
        .spell-tile::after {
          content: "";
          position: absolute;
          inset: -50% auto -50% -55%;
          width: 36%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, transparent, rgba(255, 249, 225, 0.22), transparent);
          pointer-events: none;
          opacity: 0;
        }
        .spell-tile:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--spell-ink) 75%, white);
          box-shadow: inset 0 1px 0 rgba(255, 246, 215, 0.31), 0 4px 10px rgba(9, 12, 22, 0.3), 0 0 25px -8px var(--spell-glow);
        }
        .spell-tile:hover:not(:disabled)::after,
        .spell-tile:active:not(:disabled)::after { animation: spellTileSheen 900ms ease-out both; }
        .spell-tile:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
        .spell-tile:focus-visible,
        .spell-choice:focus-visible,
        .spell-command:focus-visible { outline: 2px solid #fff4cf; outline-offset: 2px; }
        .spell-tile-engraving {
          position: absolute;
          top: 3px;
          left: 19px;
          right: 19px;
          height: 1px;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--spell-ink) 80%, white), transparent);
          pointer-events: none;
          z-index: 2;
          animation: spellEngravingFlare 900ms ease-out both;
        }
        .spell-tile-engraving::after {
          content: "";
          position: absolute;
          left: 50%;
          top: -2px;
          width: 5px;
          height: 5px;
          border: 1px solid var(--spell-ink);
          background: #342d37;
          transform: translateX(-50%) rotate(45deg);
          box-shadow: 0 0 5px var(--spell-ink);
        }
        .spell-tile-label {
          color: #fff7e9;
          text-shadow: 0 1px 2px rgba(4, 6, 14, 0.75);
        }
        .galaxy-action.spell-tile {
          background:
            radial-gradient(circle at 17% 19%, #fff8d9 0 1px, transparent 2px),
            radial-gradient(circle at 81% 68%, #bedfff 0 1px, transparent 2px),
            radial-gradient(ellipse at 50% -20%, rgba(127, 170, 255, 0.45), transparent 65%),
            linear-gradient(155deg, rgba(31, 44, 79, 0.97), rgba(45, 28, 66, 0.97));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.31), inset 0 0 14px rgba(141,183,255,0.18), 0 0 26px -7px var(--spell-glow);
        }
        @keyframes spellTileSheen {
          0% { transform: translateX(0) rotate(22deg); opacity: 0; }
          22% { opacity: 0.85; }
          100% { transform: translateX(420%) rotate(22deg); opacity: 0; }
        }
        @keyframes spellEngravingFlare {
          0% { opacity: 0.25; filter: brightness(1); }
          40% { opacity: 1; filter: brightness(1.8); }
          100% { opacity: 0.75; filter: brightness(1); }
        }
        .spell-choice,
        .spell-command {
          position: relative;
          isolation: isolate;
          border: 1px solid rgba(224, 196, 142, 0.4);
          border-radius: 6px;
          color: #f8ecd1;
          background: linear-gradient(155deg, rgba(90, 65, 45, 0.38), rgba(26, 31, 46, 0.94));
          box-shadow: inset 0 1px 0 rgba(255, 246, 220, 0.16), 0 2px 8px rgba(5, 8, 17, 0.2);
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }
        .spell-choice::after,
        .spell-command::after {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(238, 207, 152, 0.22);
          border-radius: 3px;
          pointer-events: none;
        }
        .spell-choice { --choice-ink: #ffc86a; }
        .spell-choice[data-wake-mode="horizon_rise"] { --choice-ink: #c7bcff; }
        .spell-choice svg { color: var(--choice-ink); filter: drop-shadow(0 0 5px var(--choice-ink)); }
        .spell-choice.is-selected {
          border-color: var(--choice-ink);
          color: #fff9e9;
          background: radial-gradient(ellipse at 50% -38%, color-mix(in srgb, var(--choice-ink) 34%, transparent), transparent 80%), linear-gradient(155deg, rgba(73, 58, 63, 0.72), rgba(28, 32, 52, 0.96));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--choice-ink) 25%, transparent), 0 0 18px -7px var(--choice-ink);
        }
        .spell-choice:hover:not(:disabled),
        .spell-command:hover:not(:disabled) { transform: translateY(-1px); border-color: #f7dfa8; }
        .spell-choice:active:not(:disabled),
        .spell-command:active:not(:disabled) { transform: translateY(1px); }
        .spell-command-primary { color: #fff5da; border-color: rgba(245, 194, 107, 0.7); background: linear-gradient(155deg, rgba(123, 77, 37, 0.72), rgba(48, 37, 52, 0.94)); }
        .spell-command-clear { color: #d8c8a5; border-color: rgba(216, 191, 134, 0.28); background: rgba(32, 34, 50, 0.58); }
        .button-magic-circle,
        .button-rune-burst,
        .button-spell-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          pointer-events: none;
          z-index: 1;
        }
        .button-magic-circle {
          width: 76px;
          height: 76px;
          margin: -38px 0 0 -38px;
          border: 1px solid currentColor;
          border-radius: 50%;
          opacity: 0;
          background:
            radial-gradient(circle, transparent 0 40%, currentColor 41% 42%, transparent 43%),
            repeating-conic-gradient(from 0deg, currentColor 0 4deg, transparent 4deg 18deg);
          box-shadow: 0 0 24px -8px currentColor;
          animation: buttonCircleCast 0.92s ease-out both;
        }
        .button-rune-burst {
          display: flex;
          width: 96px;
          justify-content: space-between;
          color: currentColor;
          font-family: Georgia, serif;
          font-size: 15px;
          opacity: 0;
          text-shadow: 0 0 12px currentColor;
          animation: buttonRuneBurst 0.92s ease-out both;
        }
        .button-spell-wave {
          width: 14px;
          height: 14px;
          margin: -7px 0 0 -7px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 18px currentColor;
          opacity: 0;
          animation: buttonSpellWave 0.72s ease-out both;
        }
        .spell-seal {
          position: relative;
          z-index: 2;
          display: grid;
          width: 29px;
          height: 29px;
          flex: none;
          place-items: center;
          border: 1px solid color-mix(in srgb, currentColor 58%, transparent);
          border-radius: 50%;
          background: radial-gradient(circle at 42% 36%, color-mix(in srgb, currentColor 21%, transparent), rgba(14, 21, 33, 0.48) 72%);
          box-shadow: 0 0 13px -3px currentColor, inset 0 0 8px color-mix(in srgb, currentColor 16%, transparent);
          animation: sealGlimmer 4.8s ease-in-out infinite;
        }
        .spell-tile .spell-seal {
          width: 29px;
          height: 29px;
          border: 0;
          background: none;
          box-shadow: none;
        }
        .spell-tile .spell-seal::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid color-mix(in srgb, var(--spell-ink) 78%, #f8dca9);
          border-radius: 50%;
          background: radial-gradient(circle at 42% 33%, color-mix(in srgb, var(--spell-ink) 33%, transparent), rgba(17, 24, 38, 0.94) 68%);
          box-shadow: inset 0 0 0 2px rgba(10, 15, 29, 0.5), inset 0 0 12px color-mix(in srgb, var(--spell-ink) 24%, transparent), 0 0 14px -2px var(--spell-glow);
        }
        .spell-seal-orbit {
          position: absolute;
          inset: -3px;
          border: 1px dashed color-mix(in srgb, currentColor 54%, transparent);
          border-radius: 50%;
          animation: circleSpin 11s linear infinite;
        }
        .spell-seal-icon { position: relative; z-index: 1; }
        .spell-seal-rune {
          position: absolute;
          right: -4px;
          bottom: -3px;
          z-index: 2;
          font-family: Georgia, serif;
          font-size: 9px;
          line-height: 1;
          text-shadow: 0 0 6px currentColor;
        }
        .spell-tile[data-emblem="ward"] .spell-seal::before,
        .spell-tile[data-emblem="ward"] .spell-seal-orbit { border-radius: 6px 6px 13px 13px; }
        .spell-tile[data-emblem="ward"] .spell-seal-orbit { animation: none; border-style: solid; }
        .spell-tile[data-action="unlock"] .spell-seal-orbit { border-right-color: transparent; transform: rotate(10deg); }
        .spell-tile[data-emblem="frost"] .spell-seal::before,
        .spell-tile[data-emblem="frost"] .spell-seal-orbit {
          border-radius: 2px;
          clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        }
        .spell-tile[data-emblem="frost"] .spell-seal-orbit { animation: none; border-style: solid; }
        .spell-tile[data-emblem="radiance"] .spell-seal-orbit {
          inset: -5px;
          border: 0;
          background: repeating-conic-gradient(from 0deg, var(--spell-ink) 0 4deg, transparent 4deg 30deg);
          mask: radial-gradient(circle, transparent 0 55%, #000 58%);
          opacity: 0.7;
        }
        .spell-tile[data-emblem="lantern"] .spell-seal::before,
        .spell-tile[data-emblem="lantern"] .spell-seal-orbit { border-radius: 5px 5px 2px 2px; }
        .spell-tile[data-emblem="lantern"] .spell-seal-orbit {
          inset: 3px 6px;
          border: 0;
          border-left: 1px solid currentColor;
          border-right: 1px solid currentColor;
          animation: none;
        }
        .spell-tile[data-emblem="nest"] .spell-seal::before,
        .spell-tile[data-emblem="nest"] .spell-seal-orbit { border-radius: 15px 15px 8px 8px; }
        .spell-tile[data-emblem="nest"] .spell-seal-orbit { animation: none; }
        .spell-tile[data-emblem="cosmos"] .spell-seal::before { clip-path: ellipse(50% 42% at 50% 50%); }
        .spell-tile[data-emblem="cosmos"] .spell-seal-orbit {
          inset: 4px -6px;
          border-style: solid;
          border-radius: 50%;
          transform: rotate(-28deg);
          animation: none;
          box-shadow: 0 0 8px var(--spell-glow);
        }
        .spell-tile[data-emblem="hearth"] .spell-seal::before { clip-path: polygon(50% 0, 100% 31%, 100% 100%, 0 100%, 0 31%); }
        .spell-tile[data-emblem="hearth"] .spell-seal-orbit { border-radius: 3px; border-style: solid; animation: none; }
        .spell-tile[data-emblem="dream"] .spell-seal::before {
          border-radius: 50% 50% 15% 50%;
          transform: rotate(-25deg);
        }
        .spell-tile[data-emblem="dream"] .spell-seal-orbit { border-radius: 50% 50% 15% 50%; transform: rotate(-25deg); animation: none; }
        .spell-tile[data-emblem="passage"] .spell-seal::before,
        .spell-tile[data-emblem="passage"] .spell-seal-orbit { border-radius: 14px 14px 3px 3px; }
        .spell-tile[data-emblem="passage"] .spell-seal-orbit { border-style: solid; animation: none; }
        .spell-tile[data-dormant="true"] .spell-seal::before { filter: saturate(0.55) brightness(0.75); }
        .spell-tile[data-dormant="true"] .spell-seal-icon { opacity: 0.68; }
        .spell-tile[data-dormant="true"] .spell-seal::after {
          content: "";
          position: absolute;
          left: 3px;
          top: 14px;
          z-index: 3;
          width: 23px;
          height: 1.5px;
          background: var(--spell-ink);
          box-shadow: 0 0 6px var(--spell-ink);
          transform: rotate(-45deg);
          pointer-events: none;
        }
        .parchment-panel:hover .spell-seal,
        .parchment-panel:active .spell-seal { filter: brightness(1.22); }
        .is-casting {
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.07),
            0 0 34px -10px currentColor !important;
        }
        .wand-stage {
          position: relative;
          width: min(78vw, 310px);
          height: 158px;
          margin: 18px auto 2px;
          isolation: isolate;
        }
        .rune-ring {
          position: absolute;
          left: 50%;
          top: 54%;
          width: 184px;
          height: 184px;
          border: 1px solid rgba(216, 191, 134, 0.28);
          border-radius: 50%;
          transform: translate(-50%, -50%) rotate(-12deg);
          background:
            radial-gradient(circle, transparent 56%, rgba(245, 194, 107, 0.08) 57% 58%, transparent 59%),
            conic-gradient(from 30deg, rgba(245, 194, 107, 0.0), rgba(245, 194, 107, 0.32), rgba(143, 199, 255, 0.14), rgba(245, 194, 107, 0));
          box-shadow: 0 0 34px rgba(245, 194, 107, 0.14), inset 0 0 28px rgba(143, 199, 255, 0.08);
          animation: runeOrbit 18s linear infinite;
          z-index: 0;
        }
        .rune-ring::before,
        .rune-ring::after {
          content: "";
          position: absolute;
          inset: 22px;
          border: 1px dashed rgba(245, 194, 107, 0.23);
          border-radius: 50%;
        }
        .rune-ring::after {
          inset: 44px;
          border-style: solid;
          opacity: 0.72;
        }
        .rune-glyph {
          position: absolute;
          left: 50%;
          top: 50%;
          display: grid;
          width: 22px;
          height: 22px;
          margin: -11px 0 0 -11px;
          place-items: center;
          color: rgba(255, 231, 179, 0.78);
          font-family: Georgia, serif;
          font-size: 16px;
          text-shadow: 0 0 12px rgba(245, 194, 107, 0.75);
        }
        .wand-aura {
          position: absolute;
          inset: 26px 18px 24px;
          border: 1px solid rgba(216, 191, 134, 0.3);
          border-radius: 999px;
          transform: rotate(-16deg);
          background:
            linear-gradient(90deg, transparent, rgba(245, 194, 107, 0.13), transparent),
            repeating-linear-gradient(90deg, transparent 0 18px, rgba(143, 199, 255, 0.13) 19px, transparent 20px);
          animation: runeDrift 5.8s linear infinite;
        }
        .realistic-wand-svg {
          position: absolute;
          left: 50%;
          top: 16px;
          width: min(92vw, 340px);
          height: 150px;
          transform: translateX(-50%) rotate(-2deg);
          overflow: visible;
          z-index: 2;
          filter: drop-shadow(0 16px 14px rgba(0,0,0,0.34));
        }
        .wand-body-path {
          stroke: rgba(255, 222, 157, 0.2);
          stroke-width: 1.2;
        }
        .wand-highlight-path {
          mix-blend-mode: screen;
          animation: wandWoodShimmer 4.6s ease-in-out infinite;
        }
        .wand-shadow-path {
          mix-blend-mode: multiply;
        }
        .wood-grain-line .wand-grain {
          stroke: rgba(255, 219, 148, 0.46);
          stroke-width: 1.15;
          stroke-linecap: round;
          filter: drop-shadow(0 1px 0 rgba(0,0,0,0.25));
        }
        .wood-grain-line .grain-b {
          stroke: rgba(61, 29, 13, 0.56);
          stroke-width: 1.35;
        }
        .wood-grain-line .grain-c {
          stroke: rgba(255, 235, 177, 0.38);
          stroke-width: 0.95;
        }
        .wand-ring {
          filter: drop-shadow(0 0 5px rgba(245,194,107,0.28));
        }
        .wand-knot {
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.38));
        }
        .wand-handle-ridge {
          filter: drop-shadow(0 5px 5px rgba(0,0,0,0.2));
        }
        .wand-tip-glow {
          fill: #fff2c6;
          opacity: 0.78;
          filter: drop-shadow(0 0 7px #f5c26b) drop-shadow(0 0 16px rgba(143,199,255,0.45));
          animation: tipPulse 2.6s ease-in-out infinite;
        }
        .wand-stage-active .realistic-wand-svg {
          filter: drop-shadow(0 16px 14px rgba(0,0,0,0.34)) drop-shadow(0 0 18px rgba(245,194,107,0.18));
        }
        .wand-stage-active .wand-tip-glow {
          animation-duration: 0.8s;
        }
        .wand-particle {
          position: absolute;
          right: 8px;
          top: 43px;
          z-index: 4;
          width: var(--particle-size);
          height: var(--particle-size);
          border-radius: 50%;
          background: var(--particle-color);
          box-shadow: 0 0 8px var(--particle-color), 0 0 18px color-mix(in srgb, var(--particle-color) 64%, transparent);
          opacity: 0;
          animation: wandParticleDrift var(--particle-duration) cubic-bezier(0.2, 0.7, 0.24, 1) var(--particle-delay) infinite;
        }
        .wand-stage-active .wand-particle {
          filter: brightness(1.3);
        }
        @keyframes greatHallDrift {
          0%, 100% { transform: translateY(0); opacity: 0.82; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes candleFloat {
          0%, 100% { transform: translateY(0) scale(var(--candle-scale)); }
          50% { transform: translateY(-12px) scale(var(--candle-scale)); }
        }
        @keyframes flameFlicker {
          0%, 100% { transform: translateX(-50%) scale(0.9); opacity: 0.72; }
          38% { transform: translateX(-48%) scale(1.1); opacity: 1; }
          66% { transform: translateX(-52%) scale(0.98); opacity: 0.84; }
        }
        @keyframes glassGlow {
          0%, 100% { filter: saturate(0.92) brightness(0.9); opacity: 0.48; }
          44% { filter: saturate(1.24) brightness(1.12); opacity: 0.72; }
          58% { filter: saturate(1.08) brightness(0.98); opacity: 0.62; }
        }
        @keyframes bannerSway {
          0%, 100% { transform: rotate(-1.8deg) skewX(-0.8deg); }
          45% { transform: rotate(2.1deg) skewX(1.2deg); }
          70% { transform: rotate(0.4deg) skewX(-0.4deg); }
        }
        @keyframes staircaseShift {
          0%, 100% { transform: rotate(var(--stair-tilt)) translateY(0); opacity: 0.38; }
          44% { transform: rotate(var(--stair-tilt)) translateY(-7px) skewX(2deg); opacity: 0.56; }
          74% { transform: rotate(var(--stair-tilt)) translateY(2px); opacity: 0.44; }
        }
        @keyframes circleOpen {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.74) rotate(-18deg); filter: blur(3px) drop-shadow(0 0 16px var(--circle-glow)); }
          68% { opacity: 1; transform: translate(-50%, -50%) scale(1.04) rotate(4deg); filter: blur(0) drop-shadow(0 0 34px var(--circle-glow)); }
          100% { opacity: 0.92; transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: blur(0) drop-shadow(0 0 28px var(--circle-glow)); }
        }
        @keyframes circleGeometryBreath {
          0%, 100% { opacity: 0.48; transform: rotate(-3deg) scale(0.98); }
          50% { opacity: 0.92; transform: rotate(3deg) scale(1.02); }
        }
        @keyframes circleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes circleFlash {
          0% { opacity: 0; transform: scale(0.42) rotate(-30deg); }
          18% { opacity: 0.92; transform: scale(0.94) rotate(5deg); }
          62% { opacity: 0.28; transform: scale(1.12) rotate(28deg); }
          100% { opacity: 0; transform: scale(1.22) rotate(42deg); }
        }
        @keyframes sigilBreathe {
          0%, 100% { opacity: 0.58; filter: blur(0); }
          50% { opacity: 1; filter: blur(0.2px); }
        }
        @keyframes corePulse {
          0%, 100% { transform: scale(0.78); opacity: 0.58; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes buttonCircleCast {
          0% { opacity: 0; transform: scale(0.25) rotate(-36deg); }
          28% { opacity: 0.72; transform: scale(0.82) rotate(8deg); }
          100% { opacity: 0; transform: scale(1.34) rotate(80deg); }
        }
        @keyframes buttonRuneBurst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          28% { opacity: 0.95; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -86%) scale(1.18); }
        }
        @keyframes buttonSpellWave {
          0% { opacity: 0.88; transform: scale(0.2); }
          100% { opacity: 0; transform: scale(7.5); }
        }
        @keyframes sealGlimmer {
          0%, 100% { filter: brightness(0.9); }
          45% { filter: brightness(1.18); }
        }
        @keyframes galaxySkyShift {
          0%, 100% { opacity: 0.55; background-position: 0 0, 0 0, 0 0, center; }
          50% { opacity: 0.95; background-position: 10px -8px, -7px 5px, 6px 9px, center; }
        }
        @keyframes galaxyVeil {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes galaxyBloom {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.28) rotate(-32deg); }
          28% { opacity: 0.95; transform: translate(-50%, -50%) scale(0.85) rotate(8deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.35) rotate(60deg); }
        }
        @keyframes galaxyStarFlight {
          0% { opacity: 0; transform: scale(0.88); }
          32% { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.3); }
        }
        @keyframes magicTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.72); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes enchantedMoteDrift {
          0%, 12% { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.35); }
          28% { opacity: 0.9; }
          72% { opacity: 0.58; }
          100% { opacity: 0; transform: translate3d(var(--mote-x), var(--mote-y), 0) scale(1.15); }
        }
        @keyframes portraitLevitate {
          0%, 100% { transform: translate(-50%, -50%) rotate(-0.4deg); }
          48% { transform: translate(-50%, calc(-50% - 4px)) rotate(0.5deg); }
        }
        @keyframes portraitDustOrbit {
          0% { opacity: 0; transform: rotate(var(--dust-angle)) translateY(-135px) scale(0.2); }
          28% { opacity: 0.95; }
          65% { opacity: 0.56; }
          100% { opacity: 0; transform: rotate(calc(var(--dust-angle) + 28deg)) translateY(-152px) scale(0.3); }
        }
        @keyframes portraitShimmer {
          0%, 30%, 100% { opacity: 0; transform: translateX(-42%); }
          52% { opacity: 0.72; }
          76% { opacity: 0; transform: translateX(46%); }
        }
        @keyframes runeDrift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 180px 0, 80px 0; }
        }
        @keyframes tipPulse {
          0%, 100% { transform: scale(0.82); opacity: 0.76; }
          50% { transform: scale(1.16); opacity: 1; }
        }
        @keyframes wandWoodShimmer {
          0%, 100% { opacity: 0.64; stroke-width: 2.4px; }
          46% { opacity: 0.96; stroke-width: 3.4px; }
        }
        @keyframes runeOrbit {
          from { transform: translate(-50%, -50%) rotate(-12deg); }
          to { transform: translate(-50%, -50%) rotate(348deg); }
        }
        @keyframes wandParticleDrift {
          0%, 10% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.25); }
          24% { opacity: 1; transform: translate3d(2px, -2px, 0) scale(0.9); }
          72% { opacity: 0.68; }
          100% { opacity: 0; transform: translate3d(var(--particle-x), var(--particle-y), 0) scale(0.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .great-hall-haze,
          .castle-spire,
          .floating-candle,
          .candle-flame,
          .castle-window,
          .magic-star,
          .enchanted-mote,
          .enchanted-ceiling,
          .stained-window,
          .stained-window::after,
          .house-banner,
          .grand-stair,
          .rune-ring,
          .wand-aura,
          .wand-highlight-path,
          .wand-tip-glow,
          .wand-particle,
          .living-portrait,
          .living-portrait::after,
          .portrait-dust,
          .grand-magic-circle,
          .grand-magic-circle::after,
          .circle-geometry,
          .circle-orbit,
          .circle-sigil,
          .circle-cast-flash,
          .circle-core,
          .button-magic-circle,
          .button-rune-burst,
          .button-spell-wave,
          .spell-seal,
          .spell-seal-orbit,
          .spell-tile::after,
          .spell-tile-engraving,
          .galaxy-rite-sky,
          .galaxy-rite-mark,
          .galaxy-cast-veil,
          .galaxy-cast-ring,
          .galaxy-cast-stars {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
