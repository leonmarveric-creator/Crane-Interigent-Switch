/**
 * 車内 iPad の声をこのスマホで鳴らす (Bluetooth で車のスピーカーへ)。
 *   1 秒ごとに /api/cabin/voice を見て、新しい声があれば順番に鳴らす。
 *   Web Audio で鳴らすので、流れている音楽と重ねて鳴らせる (音楽は onStart / onEnd で小さくする)。
 *   unlock() は必ず指で押したとき (出発ボタンなど) に呼ぶこと (iPhone の決まり)。
 */
export interface RemoteVoice { stop(): void; busy(): boolean; /** iPad の声を受け取れている (最近の問い合わせが成功) */ ok(): boolean }
/** 効果音の印 (声の順番待ちに入れず、すぐ重ねて鳴らす・音楽も下げない) */
export const SFX_MARK = "#sfx";
let AC: AudioContext | null = null;
const cache = new Map<string, Promise<AudioBuffer | null>>();
export function unlockRemoteVoice() {
  try {
    AC = AC || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    void AC!.resume(); const b = AC!.createBuffer(1, 1, 22050), s = AC!.createBufferSource(); s.buffer = b; s.connect(AC!.destination); s.start(0);
  } catch { /* 鳴らせない端末 */ }
}
function load(u: string): Promise<AudioBuffer | null> {
  if (!cache.has(u)) cache.set(u, fetch(u).then((r) => r.arrayBuffer()).then((a) => new Promise<AudioBuffer | null>((ok) => AC!.decodeAudioData(a, ok, () => ok(null)))).catch(() => null));
  return cache.get(u)!;
}
export function startRemoteVoice(tripId: string, h: { onStart?: () => void; onEnd?: () => void; onSetup?: () => void; /** 声を鳴らす直前 (どの声か) */ onPlay?: (u: string) => void } = {}): RemoteVoice {
  let okAt = 0;
  let live = true, last = 0, playing = 0, busy = false, setupSaid = false;
  const q: string[] = [];
  async function pump() {
    if (busy || !q.length || !AC) return; busy = true; const u = q.shift()!;
    try {
      if (AC.state !== "running") await AC.resume().catch(() => {});
      const buf = await load(u);
      if (buf && live) {
        playing++; try { h.onPlay?.(u); } catch { /* */ } h.onStart?.();
        await new Promise<void>((ok) => { const s = AC!.createBufferSource(), g = AC!.createGain(); g.gain.value = 1; s.buffer = buf; s.connect(g); g.connect(AC!.destination); s.onended = () => ok(); s.start(); setTimeout(ok, buf.duration * 1000 + 500); });
        playing--; if (!playing) h.onEnd?.();
      }
    } catch { /* 次へ */ }
    busy = false; void pump();
  }
  async function playFx(u: string) {
    try {
      if (!AC || !live) return; if (AC.state !== "running") await AC.resume().catch(() => {});
      const buf = await load(u); if (!buf || !live) return;
      const s = AC.createBufferSource(); s.buffer = buf; s.connect(AC.destination); s.start();
    } catch { /* 鳴らせなくても続ける */ }
  }
  const iv = setInterval(async () => {
    if (!live) return;
    const r = await fetch(`/api/cabin/voice?t=${tripId}&after=${last}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) okAt = Date.now();
    if (!r?.ok) { if (r?.error === "SETUP" && !setupSaid) { setupSaid = true; h.onSetup?.(); } return; }
    if (!last) last = Number(r.now) - 3000; // 最初は 3 秒前より新しいものだけ (時計はサーバーのもの)
    for (const it of (r.items ?? []).filter((x: any) => Number(x.n) > last)) {
      last = Math.max(last, Number(it.n));
      if (it.s === SFX_MARK) { void playFx(String(it.u)); continue; } // 効果音はすぐ鳴らす
      q.push(String(it.u)); void load(String(it.u));
    }
    void pump();
  }, 1000);
  return { stop() { live = false; clearInterval(iv); q.length = 0; }, busy: () => busy || q.length > 0, ok: () => Date.now() - okAt < 6000 };
}
