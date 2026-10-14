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
export const HOLO_JS = "/cabin/holo/holo.js?v=2b0d4af5e1";
/** 建物の模型があるお部屋 (Crane Nest の 春・夏・秋・冬) */
export const HOLO_ROOMS = ["haru", "natsu", "aki", "fuyu"] as const;
export type HoloRoom = (typeof HOLO_ROOMS)[number];
/** 演出の長さ (ミリ秒)。これより長く続いたら止める */
export const HOLO_LEN_MS = 47000;
/** 自動で出すのは、送迎が始まってからこれだけたったあと (あいさつ・お部屋の準備のセリフ・コンシェルジュの QR を先に) */
export const HOLO_AUTO_AFTER_MS = 150000;
/** 到着までこれより短いときは出さない (演出の途中で着いてしまう) */
export const HOLO_MIN_ETA_MIN = 3;
/** 次の観光案内の場所がこれより近いときは出さない (案内の声と重なる) */
export const HOLO_POI_GAP_M = 1500;

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

export interface HoloScene {
  dir: "in" | "out"; arrived: boolean; offroute: boolean;
  /** 送迎が始まってからの時間 (ミリ秒) */
  elapsedMs: number;
  /** 到着までの分 (分からなければ null) */
  etaMin: number | null;
  /** BOOST (準備・本番・ワープ) の途中 */
  boosting: boolean;
  /** 声が出ている・待っている (道案内・ASTRAEA) */
  voiceBusy: boolean;
  /** ガイド・チェックイン・QR・曲の全画面などが前に出ている */
  overlay: boolean;
  /** 次の観光案内までの距離 (m)。無ければ null */
  nextPoiM: number | null;
}
/** 今、自動でホログラムを出してよいか */
export function holoQuiet(s: HoloScene): boolean {
  if (s.dir !== "in" || s.arrived || s.boosting || s.voiceBusy || s.overlay) return false;
  if (s.elapsedMs < HOLO_AUTO_AFTER_MS) return false;
  if (s.etaMin != null && s.etaMin < HOLO_MIN_ETA_MIN) return false;
  if (s.nextPoiM != null && s.nextPoiM < HOLO_POI_GAP_M) return false;
  return true;
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
