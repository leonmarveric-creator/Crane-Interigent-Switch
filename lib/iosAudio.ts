/**
 * iPhone の「消音 (マナーモード) スイッチ」対策。
 * iPhone は消音スイッチが入っていると、Web Audio (ASTRAEA の声・効果音・音楽の音量調整) を鳴らさない。
 * Safari 17 以降 (iOS 17+) は navigator.audioSession.type = "playback" で「音楽アプリと同じ扱い」になり、消音スイッチでも鳴る。
 * 何度呼んでもよい (タップのたびに呼ぶ)。古い iOS では何もしない
 */
export function playbackSession() {
  try { const s = (navigator as any).audioSession; if (s && s.type !== "playback") s.type = "playback"; } catch { /* 古い端末 */ }
}
