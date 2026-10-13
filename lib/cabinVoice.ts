/**
 * アストレアの声を「聞き取りやすく」するかどうか (お父さんのスマホで鳴らすときだけ、その場で音を整える)。
 *   声のファイルは元のまま。スマホが鳴らす直前に、低い音を少し減らし・言葉の帯域を強め・大きくする (ノイズを足さない)。
 *   設定: app_settings.voice_clear = "boost" (BOOST のあたりの声だけ・ふだんは元の声) / "all" / "off"
 */
export type VoiceMode = "boost" | "all" | "off";
export const VOICE_MODES: { id: VoiceMode; ja: string; zh: string; sub: string; subZh: string }[] = [
  { id: "boost", ja: "BOOST のときだけ", zh: "仅 BOOST 时", sub: "高速道路の声だけ大きく・ふだんは元の声", subZh: "只在高速路段加大，平时保持原声" },
  { id: "all", ja: "いつも", zh: "一直", sub: "すべての声を大きく・聞き取りやすく", subZh: "所有声音都加大、更清楚" },
  { id: "off", ja: "使わない", zh: "不用", sub: "すべて元の声のまま", subZh: "全部保持原声" },
];
export const VOICE_MODE_DEFAULT: VoiceMode = "boost";
export const isVoiceMode = (v: unknown): v is VoiceMode => v === "boost" || v === "all" || v === "off";
/** BOOST (スカイゲートブリッジ・高速道路) のあたりで話す声 */
export const BOOST_VOICE = /\/(en-boost-|en-bridge|ai\/bridge(In|fact)?-|ai\/d-bridge-|ai\/topspeed-|dh\/boost|dh\/spd)/;
/** この声を聞き取りやすくするか */
export const voiceClear = (u: string, mode: VoiceMode): boolean => mode === "all" || (mode === "boost" && BOOST_VOICE.test(u));
