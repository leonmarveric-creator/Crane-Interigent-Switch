/**
 * 早朝便の自動光目覚まし: 時刻の決め方と文面 (依存なし・サーバー/ブラウザ共通)。
 *   起床 = 出発の 45 分前。出発は送迎予約の「出発したい時刻」、無ければ「便の 2 時間 40 分前」。
 *   起床が朝 7:00 (日本時間) より前になる人だけ。前の晩 20:00 から画面に出して、自動でセットする。
 *   ゲストが変えられる範囲: 出発の 2 時間前 〜 出発の 10 分前。
 */
export const WAKE_BEFORE_MIN = 45;
export const FLIGHT_LEAD_MIN = 160;
export const EARLY_LIMIT_HOUR = 7;
export const SHOW_FROM_HOUR = 20;
export const EDIT_MIN_BEFORE = 120;
export const EDIT_MAX_BEFORE = 10;

const jstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const jstHour = (ms: number) => new Date(ms + 9 * 3600e3).getUTCHours();
const dayMs = (d: string, hm: string) => Date.parse(`${d}T${hm.length === 5 ? hm : hm.padStart(5, "0")}:00+09:00`);

export interface WakePlan { departMs: number; wakeMs: number; flightMs: number | null; showFromMs: number; minMs: number; maxMs: number }

/** 送迎予約 (Crane Nest) から計画を作る。早朝でなければ null */
export function planWake(drop: { date: string | null; departAt: string | null; flightAt: string | null } | null | undefined, checkOutIso: string): WakePlan | null {
  if (!drop) return null;
  const flightMs = drop.flightAt ? Date.parse(drop.flightAt) : NaN;
  const date = drop.date || jstDay(Date.parse(checkOutIso));
  let departMs = NaN;
  if (drop.departAt && /^\d{1,2}:\d{2}/.test(drop.departAt)) departMs = dayMs(date, drop.departAt.slice(0, 5));
  if (!Number.isFinite(departMs) && Number.isFinite(flightMs)) departMs = flightMs - FLIGHT_LEAD_MIN * 60e3;
  if (!Number.isFinite(departMs)) return null;
  const wakeMs = departMs - WAKE_BEFORE_MIN * 60e3;
  if (jstHour(wakeMs) >= EARLY_LIMIT_HOUR) return null;
  // 前の晩 20:00 (起床の日の前日)
  const prev = jstDay(wakeMs - 86400e3);
  const showFromMs = Math.min(dayMs(prev, `${SHOW_FROM_HOUR}:00`), wakeMs - 4 * 3600e3);
  return { departMs, wakeMs, flightMs: Number.isFinite(flightMs) ? flightMs : null, showFromMs, minMs: departMs - EDIT_MIN_BEFORE * 60e3, maxMs: departMs - EDIT_MAX_BEFORE * 60e3 };
}

/** "4:05" の形 (日本時間) */
export const hmJst = (ms: number) => { const d = new Date(ms + 9 * 3600e3); return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

/** ゲストが選んだ "HH:MM" → 出発の日の時刻 (出発より後なら前の日) */
export function wakeFromHm(hm: string, plan: WakePlan): number | null {
  if (!/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const d = jstDay(plan.departMs);
  let ms = dayMs(d, hm.padStart(5, "0"));
  if (ms > plan.departMs) ms -= 86400e3;
  return ms;
}

export const WAKE_T = {
  ja: { on: "明朝 {W}　光の目覚まし ON", off: "光の目覚まし OFF", sub: "送迎 {D} 出発に合わせて自動セット", subOff: "押すと、もう一度 ON にできます", body: "10 分前から少しずつ明るくなり、時刻にお部屋の明かりがつきます。", wake: "起床", dep: "出発", fl: "便", gap: "{M} 分", edit: "時間を変える", offB: "使わない", onB: "やっぱり使う", save: "この時間にする", q: ["30 分前", "45 分前", "60 分前", "90 分前"], tooEarly: "出発の 2 時間前より早くはできません", tooLate: "出発の 10 分前より遅くはできません", saved: "✓ {W} に変更しました", offT: "✓ OFF にしました", onT: "✓ ON に戻しました", err: "うまく保存できませんでした。もう一度お試しください。", mT: "明日の朝、光でお起こしします", mS: "送迎 {D} 出発\n10 分前から、ゆっくり明るくなります", ok: "OK、おやすみなさい" },
  en: { on: "Light alarm ON · {W} tomorrow", off: "Light alarm OFF", sub: "Set for your {D} departure", subOff: "Tap to turn it back on", body: "The light slowly brightens from 10 minutes before, then the room lights come on.", wake: "Wake", dep: "Depart", fl: "Flight", gap: "{M} min", edit: "Change time", offB: "Turn off", onB: "Turn back on", save: "Set this time", q: ["30 min", "45 min", "60 min", "90 min"], tooEarly: "Can't be more than 2 hours before departure", tooLate: "Must be at least 10 minutes before departure", saved: "✓ Changed to {W}", offT: "✓ Turned off", onT: "✓ Turned back on", err: "Couldn't save. Please try again.", mT: "We'll wake you with light tomorrow", mS: "Departure {D}\nThe light brightens slowly from 10 minutes before", ok: "OK, good night" },
  zh: { on: "明早 {W}　灯光闹钟 已开启", off: "灯光闹钟 已关闭", sub: "已根据 {D} 的接送出发时间自动设置", subOff: "点一下可以重新开启", body: "提前 10 分钟开始慢慢变亮，到时间房间的灯会打开。", wake: "起床", dep: "出发", fl: "航班", gap: "{M} 分钟", edit: "更改时间", offB: "不使用", onB: "还是要用", save: "设为这个时间", q: ["30 分钟前", "45 分钟前", "60 分钟前", "90 分钟前"], tooEarly: "不能早于出发前 2 小时", tooLate: "不能晚于出发前 10 分钟", saved: "✓ 已改为 {W}", offT: "✓ 已关闭", onT: "✓ 已重新开启", err: "没能保存，请再试一次。", mT: "明天早上用灯光叫醒您", mS: "接送 {D} 出发\n提前 10 分钟开始慢慢变亮", ok: "好的，晚安" },
  ko: { on: "내일 아침 {W}　빛 알람 ON", off: "빛 알람 OFF", sub: "송영 {D} 출발에 맞춰 자동 설정", subOff: "누르면 다시 켤 수 있어요", body: "10분 전부터 조금씩 밝아지고, 시간이 되면 방의 불이 켜져요.", wake: "기상", dep: "출발", fl: "항공편", gap: "{M}분", edit: "시간 변경", offB: "사용 안 함", onB: "다시 사용", save: "이 시간으로", q: ["30분 전", "45분 전", "60분 전", "90분 전"], tooEarly: "출발 2시간 전보다 이를 수 없어요", tooLate: "출발 10분 전보다 늦을 수 없어요", saved: "✓ {W}(으)로 변경했어요", offT: "✓ 껐어요", onT: "✓ 다시 켰어요", err: "저장하지 못했어요. 다시 시도해 주세요.", mT: "내일 아침, 빛으로 깨워 드릴게요", mS: "송영 {D} 출발\n10분 전부터 천천히 밝아져요", ok: "네, 안녕히 주무세요" },
};
export type WakeLang = keyof typeof WAKE_T;
export const wakeLang = (l: string): WakeLang => (l === "ja" || l === "zh" || l === "ko" ? l : l.startsWith("zh") ? "zh" : "en");

/** 画面に渡す状態 */
export interface WakeState { on: boolean; edited: boolean; wakeAt: string; departAt: string; flightAt: string | null; dest: string | null; terminal: string | null; minAt: string; maxAt: string }
