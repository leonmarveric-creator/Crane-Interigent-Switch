/**
 * 「すぐ知らせる」合図 (public/rt.js) を画面から使うための入口。
 * 読み込めない・設定が無いときは何もしない (今までどおり一定の間隔で聞きに行く)。
 */
type RT = { join(c: string, f: () => void, g?: (ev: string, p: any) => void): void; kick(c: string): void; send(c: string, ev: string, p: any): boolean; on(): boolean };
let loading: Promise<RT | null> | null = null;
function rt(): Promise<RT | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as any;
  if (w.CNRT) return Promise.resolve(w.CNRT as RT);
  if (!loading) loading = new Promise((ok) => { const s = document.createElement("script"); s.src = "/rt.js?v=2"; s.onload = () => ok((w.CNRT as RT) ?? null); s.onerror = () => { loading = null; ok(null); }; document.head.appendChild(s); });
  return loading;
}
/** 車内 iPad とお父さんのスマホの合図 */
export const CABIN_CH = "cn-cabin";
export const rtJoin = (c: string, f: () => void) => { void rt().then((r) => r?.join(c, f)); };
export const rtKick = (c: string) => { void rt().then((r) => r?.kick(c)); };
/** 合図の回線がつながっているか (つながっていなければ、今までどおりの間隔で聞きに行く) */
export const rtOn = (): boolean => { try { return typeof window !== "undefined" && !!(window as any).CNRT?.on(); } catch { return false; } };

/** 合図に加えて、中身つきのメッセージ (名前, 中身) も受け取る */
export const rtJoinMsg = (c: string, f: () => void, g: (ev: string, p: any) => void) => { void rt().then((r) => r?.join(c, f, g)); };
/** 中身つきのメッセージを送る (回線がまだ無ければ false。届いたかどうかは分からない) */
export const rtSend = (c: string, ev: string, p: any): boolean => { try { const w = typeof window !== "undefined" ? (window as any).CNRT : null; return !!w && !!w.send && !!w.send(c, ev, p); } catch { return false; } };
