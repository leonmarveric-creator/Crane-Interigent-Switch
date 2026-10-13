/**
 * アストレアの声・効果音を、お父さんのスマホに先に保存する (public/driver-sw.js が保存・再生のときに使う)。
 *   車の中で 1 つずつダウンロードすると間に合わず (約 4 秒)、iPad が代わりに話してしまうため。
 *   一覧は public/cabin/audio/list.json (scripts/cabin-audio-list.mjs で作る)。v が変わったら保存し直す。
 */
export interface VoiceCacheState { state: "idle" | "saving" | "done" | "fail" | "unsupported"; done: number; total: number }
let st: VoiceCacheState = { state: "idle", done: 0, total: 0 };
const subs = new Set<(s: VoiceCacheState) => void>();
const set = (s: VoiceCacheState) => { st = s; subs.forEach((f) => f(s)); };
export const voiceCacheState = () => st;
export const onVoiceCache = (f: (s: VoiceCacheState) => void) => { subs.add(f); return () => { subs.delete(f); }; };
const KEY = "cnVoiceCacheV";
let running = false;
/** 保存する。force = 保存済みでももう一度確かめる。extra = 選んだ BOOST の音など */
export async function syncVoiceCache(extra: string[] = [], force = false): Promise<void> {
  if (running) return; running = true;
  try {
    if (!("serviceWorker" in navigator) || !("caches" in window)) { set({ state: "unsupported", done: 0, total: 0 }); return; }
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
    if (!reg || !reg.active) { set({ state: "fail", done: 0, total: 0 }); return; }
    const list = await fetch("/cabin/audio/list.json", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!list?.files) { set({ state: "fail", done: 0, total: 0 }); return; }
    let old = ""; try { old = localStorage.getItem(KEY) || ""; } catch { /* */ }
    const key = list.v + "|" + extra.join(",");
    const urls: string[] = [...list.files, ...extra];
    if (old === key && !force) { set({ state: "done", done: urls.length, total: urls.length }); return; }
    const reset = !!old && old.split("|")[0] !== list.v; // 声が差し替わった
    set({ state: "saving", done: 0, total: urls.length });
    const r = await new Promise<{ fail: number }>((ok) => {
      const ch = new MessageChannel(); let last = { fail: 0 };
      const to = setTimeout(() => ok({ fail: -1 }), 180000);
      ch.port1.onmessage = (m) => { last = m.data; set({ state: "saving", done: m.data.done, total: m.data.total }); if (m.data.done >= m.data.total) { clearTimeout(to); ok(last); } };
      reg.active!.postMessage({ type: "precache", urls, reset }, [ch.port2]);
    });
    if (r.fail === 0) { try { localStorage.setItem(KEY, key); } catch { /* */ } set({ state: "done", done: urls.length, total: urls.length }); }
    else set({ state: "fail", done: st.done, total: urls.length });
  } finally { running = false; }
}
