/**
 * 車内 iPad のホログラム演出 (HIROSHI DRIVE・お迎えのとき)。決まりごとだけ (画面や音は components/cabin/cabinHolo.ts)。
 *   - 建物 (Crane Nest) を投影 → フロアを分ける → ゲストのお部屋に照準 → ルート → お部屋の設備 → WELCOME (約 46 秒)
 *   - 地図の枠の上にだけ出す。右側 (天気・お部屋・コンシェルジュの QR) はそのまま見える
 *   - 声と効果音は、ほかの声と同じ道でお父さんの iPhone から流す (iPhone が来ていなければ iPad から)
 *   - 自動で出すのは 1 回の送迎で 1 回だけ。ほかの演出 (乗車のあいさつ・QR・観光案内・BOOST・到着) と重ならない「静かなとき」だけ
 *   - 途中で観光案内・BOOST・到着・お父さんの指示が来たら、すぐにやめてそちらを優先する
 */
export const HOLO_PAGE = "/cabin/holo/index.html";
/** public/cabin/holo/index.html が読み込む JS (中身を作り直したら v を合わせる) */
export const HOLO_JS = "/cabin/holo/holo.js?v=674f4f0643";
/** ホログラムの画質: std = 標準 (iPad) / lite = 軽量 / ul = 超軽量 (画質 0.6 倍・30 コマ・にじみ無し。スマホの最初の値) */
export type HoloQ = "std" | "lite" | "ul";
export const HOLO_Q_KEY = "drvHoloQ";
export const isHoloQ = (v: unknown): v is HoloQ => v === "std" || v === "lite" || v === "ul";
/** 建物の模型があるお部屋 (Crane Nest の 春・夏・秋・冬) */
export const HOLO_ROOMS = ["haru", "natsu", "aki", "fuyu"] as const;
export type HoloRoom = (typeof HOLO_ROOMS)[number];
/** 演出の長さ (ミリ秒)。これより長く続いたら止める */
export const HOLO_LEN_MS = 47000;
/** お部屋紹介のホログラムは、ゲストが乗って (お迎えの送迎が始まって) この秒数のあと (乗車のあいさつが終わってから) */
export const HOLO_AFTER_S = 9;
/* 自動で出すタイミング: 「着くちょうど前に終わる」ように、残りの時間 (残りの道のり ÷ 最近の速さ) から逆算して始める。
   毎回のお迎えで 1 回。始める少し前から ASTRAEA の雑談を止めて、声が重ならないようにする */
/** 演出が終わってから到着の画面・声までの間 (秒) */
export const HOLO_END_GAP_S = 6;
/** 到着のホログラム (お見送り・お迎え先) を、着く何秒前に始めるか (演出の本編 ≒ 85 秒。最後のひとことが着いたころに終わる) */
export const AIR_LEAD_S = 85;
/** 始めてよい時間の幅 (秒): 「残り = 演出の長さ + すき間」より少し早くてもよい / 遅れてもよい */
export const HOLO_EARLY_S = 4, HOLO_LATE_S = 15;
/** この秒数前から ASTRAEA の雑談 (AI のひと言) を止めておく */
export const HOLO_HUSH_S = 25;
/** 着いたときに演出の残りがこれ以下なら、最後まで見せてから到着の画面にする (秒) */
export const HOLO_FINISH_S = 14;
/** 残りの時間 (秒) の見積もり。速さは最近の平均 (止まっている・速すぎるときは 15〜60 km/h に丸める) */
export function holoRemainS(remM: number, avgKmh: number): number { return remM / (Math.max(15, Math.min(60, avgKmh)) / 3.6); }
/** 今始めると、ちょうど着く前に終わるか ("now") / まだ早い ("wait") / もう間に合わない ("late") */
export function holoWindow(remainS: number): "wait" | "now" | "late" {
  const need = HOLO_LEN_MS / 1000 + HOLO_END_GAP_S;
  return remainS > need + HOLO_EARLY_S ? "wait" : remainS < need - HOLO_LATE_S ? "late" : "now";
}

const VOICES = ["boot", "scan", "orbit", "explode", "f_haru", "f_natsu", "f_aki", "f_fuyu", "r1", "r2", "room_cool", "room_heat", "room_none", "welcome"];
const SFX = ["boot", "scan", "split", "lock", "route", "room", "welcome"];
/** 声・効果音 (iPad と iPhone に先に保存する) */
export const HOLO_AUDIO = [...VOICES.map((k) => `/cabin/audio/holo/${k}.mp3`), ...SFX.map((k) => `/cabin/audio/holo/sfx-${k}.mp3`)];
/** ホログラムのページから来てよい音の名前 (それ以外は鳴らさない) */
export const isHoloVoice = (k: unknown): k is string => typeof k === "string" && VOICES.some((v) => k === "holo/" + v);
export const isHoloSfx = (k: unknown): k is string => typeof k === "string" && SFX.some((v) => k === "holo/sfx-" + v);

/** このお部屋はホログラムを出せるか (Crane Nest の季節のお部屋だけ) → 模型の部屋の名前 */
export function holoRoomOf(room: { en?: string | null; building?: string | null } | null | undefined): HoloRoom | null {
  if (!room?.en) return null;
  if (room.building && !/crane/i.test(room.building)) return null;
  const k = room.en.trim().toLowerCase();
  return (HOLO_ROOMS as readonly string[]).includes(k) ? (k as HoloRoom) : null;
}

/* ---------- コンシェルジュの入口: 4 桁が合ったあとの短いホログラム (public/holo/intro.html・約 11 秒) ---------- */
/** intro.js を作り直したら v を合わせる (public/holo/intro.html と同じ) */
export const INTRO_JS = "/holo/intro.js?v=12cf7c14ae";
export const INTRO_PAGE = "/holo/intro.html";
/** 演出に出すお名前 (ご予約のお名前の最初の 1 語。漢字などはそのまま 12 文字まで)。無ければ null */
export function introName(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").replace(/[<>&"]/g, "").trim();
  if (!s) return null;
  if (/^[\x20-\x7e\u00c0-\u024f]+$/.test(s)) { const w = s.split(/\s+/)[0]; return w.length >= 2 ? w.slice(0, 16) : null; }
  return s.replace(/\s+/g, " ").slice(0, 12);
}
