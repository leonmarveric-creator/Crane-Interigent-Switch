/** iPad (Safari) は、指で触ったときに一度鳴らした音声プレーヤーでないと、あとから自動で鳴らせない。
 *  最初のタップのときに無音で一度鳴らしておく (これが無いと、ときどき声が出ない) */
export function unlockAudio(el: HTMLAudioElement, url: string) {
  try { el.muted = true; el.src = url; const p = el.play(); if (p) p.then(() => { el.pause(); el.muted = false; el.currentTime = 0; }).catch(() => { el.muted = false; }); else el.muted = false; } catch { el.muted = false; }
}
/* ASTRAEA の声は同時に 1 つだけ: 声のプレーヤーが鳴り始めたら、ほかの声のプレーヤーは止める (声が重なるのを防ぐ) */
const VOICES = new Set<HTMLAudioElement>();
let current: HTMLAudioElement | null = null;
function track(el: HTMLAudioElement) {
  if (VOICES.has(el)) return; VOICES.add(el);
  el.addEventListener("play", () => { current = el; VOICES.forEach((o) => { if (o !== el && !o.paused) { try { o.pause(); } catch { /* */ } } }); });
  el.addEventListener("pause", () => { if (current === el) current = null; });
}
/** 鳴らす。止められていたら (AudioContext が眠っていた等) 一度だけ起こしてからもう一度。
 *  その間に止められた・別の声に替わったときは、もう一度は鳴らさない (前の声がもう一度流れて重なるのを防ぐ) */
export function playSafe(el: HTMLAudioElement, wake: () => void, onFail: () => void) {
  track(el);
  const want = el.src, gen = ((el as any).__vg = ((el as any).__vg || 0) + 1);
  VOICES.forEach((o) => { if (o !== el && !o.paused) { try { o.pause(); } catch { /* */ } } });
  el.play().catch(() => {
    try { wake(); } catch { /* */ }
    setTimeout(() => {
      if ((el as any).__vg !== gen || el.src !== want || (current && current !== el) || (el as any).__vstop) { onFail(); return; }
      el.play().catch(onFail);
    }, 300);
  });
  (el as any).__vstop = false;
}
/** 声を止める (止めたあと、遅れて鳴り直さないように) */
export function stopVoice(el: HTMLAudioElement) { (el as any).__vstop = true; (el as any).__vg = ((el as any).__vg || 0) + 1; try { el.pause(); } catch { /* */ } }
