/**
 * エアコンを「冷房」と「暖房」のどちらでつけるか。
 *   部屋の設定 (ac_policy) が cool / heat ならそのまま。auto なら「外の気温 + 季節」で決める。
 *     - 外が 24℃ 以上 → 冷房 / 18℃ 以下 → 暖房
 *     - その間 (春・秋の過ごしやすい日) → 季節で決める (5〜10 月は冷房、11〜4 月は暖房)
 *     - 気温が取れないとき → 季節で決める (今までと同じ)
 *   外の気温は Open-Meteo (無料・登録不要) から Crane Nest の場所で取る。30 分は覚えておく。
 */
export type AcMode = "cool" | "heat";
export type AcPolicy = "auto" | "cool" | "heat";
export const AC_HOT = 24, AC_COLD = 18;
const LAT = 34.383, LNG = 135.3226; // Crane Nest (泉佐野市上之郷)

let cache: { at: number; temp: number } | null = null;
export async function outsideTemp(): Promise<number | null> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.temp;
  try {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 3000);
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m&timezone=Asia%2FTokyo`, { signal: ac.signal, cache: "no-store" });
    clearTimeout(tm);
    const j: any = await r.json();
    const t = Number(j?.current?.temperature_2m);
    if (!Number.isFinite(t)) return null;
    cache = { at: Date.now(), temp: t };
    return t;
  } catch { return null; }
}

export const jstMonth = (nowMs = Date.now()) => Number(new Date(nowMs).toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Tokyo" }));
const seasonMode = (m: number): AcMode => (m >= 5 && m <= 10 ? "cool" : "heat");

/** 純粋関数 (テスト用): 方針・外の気温・月 → 冷房 / 暖房 */
export function decideAcMode(policy: unknown, temp: number | null, month: number): { mode: AcMode; why: "policy" | "temp" | "season" } {
  if (policy === "cool" || policy === "heat") return { mode: policy, why: "policy" };
  if (temp != null) {
    if (temp >= AC_HOT) return { mode: "cool", why: "temp" };
    if (temp <= AC_COLD) return { mode: "heat", why: "temp" };
  }
  return { mode: seasonMode(month), why: "season" };
}

export async function acModeFor(room: any): Promise<{ mode: AcMode; why: string; temp: number | null }> {
  const policy = room?.ac_policy ?? "auto";
  const temp = policy === "auto" ? await outsideTemp() : null;
  return { ...decideAcMode(policy, temp, jstMonth()), temp };
}
