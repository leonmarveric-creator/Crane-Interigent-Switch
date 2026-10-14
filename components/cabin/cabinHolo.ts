/**
 * 車内 iPad のホログラム演出 (地図の枠の上に iframe で出す)。決まりごとは lib/cabinHolo.ts。
 *   ページ (public/cabin/holo/index.html) は音を鳴らさず「この声 / この効果音」と知らせてくるので、
 *   送迎画面の say / sfx (= お父さんの iPhone から。来ていなければ iPad から) で流す。
 */
import { HOLO_PAGE, HOLO_LEN_MS, isHoloSfx, isHoloVoice, type HoloRoom } from "@/lib/cabinHolo";

export interface Holo { on(): boolean; start(o: { room: HoloRoom; lang: string; ac: string; eta: number | null }): boolean; stop(): void; eta(min: number): void }

export function createHolo(c: { host: () => HTMLElement | null; say: (k: string) => void; sfx: (k: string) => void; onEnd?: () => void }): Holo {
  let fr: HTMLIFrameElement | null = null, timers: ReturnType<typeof setTimeout>[] = [], opts: { room: HoloRoom; lang: string; ac: string; eta: number | null } | null = null;
  const send = (m: Record<string, unknown>) => { try { fr?.contentWindow?.postMessage({ holo: 1, ...m }, location.origin); } catch { /* */ } };
  function onMsg(e: MessageEvent) {
    if (!fr || e.source !== fr.contentWindow || e.origin !== location.origin) return;
    const m = e.data; if (!m || m.holo !== 1) return;
    if (m.ready && opts) { send({ start: 1, ...opts }); fr.classList.add("on"); }
    else if (isHoloVoice(m.say)) c.say(m.say);
    else if (isHoloSfx(m.sfx)) c.sfx(m.sfx);
    else if (m.end) stop();
  }
  function stop() {
    timers.forEach(clearTimeout); timers = []; window.removeEventListener("message", onMsg);
    const f = fr; fr = null; opts = null; if (!f) return;
    f.classList.remove("on"); setTimeout(() => f.remove(), 700); // ゆっくり消して、地図に戻る
    c.onEnd?.();
  }
  function start(o: { room: HoloRoom; lang: string; ac: string; eta: number | null }) {
    const host = c.host(); if (!host || fr) return false;
    opts = o; window.addEventListener("message", onMsg);
    fr = document.createElement("iframe"); fr.className = "holoFr"; fr.src = HOLO_PAGE; fr.title = "Crane Nest hologram";
    fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    host.appendChild(fr);
    timers.push(setTimeout(() => { if (fr && !fr.classList.contains("on")) stop(); }, 9000)); // 読み込めない (電波が無い) → やめる
    timers.push(setTimeout(stop, HOLO_LEN_MS + 9000)); // 念のため
    return true;
  }
  return { on: () => !!fr, start, stop, eta: (m) => send({ eta: m }) };
}
