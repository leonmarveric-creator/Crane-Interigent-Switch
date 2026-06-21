// Web Audio API による近未来サウンド (音声ファイル不要・合成)。
// iOS: AudioContext はユーザー操作(タップ)内で resume すれば鳴る。
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function setMuted(m: boolean) { muted = m; }

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  if (ctx.state === "suspended") ctx.resume();
  if (!master) buildChain(ctx);
  return ctx;
}

// マスター + 軽いディレイ残響 (サイバーな空間感)
function buildChain(c: AudioContext) {
  master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  const send = c.createGain(); send.gain.value = 0.22;
  const delay = c.createDelay(); delay.delayTime.value = 0.085;
  const fb = c.createGain(); fb.gain.value = 0.3;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
  master.connect(send); send.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
  lp.connect(c.destination);
}

function env(c: AudioContext, g: GainNode, t: number, attack: number, dur: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function osc(
  c: AudioContext, type: OscillatorType, f0: number, f1: number,
  t0: number, dur: number, peak: number, detune = 0
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  o.connect(g); g.connect(master!);
  env(c, g, t0, dur * 0.12, dur, peak);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function noise(c: AudioContext, t0: number, dur: number, peak: number, fStart: number, fEnd: number) {
  const len = Math.floor(c.sampleRate * dur);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(fStart, t0);
  bp.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
  const g = c.createGain();
  s.connect(bp); bp.connect(g); g.connect(master!);
  env(c, g, t0, 0.01, dur, peak);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

/** ボタンタップ: 最先端ホログラムUI風のクリスプな確認音 */
export function blip() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 1900, 2700, t, 0.06, 0.03);          // 立ち上がりスイープ
  osc(c, "triangle", 950, 1400, t, 0.05, 0.018, 6);   // 倍音ボディ
  osc(c, "sine", 3300, 3700, t + 0.008, 0.05, 0.015); // きらめき (高域スパークル)
  noise(c, t, 0.035, 0.012, 6500, 3200);              // 微細なデジタルティック
  osc(c, "sine", 2500, 2500, t + 0.05, 0.05, 0.016);  // 確定ピン
}

/** 解錠: 起動スイープ + シマー + 確認ピン */
export function powerUp() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sawtooth", 180, 720, t, 0.32, 0.05);        // ボディ上昇
  osc(c, "sine", 700, 2300, t, 0.32, 0.03);            // シマー
  osc(c, "triangle", 360, 1440, t, 0.3, 0.025, 6);     // 倍音
  noise(c, t, 0.34, 0.03, 600, 5000);                  // ウーッシュ
  // 確認ピン (3度上のダブル)
  osc(c, "sine", 1320, 1320, t + 0.3, 0.12, 0.045);
  osc(c, "sine", 1760, 1760, t + 0.34, 0.14, 0.04);
}

/** 施錠: 下降スイープ + 低音サンク */
export function powerDown() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sawtooth", 760, 150, t, 0.3, 0.05);
  osc(c, "sine", 900, 240, t, 0.3, 0.025);
  noise(c, t, 0.26, 0.025, 4000, 500);
  osc(c, "sine", 130, 90, t + 0.16, 0.18, 0.05);       // 低音サンク
}

/** 汎用の確認音 */
export function confirm() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 880, 880, t, 0.07, 0.04);
  osc(c, "sine", 1320, 1320, t + 0.07, 0.1, 0.04);
}

/** 起動チャージ: ゆっくり上昇するハム + 完了チャイム (BootSequence用) */
export function charge() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sawtooth", 70, 240, t, 2.2, 0.03);            // 低音の立ち上がり
  osc(c, "sine", 220, 880, t + 0.1, 2.1, 0.022);        // ハーモニクス上昇
  osc(c, "triangle", 110, 440, t + 0.2, 2.0, 0.018, 7); // 倍音うねり
  noise(c, t, 2.2, 0.011, 300, 3200);                   // 空気感
  osc(c, "sine", 1320, 1320, t + 2.0, 0.18, 0.05);      // 完了チャイム
  osc(c, "sine", 1980, 1980, t + 2.12, 0.2, 0.045);
}

/** コマンド掃引: ボタン操作の瞬間に走る短いエネルギー音 */
export function sweep() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 1400, 480, t, 0.16, 0.022);
  noise(c, t, 0.16, 0.018, 5200, 800);
}

/** アクセス許可音 (PIN認証成功) */
export function access() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sawtooth", 240, 900, t, 0.34, 0.045);
  osc(c, "sine", 700, 2100, t, 0.34, 0.03);
  noise(c, t, 0.36, 0.024, 700, 5200);
  osc(c, "sine", 1320, 1320, t + 0.30, 0.14, 0.05);
  osc(c, "sine", 1760, 1760, t + 0.36, 0.16, 0.045);
  osc(c, "sine", 2640, 2640, t + 0.42, 0.18, 0.04);
}

/** 候補からランダムに1つ喋る (JARVISのセリフに変化をつける) */
export function speakOneOf(lines: string[]) {
  if (!lines.length) return;
  speak(lines[Math.floor(Math.random() * lines.length)]);
}

/** 音声をユーザー操作内で先行起動 (iOSで後続のspeakを鳴らせるようにする)。 */
export function primeVoice() {
  if (typeof window === "undefined") return;
  try { ac(); } catch { /* audio */ }
  try {
    const ss = window.speechSynthesis;
    if (ss) {
      ss.resume?.();
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0.01; u.rate = 10; // ほぼ無音だが「発話した」状態にして以後を解放
      if (chosenVoice) u.voice = chosenVoice;
      ss.speak(u);
    }
  } catch { /* ignore */ }
}

// 自然な女性アシスタントボイスを選択 (F.R.I.D.A.Y. 風・端末にあるものから優先順に)
let chosenVoice: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const byName = (n: string) => voices.find((v) => v.name === n);
  const femaleRe = /female|samantha|aria|jenny|ava|allison|susan|zoe|karen|moira|tessa|serena|kate|fiona|nicky|google us english/i;
  return (
    byName("Samantha") ||                                                   // Apple US 女性 (自然)
    byName("Ava") || byName("Ava (Premium)") || byName("Allison") ||        // Apple US 高品質女性
    byName("Microsoft Aria Online (Natural) - English (United States)") ||  // Edge 自然女性
    byName("Microsoft Jenny Online (Natural) - English (United States)") ||
    byName("Google US English") ||                                          // Chrome (女性寄り)
    byName("Moira") ||                                                      // Apple アイルランド女性 (FRIDAYの雰囲気)
    byName("Karen") || byName("Tessa") || byName("Serena") || byName("Kate") ||
    voices.find((v) => v.lang?.startsWith("en") && femaleRe.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    null
  );
}
if (typeof window !== "undefined" && window.speechSynthesis) {
  chosenVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => { chosenVoice = pickVoice(); };
}

/** AIアシスタント音声 (Web Speech API・無料)。自然な女性ボイス・落ち着いた話速。 */
export function speak(text: string) {
  if (muted) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const v = chosenVoice || pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v;
    u.lang = v?.lang || "en-US";
    u.rate = 1.0;    // 自然な速さ
    u.pitch = 1.08;  // やや高めの落ち着いた女性トーン
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/** エラー音 */
export function error() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "square", 220, 180, t, 0.12, 0.04);
  osc(c, "square", 160, 130, t + 0.1, 0.14, 0.04);
}
