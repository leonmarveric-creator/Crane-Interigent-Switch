/**
 * 和風モードの音 (琴・木・風鈴・おりん・拍子木・閂)。
 *   音声ファイルは使わず Web Audio でその場で合成する (読み込みなし・古いスマホでも軽い)。
 *   消音ボタン (lib/sfx の isMuted) に従う。ハイテクUI / マジカルUI の音には関係しない。
 */
import { isMuted } from "@/lib/sfx";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function out(c: AudioContext, vol: number) { const g = c.createGain(); g.gain.value = vol; g.connect(c.destination); return g; }
function noise(c: AudioContext, dur: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}

/** 琴: 弦をはじく音 */
function koto(c: AudioContext, freq: number, t: number, vol = 0.22) {
  const o0 = out(c, vol);
  ([[1, 1, 1.6], [2, 0.45, 0.9], [3, 0.22, 0.6], [4.02, 0.12, 0.4]] as const).forEach(([h, a, d]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = h === 1 ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq * h * 1.012, t);
    o.frequency.exponentialRampToValueAtTime(freq * h, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(o0); o.start(t); o.stop(t + d + 0.05);
  });
  const n = noise(c, 0.03), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = freq * 3; f.Q.value = 2;
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  n.connect(f); f.connect(g); g.connect(o0); n.start(t);
}
/** 木の音「コッ」 */
function wood(c: AudioContext, t: number, freq = 820, vol = 0.28) {
  const o0 = out(c, vol);
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(freq * 1.15, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.02);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(o0); o.start(t); o.stop(t + 0.12);
  const n = noise(c, 0.04), f = c.createBiquadFilter(), gn = c.createGain();
  f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 1.4;
  gn.gain.setValueAtTime(0.35, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  n.connect(f); f.connect(gn); gn.connect(o0); n.start(t);
}
/** 鈴 (風鈴・おりん): 整数倍でない倍音が長く残る */
function bell(c: AudioContext, t: number, base: number, partials: [number, number][], decay: number, vol: number) {
  const o0 = out(c, vol);
  partials.forEach(([r, a], i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = base * r;
    const d = decay * (1 - i * 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 3 + i; lg.gain.value = base * r * 0.0015;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d);
    o.connect(g); g.connect(o0); o.start(t); o.stop(t + d + 0.05);
  });
}

export type WafuSound = "tap" | "on" | "off" | "welcome" | "night" | "away" | "unlock" | "lock" | "fail";

/** 和風モードの音を鳴らす (消音中は鳴らさない) */
export function wafuSound(k: WafuSound) {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.005;
  try {
    switch (k) {
      case "tap": return wood(c, t);
      case "on": koto(c, 440, t); koto(c, 587.3, t + 0.13); return; // 琴・上がる二音
      case "off": return koto(c, 392, t, 0.2); // 琴・下がる一音
      case "welcome": [0, 0.18, 0.42].forEach((d, i) => bell(c, t + d, [2350, 2600, 2480][i], [[1, 0.5], [2.4, 0.18], [3.9, 0.08]], 1.3, 0.07)); return; // 風鈴
      case "night": return bell(c, t, 520, [[1, 0.6], [2.76, 0.28], [5.4, 0.12], [8.9, 0.05]], 3.6, 0.12); // おりん
      case "away": wood(c, t, 1250, 0.32); wood(c, t + 0.34, 1250, 0.32); return; // 拍子木
      case "unlock": wood(c, t, 700, 0.26); wood(c, t + 0.07, 980, 0.2); bell(c, t + 0.2, 1900, [[1, 0.45], [2.7, 0.15], [4.1, 0.06]], 0.9, 0.09); return; // 閂を抜いて鈴
      case "lock": wood(c, t, 900, 0.24); wood(c, t + 0.11, 520, 0.34); return; // 閂を掛ける
      case "fail": koto(c, 220, t, 0.2); koto(c, 155.6, t + 0.16, 0.16); return;
    }
  } catch { /* ignore */ }
}

/** 操作ごとの成功の音と、札の光り方 (灯る / 陰る) */
export function wafuDone(action: string): { sound: WafuSound; lit: boolean } {
  if (action === "unlock") return { sound: "unlock", lit: true };
  if (action === "lock") return { sound: "lock", lit: false };
  if (action === "welcome" || action === "welcome_cozy" || action === "normal") return { sound: "welcome", lit: true };
  if (action === "good_night" || action === "dream_fade") return { sound: "night", lit: false };
  if (action === "away") return { sound: "away", lit: false };
  if (action.endsWith("_off")) return { sound: "off", lit: false };
  return { sound: "on", lit: true };
}
