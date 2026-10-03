/**
 * 車内 iPad (/cabin) と お父さんのスマホ で共通の計算 (ブラウザ・サーバどちらでも動く)。
 *   ・お迎え / お見送りの場所 (関空T1・T2、りんくう2か所、日根野駅、その他)
 *   ・到着予想 (道路の時間 + 渋滞の余裕 3〜6分)
 *   ・ルート上のどこまで進んだか
 *   ・スカイゲートブリッジの BOOST (高速モード) の開始・終了
 */
export type LL = [number, number]; // [緯度, 経度]
export type PlaceKey = "kix" | "kix2" | "rinku" | "r833" | "hineno" | "other";
export type Dir = "in" | "out";
export type GLang = "ja" | "en" | "zh" | "ko";

/** Crane Nest (泉佐野市上之郷2056-20) */
export const CRANE_NEST: LL = [34.382973, 135.322586];

export const PLACES: Record<Exclude<PlaceKey, "other">, { ll: LL; name: Record<GLang, string> }> = {
  kix: { ll: [34.4352, 135.2437], name: { ja: "関西空港 T1", en: "KANSAI AIRPORT T1", zh: "关西机场 T1", ko: "간사이공항 T1" } },
  kix2: { ll: [34.438034, 135.229724], name: { ja: "関西空港 T2", en: "KANSAI AIRPORT T2", zh: "关西机场 T2", ko: "간사이공항 T2" } },
  rinku: { ll: [34.4106, 135.2974], name: { ja: "りんくうタウン駅", en: "RINKU TOWN STN", zh: "临空城站", ko: "린쿠타운역" } },
  r833: { ll: [34.410494, 135.300936], name: { ja: "りんくう往来北", en: "RINKU TOWN", zh: "临空城 往来北", ko: "린쿠타운" } },
  hineno: { ll: [34.391029, 135.331541], name: { ja: "日根野駅", en: "HINENO STN", zh: "日根野站", ko: "히네노역" } },
};
export const PLACE_KEYS: Exclude<PlaceKey, "other">[] = ["kix", "kix2", "rinku", "r833", "hineno"];

/** 到着予想の目安 (分)。道路の時間に 渋滞の余裕 3〜6分 を足したもの */
export const BASE_MIN: Record<string, number> = {
  kix_in: 20, kix_out: 19, kix2_in: 25, kix2_out: 25, rinku_in: 11, rinku_out: 10, r833_in: 9, r833_out: 9, hineno_in: 7, hineno_out: 7,
};
/** 渋滞の余裕 (距離に応じて 3〜6分) */
export const bufferMin = (km: number) => Math.min(6, Math.max(3, Math.round(3 + km / 5)));

/** 冷房 / 暖房 (日本時間の月: 5〜10月は冷房) */
export function acModeFor(ms: number): "cool" | "heat" {
  const mo = new Date(ms + 9 * 3600e3).getUTCMonth() + 1;
  return mo >= 5 && mo <= 10 ? "cool" : "heat";
}

/** 予約の「お迎え場所」の文字から場所を当てる (分からなければ null) */
export function placeFromText(text: string | null | undefined, terminal?: string | null): PlaceKey | null {
  const s = (text ?? "").toLowerCase().replace(/\s+/g, "");
  if (/1-?833|１－?８３３|往来北/.test(s)) return "r833";
  if (/りんくう|臨空|临空|rinku/.test(s)) return "rinku";
  if (/日根野|hineno/.test(s)) return "hineno";
  if (/関空|関西空港|関西国際|kix|kansai|机场|空港|airport|공항/.test(s) || terminal) {
    if (/t2|第2|第２|terminal2|2タ|二航站|第二/.test(s) || terminal === "2") return "kix2";
    return "kix";
  }
  return null;
}

/* ---------------- 距離・ルート ---------------- */
const R_EARTH = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
export function dist(a: LL, b: LL): number {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** 平面に近似 (この辺りの数 km なら十分) : [x(m), y(m)] */
function xy(p: LL, o: LL): [number, number] { return [rad(p[1] - o[1]) * R_EARTH * Math.cos(rad(o[0])), rad(p[0] - o[0]) * R_EARTH]; }

/** Google 形式の polyline を [経度, 緯度] の列に */
export function decodePolyline(s: string): [number, number][] {
  const pts: [number, number][] = []; let i = 0, lat = 0, lng = 0;
  while (i < s.length) {
    for (let k = 0; k < 2; k++) {
      let sh = 0, r = 0, b: number;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    pts.push([lng / 1e5, lat / 1e5]);
  }
  return pts;
}

export interface Route { pts: LL[]; cum: number[]; total: number }
/** [経度, 緯度] の列からルートを作る */
export function makeRoute(lonlat: [number, number][]): Route {
  const pts = lonlat.map(([x, y]) => [y, x] as LL);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, total: cum[cum.length - 1] || 1 };
}
/** d (m) 進んだところの位置 */
export function pointAt(r: Route, d: number): LL {
  let i = 1; while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.pts[i - 1], b = r.pts[i] ?? a, f = Math.min(1, Math.max(0, (d - r.cum[i - 1]) / ((r.cum[i] - r.cum[i - 1]) || 1)));
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
/**
 * 今の位置がルートのどこか: d = スタートからの距離 (m) / off = ルートからの離れ (m)。
 * prev (前回の d) があれば、その近く (後ろ 300m 〜 前 3km) を優先して、行きと帰りが重なる道で飛ばないようにする
 */
export function project(r: Route, p: LL, prev?: number): { d: number; off: number } {
  let best = { d: 0, off: Infinity, score: Infinity };
  for (let i = 1; i < r.pts.length; i++) {
    const a = xy(r.pts[i - 1], p), b = xy(r.pts[i], p);
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, -(a[0] * vx + a[1] * vy) / L2));
    const off = Math.hypot(a[0] + vx * t, a[1] + vy * t);
    const d = r.cum[i - 1] + (r.cum[i] - r.cum[i - 1]) * t;
    const jump = prev == null ? 0 : d < prev - 300 ? (prev - d) : d > prev + 3000 ? (d - prev - 3000) : 0;
    const score = off + jump * 0.5;
    if (score < best.score) best = { d, off, score };
  }
  return { d: best.d, off: best.off };
}
/** 到着予想 (分)。base = 余裕込みの目安、ルートの残りの割合で減らす */
export function etaMin(base: number, remM: number, totalM: number): number {
  return Math.max(0, Math.ceil(base * Math.max(0, remM) / (totalM || 1)));
}

/* ---------------- スカイゲートブリッジ BOOST ---------------- */
/** 橋の両端 (本土側 → 空港島側) */
export const BRIDGE: { m: LL; i: LL; len: number } = { m: [34.41475, 135.29395], i: [34.43725, 135.26445], len: 0 };
BRIDGE.len = dist(BRIDGE.m, BRIDGE.i);
/** 橋の線の上のどこか: t = 0 本土側 〜 1 空港島側 (範囲外もそのまま)、lat = 橋からの離れ (m) */
export function bridgePos(p: LL): { t: number; lat: number } {
  const b = xy(BRIDGE.i, BRIDGE.m), q = xy(p, BRIDGE.m);
  const L2 = b[0] * b[0] + b[1] * b[1];
  const t = (q[0] * b[0] + q[1] * b[1]) / L2;
  const lat = Math.abs(q[0] * b[1] - q[1] * b[0]) / Math.sqrt(L2);
  return { t, lat };
}
export interface BoostState { phase: "off" | "on" | "done"; lastT: number | null; dir: 1 | -1 | 0 }
export const BOOST_INIT: BoostState = { phase: "off", lastT: null, dir: 0 };
/** 起動する距離 (橋の入口の手前 m) と 速さ (km/h) */
export const BOOST_BEFORE_M = 300, BOOST_MIN_KMH = 50;
/**
 * 位置が来るたびに呼ぶ。event = "start" (起動) / "end" (渡り切った) / null
 *   起動: 橋の線から 120m 以内、入口の手前 300m〜入口、橋に向かって進んでいて、50km/h 以上
 *   終了: 反対側の端を越えた / 橋から 300m 以上離れた。終わったら 1.5km 離れるまで次は起動しない
 */
export function boostStep(s: BoostState, p: LL, kmh: number | null): { s: BoostState; event: "start" | "end" | null } {
  const { t, lat } = bridgePos(p);
  const pre = BOOST_BEFORE_M / BRIDGE.len;
  const moved = s.lastT == null ? 0 : t - s.lastT;
  const dir: 1 | -1 | 0 = Math.abs(moved) > 0.0004 ? (moved > 0 ? 1 : -1) : s.dir;
  const n: BoostState = { ...s, lastT: t, dir };
  if (s.phase === "off") {
    const fast = kmh == null || kmh >= BOOST_MIN_KMH;
    const nearM = t > -pre && t < 0.04 && dir === 1, nearI = t < 1 + pre && t > 0.96 && dir === -1;
    if (lat < 120 && fast && (nearM || nearI)) return { s: { ...n, phase: "on" }, event: "start" };
  } else if (s.phase === "on") {
    const passed = (s.dir === 1 && t > 1.01) || (s.dir === -1 && t < -0.01) || (s.dir === 0 && (t > 1.01 || t < -0.01));
    if (passed || lat > 300) return { s: { ...n, phase: "done" }, event: "end" };
  } else if (lat > 1500 || t < -0.5 || t > 1.5) {
    return { s: { ...n, phase: "off" }, event: null };
  }
  return { s: n, event: null };
}

/** BOOST の準備 (曲を止める → 準備のセリフ → 効果音 → 点火) を始める距離: 点火がだいたい橋の入口に来るように、速さから逆算する */
export const BOOST_PREP_MIN_M = 330, BOOST_PREP_MAX_M = 650, BOOST_PREP_LEAD_S = 16;
/** boostStep のあとに呼ぶ (s は boostStep が返したもの)。橋に向かっていて、十分速く、準備を始める距離に入ったら true */
export function boostPrepDue(s: BoostState, p: LL, kmh: number | null): boolean {
  if (s.phase !== "off" || s.dir === 0) return false;
  if (!(kmh == null || kmh >= BOOST_MIN_KMH)) return false;
  const { t, lat } = bridgePos(p); if (lat >= 120) return false;
  const before = (s.dir === 1 ? -t : t - 1) * BRIDGE.len; // 入口までの残り (m)
  const need = Math.min(BOOST_PREP_MAX_M, Math.max(BOOST_PREP_MIN_M, ((kmh ?? 60) / 3.6) * BOOST_PREP_LEAD_S));
  return before > 0 && before <= need;
}

/* ---------------- 観光案内 ---------------- */
export type PoiKey = "bridge" | "rinku" | "izumi";
export const POIS: Record<PoiKey, LL> = { bridge: [34.4260, 135.2792], rinku: [34.4107, 135.2976], izumi: [34.3990, 135.3120] };
/** そのルートで案内する場所 (ルートから 500m 以内を通るもの。お見送りでは「泉佐野へようこそ」は言わない) */
export function poisFor(r: Route, dir: Dir): PoiKey[] {
  return (Object.keys(POIS) as PoiKey[]).filter((k) => {
    if (dir === "out" && k === "izumi") return false;
    return project(r, POIS[k]).off < (k === "rinku" ? 900 : 500);
  });
}
