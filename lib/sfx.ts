// Web Audio API による合成効果音 (音声ファイル不要)。
// iOS: AudioContext はユーザー操作(タップ)内で resume すれば鳴る。
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) { muted = m; }

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

function sweep(from: number, to: number, dur: number, type: OscillatorType, gain: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

/** ボタンタップ音 */
export function blip() { if (!muted) tone(720, 0.06, "triangle", 0.05); }
/** 解錠 (起動スイープ上昇 + ハイ確認音) */
export function powerUp() {
  if (muted) return;
  sweep(240, 900, 0.28, "sawtooth", 0.06);
  setTimeout(() => tone(1180, 0.09, "sine", 0.04), 240);
}
/** 施錠 (下降スイープ) */
export function powerDown() { if (!muted) sweep(680, 180, 0.3, "sawtooth", 0.05); }
/** PIN成功などの確認音 */
export function confirm() { if (!muted) { tone(660, 0.06, "sine", 0.04); setTimeout(() => tone(990, 0.08, "sine", 0.04), 70); } }
