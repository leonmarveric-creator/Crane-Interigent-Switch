/**
 * 車内 iPad の声をこのスマホで鳴らす (Bluetooth で車のスピーカーへ)。
 *   1 秒ごとに /api/cabin/voice を見て、新しい声があれば順番に鳴らす。
 *   Web Audio で鳴らすので、流れている音楽と重ねて鳴らせる (音楽は onStart / onEnd で小さくする)。
 *   unlock() は必ず指で押したとき (出発ボタンなど) に呼ぶこと (iPhone の決まり)。
 *
 * 声が消えないための約束 (iPad 側は components/cabin/cabinEngine.ts の say):
 *   - 「今ちゃんと鳴らせる」(音が止まっていない) ときだけ ready=1 を送る。画面オフでも音が動いていればスマホが鳴らす。
 *     サーバーは ready=1 のときだけ「スマホがいる」(voice_seen) を残し、iPad はそれを見て声をスマホに任せる。
 *   - 鳴らし始めた声の番号を ack で返す。iPad は返事が来なければ自分で鳴らす。
 *   - 鳴らせない (iPhone が音を止めた) ときは、その声を捨てて onBlocked で知らせる (iPad が代わりに鳴らす)。
 *   - 届くのが遅れた古い声 (STALE_MS より前) は鳴らさない (もう iPad が鳴らしている)。
 */
export interface RemoteVoice { stop(): void; busy(): boolean; /** iPad の声を受け取れている (最近の問い合わせが成功) */ ok(): boolean }
/** 効果音の印 (声の順番待ちに入れず、すぐ重ねて鳴らす・音楽も下げない) */
export const SFX_MARK = "#sfx";
/** これより古い声は鳴らさない。iPad は返事を最大 5 秒待ってから自分で鳴らすので、それより手前で打ち切る (両方から鳴らないように) */
const STALE_MS = 4300;
let AC: AudioContext | null = null;
const cache = new Map<string, Promise<AudioBuffer | null>>();
export function unlockRemoteVoice() {
  try {
    AC = AC || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    void AC!.resume(); const b = AC!.createBuffer(1, 1, 22050), s = AC!.createBufferSource(); s.buffer = b; s.connect(AC!.destination); s.start(0);
  } catch { /* 鳴らせない端末 */ }
}
/** 今このスマホで音を鳴らせるか (iPhone は電話・Siri などで音を止める)。
 *  画面が消えていても音が動いていれば鳴らせる (画面オフのときは大きめの声で鳴らす今の決まりのまま) */
export const voiceReady = () => !!AC && AC.state === "running";
function load(u: string): Promise<AudioBuffer | null> {
  if (!cache.has(u)) {
    const p = fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => new Promise<AudioBuffer | null>((ok) => AC!.decodeAudioData(a, ok, () => ok(null))))
      .catch(() => null);
    cache.set(u, p);
    // 読み込めなかったものは覚えておかない (電波が戻ったらもう一度読む)
    void p.then((b) => { if (!b) cache.delete(u); });
  }
  return cache.get(u)!;
}
export function startRemoteVoice(tripId: string, h: { onStart?: () => void; onEnd?: () => void; onSetup?: () => void; /** 声を鳴らす直前 (どの声か) */ onPlay?: (u: string) => void; /** iPhone が音を止めていて鳴らせなかった (指で画面に触れると戻る) */ onBlocked?: () => void } = {}): RemoteVoice {
  let okAt = 0;
  let live = true, last = 0, playing = 0, busy = false, setupSaid = false;
  let ack = 0, ackSent = 0, skew = 0; // ack: 鳴らし始めた声の番号 / skew: サーバーの時計 − このスマホの時計
  const q: { u: string; n: number }[] = [];
  const fresh = (n: number) => Date.now() + skew - n < STALE_MS;
  async function resume(): Promise<boolean> {
    if (!AC) return false;
    if (AC.state !== "running") await AC.resume().catch(() => {});
    return AC.state === "running";
  }
  async function pump() {
    if (busy || !q.length || !AC) return; busy = true; const it = q.shift()!;
    try {
      if (!fresh(it.n)) { /* 遅れて届いた声は iPad が鳴らしている */ }
      else if (!(await resume())) h.onBlocked?.(); // 鳴らしたことにしない → iPad が代わりに鳴らす
      else {
        const buf = await load(it.u);
        if (buf && live && fresh(it.n)) {
          ack = Math.max(ack, it.n); // 鳴らし始めた (iPad はこれを見て自分の声を消す)
          // 返事は次の 1 秒ごとの問い合わせを待たずに、すぐ送る (遅れると iPad が自分で鳴らしてしまう)。after を大きくして声は受け取らない
          { const a0 = ack; void fetch(`/api/cabin/voice?t=${tripId}&after=9999999999999999&ready=1&ack=${a0}`, { cache: "no-store" }).then((x) => x.json()).then((r) => { if (r?.ok) ackSent = Math.max(ackSent, a0); }).catch(() => {}); }
          playing++; try { h.onPlay?.(it.u); } catch { /* */ } h.onStart?.();
          await new Promise<void>((ok) => { const s = AC!.createBufferSource(), g = AC!.createGain(); g.gain.value = 1; s.buffer = buf; s.connect(g); g.connect(AC!.destination); s.onended = () => ok(); s.start(); setTimeout(ok, buf.duration * 1000 + 500); });
          playing--; if (!playing) h.onEnd?.();
        }
      }
    } catch { /* 次へ */ }
    busy = false; void pump();
  }
  async function playFx(u: string) {
    try {
      if (!AC || !live || !(await resume())) return;
      const buf = await load(u); if (!buf || !live) return;
      const s = AC.createBufferSource(); s.buffer = buf; s.connect(AC.destination); s.start();
    } catch { /* 鳴らせなくても続ける */ }
  }
  // 画面が戻ったら音も戻す (指で押したあとなら、iPhone は resume を許す)
  const onVis = () => { if (document.visibilityState === "visible") void resume(); };
  document.addEventListener("visibilitychange", onVis);
  const iv = setInterval(async () => {
    if (!live) return;
    const a = ack > ackSent ? `&ack=${ack}` : "";
    const r = await fetch(`/api/cabin/voice?t=${tripId}&after=${last}&ready=${voiceReady() ? 1 : 0}${a}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { okAt = Date.now(); if (a) ackSent = Math.max(ackSent, ack); }
    if (!r?.ok) { if (r?.error === "SETUP" && !setupSaid) { setupSaid = true; h.onSetup?.(); } return; }
    if (typeof r.now === "number") skew = Number(r.now) - Date.now();
    if (!last) last = Number(r.now) - 3000; // 最初は 3 秒前より新しいものだけ (時計はサーバーのもの)
    for (const it of (r.items ?? []).filter((x: any) => Number(x.n) > last)) {
      last = Math.max(last, Number(it.n));
      if (it.s === SFX_MARK) try { h.onPlay?.(String(it.u)); } catch { /* */ } // 何が鳴るかを知らせる (BOOST の準備の合図・起動の効果音)
      if (it.s === SFX_MARK) { void playFx(String(it.u)); continue; } // 効果音はすぐ鳴らす
      q.push({ u: String(it.u), n: Number(it.n) }); void load(String(it.u));
    }
    void pump();
  }, 1000);
  return {
    stop() { live = false; clearInterval(iv); q.length = 0; document.removeEventListener("visibilitychange", onVis); },
    busy: () => busy || q.length > 0,
    ok: () => Date.now() - okAt < 6000,
  };
}
