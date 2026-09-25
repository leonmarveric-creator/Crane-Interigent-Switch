// Web Audio API による近未来サウンド + 同梱AIアシスタント音声。
// iOS: AudioContext はユーザー操作(タップ)内で resume すれば鳴る。
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let activeVoiceAudio: HTMLAudioElement | null = null;
let activeSfxAudio: HTMLAudioElement | null = null;
let voicePrimed = false;

const VOICE_AUDIO_BASE = "/audio/voice/current/";
/**
 * 音声ファイルの版。同じファイル名で声を差し替えたとき、スマホに残った古い音声 (キャッシュ) を使わないよう
 * URL の末尾に付ける。声を作り直したら、この値を変える。
 */
const VOICE_AUDIO_VERSION = "android-2";
const VOICE_AUDIO_BY_TEXT: Record<string, string> = {
  "All systems online": "current-natural-voice-01-all-systems-online.mp3",
  "Good evening. Systems online": "current-natural-voice-02-good-evening-systems-online.mp3",
  "J.A.R.V.I.S online": "current-natural-voice-03-jarvis-online.mp3",
  "ASTRALIS system online": "current-natural-voice-65-astralis-system-online.mp3",
  "CELESTIAL link established": "current-natural-voice-66-celestial-link-established.mp3",
  "CELESTIAL core online": "current-natural-voice-67-celestial-core-online.mp3",
  "CELESTIAL system online. Welcome back.": "current-natural-voice-68-celestial-system-online-welcome-back.mp3",
  "CELESTIAL. All systems online.": "current-natural-voice-69-celestial-all-systems-online.mp3",
  // あいさつ・会話・隠しコマンド・部屋ごとのアシスタントの自己紹介
  "Good morning.": "current-natural-voice-70-good-morning.mp3",
  "Sweet dreams.": "current-natural-voice-71-sweet-dreams.mp3",
  "Relax. You've done enough today.": "current-natural-voice-72-relax-youve-done-enough-today.mp3",
  "Here is what I can do.": "current-natural-voice-73-here-is-what-i-can-do.mp3",
  "Party mode, activated!": "current-natural-voice-74-party-mode-activated.mp3",
  "Enjoy the aurora.": "current-natural-voice-75-enjoy-the-aurora.mp3",
  "Make a wish.": "current-natural-voice-76-make-a-wish.mp3",
  "Launching in three. Two. One.": "current-natural-voice-77-launching-in-three-two-one.mp3",
  "Here is your fortune.": "current-natural-voice-78-here-is-your-fortune.mp3",
  "Let's breathe together.": "current-natural-voice-79-lets-breathe-together.mp3",
  "Happy birthday!": "current-natural-voice-80-happy-birthday.mp3",
  "Enjoy the cherry blossoms.": "current-natural-voice-81-enjoy-the-cherry-blossoms.mp3",
  "Enjoy the fireworks.": "current-natural-voice-82-enjoy-the-fireworks.mp3",
  "Enjoy the autumn leaves.": "current-natural-voice-83-enjoy-the-autumn-leaves.mp3",
  "Enjoy the snowfall.": "current-natural-voice-84-enjoy-the-snowfall.mp3",
  "I am Akari, your room assistant.": "current-natural-voice-85-i-am-akari.mp3",
  "I am Ayano, your room assistant.": "current-natural-voice-86-i-am-ayano.mp3",
  "I am Sugetsu, your room assistant.": "current-natural-voice-87-i-am-sugetsu.mp3",
  "I am Seirin, your room assistant.": "current-natural-voice-88-i-am-seirin.mp3",
  "I am Kotoha, your room assistant.": "current-natural-voice-89-i-am-kotoha.mp3",
  "I am Sakura, your room assistant.": "current-natural-voice-91-i-am-sakura.mp3",
  "I am Mio, your room assistant.": "current-natural-voice-92-i-am-mio.mp3",
  "I am Gekka, your room assistant.": "current-natural-voice-93-i-am-gekka.mp3",
  "Access granted. Welcome": "current-natural-voice-04-access-granted-welcome.mp3",
  "Goodbye": "current-natural-voice-05-goodbye.mp3",
  "Powering down": "current-natural-voice-06-powering-down.mp3",
  "Have a safe trip": "current-natural-voice-07-have-a-safe-trip.mp3",
  "Good night": "current-natural-voice-08-good-night.mp3",
  "Lights dimmed": "current-natural-voice-09-lights-dimmed.mp3",
  "Rest mode engaged": "current-natural-voice-10-rest-mode-engaged.mp3",
  "Japanese Lamp offline": "current-natural-voice-11-japanese-lamp-offline.mp3",
  "Japanese lamp off": "current-natural-voice-12-japanese-lamp-off.mp3",
  "Ambient lighting off": "current-natural-voice-13-ambient-lighting-off.mp3",
  "Cozy mode engaged": "current-natural-voice-14-cozy-mode-engaged.mp3",
  "Setting a warm mood": "current-natural-voice-15-setting-a-warm-mood.mp3",
  "Relax and unwind": "current-natural-voice-16-relax-and-unwind.mp3",
  "Welcome home": "current-natural-voice-17-welcome-home.mp3",
  "Comfort mode engaged": "current-natural-voice-18-comfort-mode-engaged.mp3",
  "Systems set for your return": "current-natural-voice-19-systems-set-for-your-return.mp3",
  "Door unlocked": "current-natural-voice-20-door-unlocked.mp3",
  "Access granted": "current-natural-voice-21-access-granted.mp3",
  "Welcome in": "current-natural-voice-22-welcome-in.mp3",
  "Door secured": "current-natural-voice-23-door-secured.mp3",
  "Locked and secured": "current-natural-voice-24-locked-and-secured.mp3",
  "Lockdown engaged": "current-natural-voice-25-lockdown-engaged.mp3",
  "Air Con online": "current-natural-voice-26-air-con-online.mp3",
  "Air Con engaged": "current-natural-voice-27-air-con-engaged.mp3",
  "Air Con activated": "current-natural-voice-28-air-con-activated.mp3",
  "Air Con offline": "current-natural-voice-29-air-con-offline.mp3",
  "Air Con standby": "current-natural-voice-30-air-con-standby.mp3",
  "Air Con deactivated": "current-natural-voice-31-air-con-deactivated.mp3",
  "Light online": "current-natural-voice-32-light-online.mp3",
  "Light engaged": "current-natural-voice-33-light-engaged.mp3",
  "Light activated": "current-natural-voice-34-light-activated.mp3",
  "Light offline": "current-natural-voice-35-light-offline.mp3",
  "Light standby": "current-natural-voice-36-light-standby.mp3",
  "Light deactivated": "current-natural-voice-37-light-deactivated.mp3",
  "Japanese Lamp online": "current-natural-voice-38-japanese-lamp-online.mp3",
  "Ambient lighting engaged": "current-natural-voice-39-ambient-lighting-engaged.mp3",
  "Warm glow activated": "current-natural-voice-40-warm-glow-activated.mp3",
  "Restoring warm tone": "current-natural-voice-41-restoring-warm-tone.mp3",
  "Warm preset applied": "current-natural-voice-42-warm-preset-applied.mp3",
  "Galaxy mode engaged": "current-natural-voice-43-galaxy-mode-engaged.mp3",
  "Opening the cosmos": "current-natural-voice-44-opening-the-cosmos.mp3",
  "Enjoy the stars": "current-natural-voice-45-enjoy-the-stars.mp3",
  "Returning to Earth": "current-natural-voice-46-returning-to-earth.mp3",
  "Galaxy mode off": "current-natural-voice-47-galaxy-mode-off.mp3",
  "Goodnight, stargazer": "current-natural-voice-48-goodnight-stargazer.mp3",
  "Nest mode engaged": "current-natural-voice-49-nest-mode-engaged.mp3",
  "Warm light online": "current-natural-voice-50-warm-light-online.mp3",
  "Cozy glow, activated": "current-natural-voice-51-cozy-glow-activated.mp3",
  "Nest mode off": "current-natural-voice-52-nest-mode-off.mp3",
  "Warm light standby": "current-natural-voice-53-warm-light-standby.mp3",
  "Dimming the glow": "current-natural-voice-54-dimming-the-glow.mp3",
  // 光目覚ましのモード名 (女性アンドロイド音声)
  "Flame On": "current-natural-voice-55-flame-on.mp3",
  "Horizon Rise": "current-natural-voice-56-horizon-rise.mp3",
  // 音声で質問したときの返事 (答えは画面に大きく表示)
  "Here is your Wi-Fi information.": "current-natural-voice-57-here-is-your-wifi-information.mp3",
  "Here is your check-out time.": "current-natural-voice-58-here-is-your-check-out-time.mp3",
  "Here is the entrance code.": "current-natural-voice-59-here-is-the-entrance-code.mp3",
  "Here is your room code.": "current-natural-voice-60-here-is-your-room-code.mp3",
  "Sorry, that information is not available.": "current-natural-voice-61-that-information-is-not-available.mp3",
  "Here is the weather forecast.": "current-natural-voice-62-here-is-the-weather-forecast.mp3",
  "Here are nearby places.": "current-natural-voice-63-here-are-nearby-places.mp3",
  "Here are the emergency contacts.": "current-natural-voice-64-here-are-the-emergency-contacts.mp3",
};

const VOICE_LABEL_ALIASES: Array<[string, string]> = [
  ["Air Con", "Air Con"],
  ["エアコン", "Air Con"],
  ["空调", "Air Con"],
  ["에어컨", "Air Con"],
  ["Light", "Light"],
  ["照明", "Light"],
  ["灯光", "Light"],
  ["조명", "Light"],
  ["Japanese Lamp", "Japanese Lamp"],
  ["Japanese lamp", "Japanese Lamp"],
  ["和風ライト", "Japanese Lamp"],
  ["和风灯", "Japanese Lamp"],
  ["일본풍 조명", "Japanese Lamp"],
];

const GALAXY_ON_AUDIO_URL = "/audio/sfx/galaxy-sfx-05-arc-reactor-ignition.wav";
export type MagicTone = "gold" | "teal" | "rose" | "blue" | "green";
const MAGIC_TONE_ROOT: Record<MagicTone, number> = {
  gold: 392,
  teal: 523,
  rose: 277,
  blue: 440,
  green: 349,
};

export function setMuted(m: boolean) {
  muted = m;
  if (!m) return;
  stopAmbient();
  stopVoiceAudio();
  stopSfxAudio();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  if (ctx.state === "suspended") ctx.resume();
  if (!master) buildChain(ctx);
  return ctx;
}

export function primeMagicAudio() {
  if (!muted) void ac();
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

/**
 * 音声コントロールのあいさつ用: 次にボタンが喋るセリフを 1 回だけ差し替える。
 *   例:「ただいま」→ 快適モードのボタンが動き、いつものセリフの代わりに "Welcome home" と言う。
 *   効果音はボタンの処理のまま。数秒以内に喋らなければ差し替えは消える。
 */
let voiceOverride: { text: string; until: number } | null = null;
export function overrideNextVoice(text: string, ms = 20000) {
  voiceOverride = { text, until: Date.now() + ms };
}

/** 候補からランダムに1つ喋る (JARVISのセリフに変化をつける) */
export function speakOneOf(lines: string[]) {
  if (!lines.length) return;
  if (voiceOverride) {
    const o = voiceOverride;
    voiceOverride = null;
    if (Date.now() < o.until) { speak(o.text); return; }
  }
  speak(lines[Math.floor(Math.random() * lines.length)]);
}

function canonicalVoiceText(text: string): string {
  const trimmed = text.trim();
  for (const [label, canonicalLabel] of VOICE_LABEL_ALIASES) {
    if (trimmed.startsWith(`${label} `)) {
      return `${canonicalLabel}${trimmed.slice(label.length)}`;
    }
  }
  return trimmed;
}

function naturalVoiceUrl(text: string): string | null {
  const filename = VOICE_AUDIO_BY_TEXT[canonicalVoiceText(text)];
  return filename ? `${VOICE_AUDIO_BASE}${filename}?v=${VOICE_AUDIO_VERSION}` : null;
}

function stopVoiceAudio() {
  if (!activeVoiceAudio) return;
  activeVoiceAudio.pause();
  activeVoiceAudio.currentTime = 0;
  activeVoiceAudio = null;
}

function stopSfxAudio() {
  if (!activeSfxAudio) return;
  activeSfxAudio.pause();
  activeSfxAudio.currentTime = 0;
  activeSfxAudio = null;
}

/**
 * 声を鳴らす audio 要素は 1 つを使い回す。
 *   iPhone では「タップの中で一度鳴らした要素」でないと、あとから (通信を待ったあと・音声操作のあと) 鳴らせない。
 *   毎回新しい要素を作ると再生を断られ、ブラウザの機械音声 (古い声) に切り替わってしまうため。
 */
let voiceEl: HTMLAudioElement | null = null;
function getVoiceEl(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!voiceEl) { voiceEl = new Audio(); voiceEl.preload = "auto"; }
  return voiceEl;
}

function playNaturalVoice(text: string): boolean {
  const url = naturalVoiceUrl(text);
  if (!url || typeof Audio === "undefined") return false;
  try {
    stopVoiceAudio();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    const a = (voicePrimed && getVoiceEl()) || new Audio();
    a.src = url;
    a.preload = "auto";
    a.muted = false;
    a.volume = 1;
    activeVoiceAudio = a;
    a.onended = () => {
      if (activeVoiceAudio === a) activeVoiceAudio = null;
    };
    // 再生を断られたら少し待って 1 回だけやり直す。それでもだめなら鳴らさない
    // (録音の声があるセリフは、ブラウザの機械音声=古い声には切り替えない)
    void a.play().catch(() => {
      setTimeout(() => {
        if (activeVoiceAudio !== a || muted) return;
        void a.play().catch(() => { if (activeVoiceAudio === a) activeVoiceAudio = null; });
      }, 300);
    });
    return true;
  } catch {
    return false;
  }
}

function primeNaturalVoice() {
  if (voicePrimed || typeof Audio === "undefined") return;
  const url = naturalVoiceUrl("Access granted");
  if (!url) return;
  try {
    // タップの中で共用の要素を無音で一度鳴らしておく (以後この要素なら後からでも鳴らせる)
    const a = getVoiceEl();
    if (!a) return;
    a.src = url;
    a.muted = true;
    void a.play().then(() => {
      if (activeVoiceAudio !== a) { a.pause(); a.currentTime = 0; }
      a.muted = false;
      voicePrimed = true;
    }).catch(() => { a.muted = false; /* user gesture may still be required */ });
  } catch { /* ignore */ }
}

/** 音声をユーザー操作内で先行起動 (iOSで後続のspeakを鳴らせるようにする)。 */
export function primeVoice() {
  if (typeof window === "undefined") return;
  try { ac(); } catch { /* audio */ }
  try { primeNaturalVoice(); } catch { /* audio */ }
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
  if (playNaturalVoice(text)) return;
  speakWithBrowser(text);
}

/** AIアシスタント音声のブラウザ合成フォールバック。 */
function speakWithBrowser(text: string) {
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

/** PINキー入力: 超短いホロタイプ音 (1桁ごと) */
export function keyTick() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 2200 + Math.random() * 500, 3100, t, 0.045, 0.028);
  noise(c, t, 0.03, 0.012, 7000, 3500);
}

/** アクセス拒否: 二段の警告ブザー + ノイズバースト */
export function deny() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "square", 340, 300, t, 0.14, 0.045);
  osc(c, "square", 250, 210, t + 0.16, 0.16, 0.05);
  osc(c, "sawtooth", 120, 80, t + 0.16, 0.22, 0.04);
  noise(c, t, 0.1, 0.02, 2200, 500);
}

/** レッドアラート: ゆっくり上下するサイレン風 (拒否画面) */
export function alert() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t);
  o.frequency.linearRampToValueAtTime(520, t + 0.55);
  o.frequency.linearRampToValueAtTime(300, t + 1.1);
  o.connect(g); g.connect(master!);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.08);
  g.gain.setValueAtTime(0.035, t + 0.95);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o.start(t); o.stop(t + 1.25);
}

/** UIナビ切替: 軽いホロスワイプ */
export function navTick() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 900, 1600, t, 0.07, 0.025);
  osc(c, "sine", 2400, 2400, t + 0.05, 0.06, 0.014);
  noise(c, t, 0.06, 0.01, 4500, 1800);
}

/** ホログラム展開: パネル出現用の短い上昇シマー */
export function holo() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 500, 1800, t, 0.22, 0.02);
  osc(c, "triangle", 250, 900, t, 0.2, 0.014, 5);
  noise(c, t, 0.2, 0.012, 1200, 6000);
}

/** ギャラクシーモードON: 夢のような上昇シマー和音 (星空展開) */
function playGalaxyOnAsset(): boolean {
  if (typeof Audio === "undefined") return false;
  try {
    stopSfxAudio();
    const a = new Audio(GALAXY_ON_AUDIO_URL);
    a.preload = "auto";
    a.volume = 0.95;
    activeSfxAudio = a;
    a.onended = () => {
      if (activeSfxAudio === a) activeSfxAudio = null;
    };
    void a.play().catch(() => {
      if (activeSfxAudio === a) activeSfxAudio = null;
      syntheticGalaxyOn();
    });
    return true;
  } catch {
    return false;
  }
}

function syntheticGalaxyOn() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  // ゆっくり開く和音 (A - C# - E - A)
  [440, 554, 659, 880].forEach((f, i) => {
    osc(c, "sine", f * 0.5, f, t + i * 0.09, 0.9, 0.02);
  });
  osc(c, "triangle", 220, 440, t, 1.0, 0.014, 6); // 底のうねり
  noise(c, t, 1.1, 0.012, 800, 7000);             // 星屑の煌めき
  // 高域スパークル (ランダムな星)
  for (let i = 0; i < 5; i++) {
    const f = 2000 + Math.random() * 2500;
    osc(c, "sine", f, f, t + 0.25 + i * 0.14, 0.12, 0.012);
  }
}

export function galaxyOn() {
  if (muted) return;
  if (playGalaxyOnAsset()) return;
  syntheticGalaxyOn();
}

/** ギャラクシーモードOFF: 静かに閉じる下降 */
export function galaxyOff() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  [880, 659, 554, 440].forEach((f, i) => {
    osc(c, "sine", f, f * 0.5, t + i * 0.07, 0.5, 0.016);
  });
  noise(c, t, 0.5, 0.01, 5000, 600);
}

/** エラー音 */
export function error() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "square", 220, 180, t, 0.12, 0.04);
  osc(c, "square", 160, 130, t + 0.1, 0.14, 0.04);
}

/** UIホバー: ごく短く上品な走査ティック (ボタンにカーソル/指が乗った時)。 */
export function hoverTick() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 1500, 2200, t, 0.035, 0.012);
  noise(c, t, 0.03, 0.006, 6000, 3000);
}

/** トグル操作のサーボ音: ON=上昇クリック / OFF=下降クリック (機械式の手応え)。 */
export function toggleServo(on: boolean) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  // メカのカチッ (短い帯域ノイズ)
  noise(c, t, 0.045, 0.02, on ? 2600 : 1400, on ? 5200 : 900);
  // サーボの動き (周波数スイープ)
  osc(c, "sawtooth", on ? 320 : 620, on ? 660 : 300, t, 0.11, 0.016, 4);
  osc(c, "sine", on ? 880 : 500, on ? 1240 : 360, t + 0.02, 0.09, 0.012);
}

/** システム到達の和音: シーン成功時などの充実した確定音 (ドミナント→トニック)。 */
export function systemChord() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  // 立ち上がりのきらめき
  noise(c, t, 0.18, 0.01, 1200, 7000);
  // 明るいメジャー和音を軽くアルペジオ (C - E - G - C)
  [523, 659, 784, 1046].forEach((f, i) => {
    osc(c, "sine", f, f, t + i * 0.05, 0.55, 0.02);
    osc(c, "triangle", f * 0.5, f * 0.5, t + i * 0.05, 0.5, 0.01, 5);
  });
}

/** データ転送のバースト: 微細なステップノイズ (背景/読み込み/情報更新)。 */
export function dataBurst() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  for (let i = 0; i < 7; i++) {
    const f = 1400 + Math.random() * 3200;
    osc(c, "square", f, f, t + i * 0.028, 0.02, 0.006);
  }
  noise(c, t, 0.2, 0.006, 3000, 6000);
}

/** ターゲットロック: 2音でカチッと固定する照準音 (カード選択/フォーカス)。 */
export function reticleLock() {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  osc(c, "sine", 1200, 1200, t, 0.05, 0.014);
  osc(c, "sine", 1800, 1800, t + 0.06, 0.06, 0.016);
  noise(c, t + 0.06, 0.04, 0.006, 5000, 2500);
}

/** 起動シーケンスの段階ビープ: BootSequenceの行表示に同期させる (i=0,1,2...)。 */
export function bootStage(i: number) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const base = 640 + i * 120;
  osc(c, "sine", base, base * 1.5, t, 0.09, 0.014);
  noise(c, t, 0.05, 0.006, 3000, 6500);
}

function magicRoot(tone: MagicTone | string) {
  const key = tone in MAGIC_TONE_ROOT ? tone as MagicTone : "gold";
  return MAGIC_TONE_ROOT[key];
}

/** 魔法陣が開く時のオリジナル効果音。公式作品由来の音源は使わない。 */
export function magicCircleChime(tone: MagicTone | string = "gold") {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const root = magicRoot(tone);
  noise(c, t, 0.46, 0.018, 8800, 1100);
  osc(c, "sine", root * 0.5, root * 1.02, t, 0.56, 0.026);
  osc(c, "triangle", root, root * 2, t + 0.03, 0.46, 0.021, 7);
  [root * 1.5, root * 2, root * 2.5].forEach((f, i) => {
    osc(c, "sine", f, f * 1.08, t + 0.12 + i * 0.055, 0.28, 0.017);
  });
}

/** ボタン押下と同時に、呪文の声へ重ねる短い発動音。 */
export function magicActionStart(tone: MagicTone | string = "gold") {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const root = magicRoot(tone);
  noise(c, t, 0.24, 0.014, 7200, 1600);
  osc(c, "sine", root * 2, root * 3, t, 0.22, 0.024);
  osc(c, "triangle", root, root * 1.75, t + 0.04, 0.26, 0.018, 6);
  osc(c, "sine", root * 4, root * 4.5, t + 0.18, 0.16, 0.014);
}

/** コマンド完了時の魔法的な返答音。失敗時は低く崩れる。 */
export function magicActionResolve(success = true) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  if (success) {
    [659, 784, 1046].forEach((f, i) => osc(c, "sine", f, f * 1.02, t + i * 0.055, 0.22, 0.018));
    noise(c, t, 0.16, 0.007, 6400, 3600);
    return;
  }
  noise(c, t, 0.18, 0.018, 2800, 440);
  osc(c, "square", 180, 92, t, 0.22, 0.024);
}

/** 杖で空気を切るようなオリジナル魔法音。映画由来の音源は使わない。 */
export function spellCast(success = true) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const root = success ? 392 : 220;
  noise(c, t, 0.22, success ? 0.018 : 0.026, success ? 9000 : 4200, success ? 1200 : 260);
  osc(c, "sine", root, root * 2, t, 0.42, success ? 0.028 : 0.018);
  osc(c, "triangle", root * 1.5, root * 3, t + 0.05, 0.34, success ? 0.022 : 0.014, 8);
  [root * 2, root * 2.5, root * 3].forEach((f, i) => {
    osc(c, "sine", f, success ? f * 1.25 : f * 0.72, t + 0.2 + i * 0.055, 0.2, success ? 0.018 : 0.012);
  });
  if (!success) {
    osc(c, "square", 130, 95, t + 0.25, 0.24, 0.028);
  }
}

/** マジカルモード専用: 呪文を唱え終えた後に広がる魔法の余韻。 */
export function magicIncantationEcho(tone: MagicTone | string = "gold") {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime;
  const root = magicRoot(tone);
  noise(c, t, 0.48, 0.014, 1400, 7800);
  noise(c, t + 0.2, 0.63, 0.006, 8600, 1800);
  osc(c, "sine", root * 0.5, root * 0.505, t + 0.05, 1.15, 0.018);
  const chimeNotes = [
    { ratio: 1, at: 0.1, level: 0.014 },
    { ratio: 1.5, at: 0.25, level: 0.017 },
    { ratio: 1.25, at: 0.42, level: 0.014 },
    { ratio: 2, at: 0.59, level: 0.012 },
  ];
  chimeNotes.forEach(({ ratio, at, level }) => {
    const note = root * ratio;
    osc(c, "sine", note, note * 0.998, t + at, 0.61, level);
    osc(c, "sine", note * 2.01, note * 2, t + at, 0.35, level * 0.3);
    osc(c, "sine", note, note * 0.996, t + at + 0.21, 0.48, level * 0.24);
  });
}

/* -------------------------------------------------------------------------- */
/* アンビエント: アークリアクターの低い持続ハム (opt-in・任意ON)。            */
/* -------------------------------------------------------------------------- */
let ambient: {
  nodes: (OscillatorNode | GainNode | BiquadFilterNode)[];
  gain: GainNode;
  lfo: OscillatorNode;
} | null = null;

/** リアクターハム開始 (二重起動しない)。ミュート中は鳴らさない。 */
export function startAmbient() {
  const c = ac(); if (!c || muted || ambient) return;

  const bus = c.createGain(); bus.gain.value = 0.0001;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
  bus.connect(lp); lp.connect(master ?? c.destination);

  // うなりを作る低音の重なり (55Hz + わずかにデチューン)。
  const o1 = c.createOscillator(); o1.type = "sine"; o1.frequency.value = 55;
  const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = 55; o2.detune.value = 6;
  const o3 = c.createOscillator(); o3.type = "triangle"; o3.frequency.value = 110; o3.detune.value = -4;
  const og = c.createGain(); og.gain.value = 0.5;
  o1.connect(bus); o2.connect(bus); o3.connect(og); og.connect(bus);

  // ゆっくり明滅するLFO (呼吸するリアクター)。
  const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.18;
  const lfoGain = c.createGain(); lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain); lfoGain.connect(bus.gain);

  const t = c.currentTime;
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.exponentialRampToValueAtTime(0.05, t + 1.2); // フェードイン

  [o1, o2, o3, lfo].forEach((o) => o.start(t));
  ambient = { nodes: [o1, o2, o3, og, bus, lp, lfoGain], gain: bus, lfo };
}

/** リアクターハム停止 (なめらかにフェードアウト)。 */
export function stopAmbient() {
  const c = ctx; if (!c || !ambient) return;
  const t = c.currentTime;
  const a = ambient; ambient = null;
  a.gain.gain.cancelScheduledValues(t);
  a.gain.gain.setValueAtTime(a.gain.gain.value, t);
  a.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  setTimeout(() => {
    try {
      a.lfo.stop();
      a.nodes.forEach((n) => { if ("stop" in n) (n as OscillatorNode).stop(); });
    } catch { /* already stopped */ }
  }, 600);
}

export function isAmbientOn() { return ambient !== null; }
