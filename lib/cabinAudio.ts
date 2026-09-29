/** iPad (Safari) は、指で触ったときに一度鳴らした音声プレーヤーでないと、あとから自動で鳴らせない。
 *  最初のタップのときに無音で一度鳴らしておく (これが無いと、ときどき声が出ない) */
export function unlockAudio(el: HTMLAudioElement, url: string) {
  try { el.muted = true; el.src = url; const p = el.play(); if (p) p.then(() => { el.pause(); el.muted = false; el.currentTime = 0; }).catch(() => { el.muted = false; }); else el.muted = false; } catch { el.muted = false; }
}
/** 鳴らす。止められていたら (AudioContext が眠っていた等) 一度だけ起こしてからもう一度 */
export function playSafe(el: HTMLAudioElement, wake: () => void, onFail: () => void) {
  el.play().catch(() => { try { wake(); } catch { /* */ } setTimeout(() => { el.play().catch(onFail); }, 300); });
}
