/**
 * 「すぐ知らせる」合図 (public/rt.js) を画面から使うための入口。
 * 読み込めない・設定が無いときは何もしない (今までどおり一定の間隔で聞きに行く)。
 */
type RT = { join(c: string, f: () => void): void; kick(c: string): void; on(): boolean };
let loading: Promise<RT | null> | null = null;
function rt(): Promise<RT | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as any;
  if (w.CNRT) return Promise.resolve(w.CNRT as RT);
  if (!loading) loading = new Promise((ok) => { const s = document.createElement("script"); s.src = "/rt.js"; s.onload = () => ok((w.CNRT as RT) ?? null); s.onerror = () => { loading = null; ok(null); }; document.head.appendChild(s); });
  return loading;
}
/** 車内 iPad とお父さんのスマホの合図 */
export const CABIN_CH = "cn-cabin";
export const rtJoin = (c: string, f: () => void) => { void rt().then((r) => r?.join(c, f)); };
export const rtKick = (c: string) => { void rt().then((r) => r?.kick(c)); };
