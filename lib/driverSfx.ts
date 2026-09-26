/**
 * お父さんの送迎画面の効果音 (Web Audio で合成・ファイルなし) と、アンドロイドの声 (/audio/driver/*.mp3)。
 *   声は 1 つの audio 要素を使い回す (iPhone で後から鳴らせるように)。複数のセリフは順番に流す。
 */
let ctx: AudioContext | null = null;
let muted = false, voiceOff = false;
export function setDriverMute(sfx: boolean, voice: boolean) { muted = sfx; voiceOff = voice; }

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t: number, dur: number, peak: number, f0: number, f1: number, q = 1) {
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
}
const now = () => (ac()?.currentTime ?? 0) + 0.01;
const on = () => !muted && !!ac();

export const sfx = {
  prime() { ac(); unlockVoice(); },
  blip() { if (!on()) return; const t = now(); tone("sine", 1800, 2600, t, 0.06, 0.05); tone("triangle", 900, 1300, t, 0.05, 0.03); },
  tick() { if (!on()) return; const t = now(); tone("sine", 1400, 1400, t, 0.05, 0.05); tone("sine", 2100, 2100, t + 0.04, 0.06, 0.035); },
  sweep() { if (!on()) return; const t = now(); noise(t, 0.5, 0.06, 600, 6000, 1.2); tone("sine", 300, 900, t, 0.45, 0.05); },
  chord() { if (!on()) return; const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone("sine", f, f, t + i * 0.07, 1.1, 0.05)); tone("triangle", 262, 262, t, 1.2, 0.04); },
  auth() { if (!on()) return; const t = now(); tone("sine", 1200, 1200, t, 0.08, 0.06); tone("sine", 1600, 1600, t + 0.1, 0.08, 0.06); tone("sine", 2400, 2400, t + 0.2, 0.3, 0.05); noise(t, 0.3, 0.03, 6000, 3000); },
  down() { if (!on()) return; const t = now(); tone("sawtooth", 600, 60, t, 0.9, 0.05); tone("sine", 900, 120, t, 0.8, 0.05); },
  notify() { if (!on()) return; const t = now(); tone("sine", 988, 988, t, 0.18, 0.06); tone("sine", 1319, 1319, t + 0.16, 0.3, 0.06); },
  error() { if (!on()) return; const t = now(); tone("square", 220, 140, t, 0.3, 0.04); },
  /** ハイブリッドの起動: モーターが目覚める「フィーン」→ ライト → READY の 2 音 */
  hybrid() {
    const c = ac(); if (!c || muted) return; const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "sine"; lp.type = "lowpass"; lp.frequency.value = 2400;
    o.frequency.setValueAtTime(180, t + 0.1); o.frequency.exponentialRampToValueAtTime(1150, t + 1.0); o.frequency.exponentialRampToValueAtTime(520, t + 1.8);
    g.gain.setValueAtTime(0.0001, t + 0.1); g.gain.linearRampToValueAtTime(0.06, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(t + 0.1); o.stop(t + 2.1);
    noise(t + 0.1, 1.2, 0.02, 3000, 9000, 0.7);
    noise(t + 0.9, 0.35, 0.03, 1500, 7000, 1.4); noise(t + 1.15, 0.35, 0.03, 1500, 7000, 1.4);
    tone("sine", 1046, 1046, t + 2.1, 0.5, 0.07); tone("sine", 1568, 1568, t + 2.28, 0.9, 0.06); tone("triangle", 523, 523, t + 2.1, 1.0, 0.03);
  },
  /** バイク版の起動: セル → 点火 → 空ぶかし → アイドリング */
  engine() {
    const c = ac(); if (!c || muted) return; const t = c.currentTime;
    for (let i = 0; i < 6; i++) noise(t + i * 0.09, 0.08, 0.12, 900, 500, 3);
    const lp = c.createBiquadFilter(), g = c.createGain(); lp.type = "lowpass"; lp.frequency.value = 520;
    const T = t + 0.6;
    [1, 0.5].forEach((m, i) => {
      const x = c.createOscillator(); x.type = i ? "square" : "sawtooth";
      x.frequency.setValueAtTime(34 * m, T); x.frequency.exponentialRampToValueAtTime(120 * m, T + 0.45); x.frequency.exponentialRampToValueAtTime(40 * m, T + 1.3);
      x.connect(lp); x.start(T); x.stop(T + 2.8);
    });
    lp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(0.22, T + 0.08); g.gain.linearRampToValueAtTime(0.16, T + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, T + 2.7);
    [880, 1320, 1760].forEach((f, i) => tone("sine", f, f, T + 1.5 + i * 0.09, 0.25, 0.05));
  },
  lights(onOff: boolean) {
    if (!on()) return; const t = now();
    if (onOff) {
      noise(t, 0.5, 0.05, 900, 8000, 1.2); tone("sine", 660, 1320, t + 0.1, 0.5, 0.05);
      [1046, 1568, 2093].forEach((f, i) => tone("sine", f, f, t + 0.7 + i * 0.09, 0.9, 0.045));
      tone("sine", 1760, 1760, t + 0.95, 0.08, 0.04); tone("sine", 1760, 1760, t + 1.15, 0.08, 0.04);
    } else { tone("sine", 1320, 440, t, 0.6, 0.05); noise(t, 0.4, 0.03, 6000, 800, 1); }
  },
};

/* ---------------- アンドロイドの声 ---------------- */
let voiceEl: HTMLAudioElement | null = null;
let queue: string[] = [], seq = 0;
let onVoice: ((speaking: boolean) => void) | null = null;
export function onVoiceChange(fn: (speaking: boolean) => void) { onVoice = fn; }
function unlockVoice() {
  if (typeof Audio === "undefined" || voiceEl) return;
  voiceEl = new Audio(); voiceEl.preload = "auto";
  voiceEl.src = "/audio/driver/prep.mp3"; voiceEl.muted = true;
  voiceEl.play().then(() => { voiceEl!.pause(); voiceEl!.muted = false; }).catch(() => { if (voiceEl) voiceEl.muted = false; });
}
/** 声を順番に流す (例: ["room-haru", "galaxy-on"]) */
export function say(keys: string[], delay = 0) {
  if (voiceOff || typeof Audio === "undefined") return;
  const id = ++seq;
  setTimeout(() => {
    if (id !== seq) return;
    queue = keys.filter(Boolean);
    const el = voiceEl || (voiceEl = new Audio());
    const next = () => {
      if (id !== seq) return;
      const k = queue.shift();
      if (!k) { onVoice?.(false); return; }
      el.onended = next; el.onerror = next;
      el.src = `/audio/driver/${k}.mp3`; el.muted = false;
      el.play().catch(next);
    };
    onVoice?.(true); next();
  }, delay);
}
/** 部屋の声 (Room Haru. など)。季節の部屋・松竹梅林荷だけ */
export function roomVoice(slug: string): string | null {
  const s = slug.toLowerCase();
  for (const [re, k] of [[/haru|spring/, "haru"], [/natsu|natu|summer/, "natsu"], [/aki|autumn/, "aki"], [/fuyu|winter/, "fuyu"], [/matsu/, "matsu"], [/take/, "take"], [/ume/, "ume"], [/hayashi/, "hayashi"], [/(^|-)ni$|hasu/, "ni"]] as [RegExp, string][]) if (re.test(s)) return `room-${k}`;
  return null;
}
export const vib = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };
