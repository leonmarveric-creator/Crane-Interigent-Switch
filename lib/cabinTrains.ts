/**
 * 車内 iPad: お見送りで駅へ向かうときの「電車の案内」(ゲストが電車に乗る参考)。
 *   駅の時刻表 (発車時刻・種別・行き先) から、次の電車と「今ごろここ」(時刻表上の予定の位置) を出す。
 *   ※ 本当の走行位置ではない (JR 西日本・南海とも外から使える位置データが無い)。遅れは反映されない。
 *   時刻表は公式の時刻表から登録する。登録していない駅は出さない (うその時刻をゲストに見せない)。
 */
import type { GLang } from "@/lib/cabinGeo";

export type TrainOp = "jr" | "nk";
/** 発車: [時刻 "HH:MM", 種別, 行き先, この駅が始発なら 1] */
export type Dep = [string, string, string, 1?];
export interface TrainDir {
  id: string;
  lab: Record<GLang, string>;
  /** 路線図の駅 (進む向きに並べる) と、この駅の位置 */
  strip: string[]; here: number;
  /** 隣の駅までの分 (strip の順に。strip.length - 1 個) */
  run: number[];
  /** 平日 / 土休日 */
  wk: Dep[]; hol: Dep[];
}
export interface TrainStation { key: string; op: TrainOp; name: string; dirs: TrainDir[]; sample?: boolean }

/* ---------- 名前 (ja / zh / en / ko) ---------- */
const N: Record<string, [string, string, string, string]> = {
  関西空港: ["関西空港", "关西机场", "Kansai Airport", "간사이공항"], りんくうタウン: ["りんくうタウン", "临空城", "Rinku Town", "린쿠타운"], 日根野: ["日根野", "日根野", "Hineno", "히네노"],
  熊取: ["熊取", "熊取", "Kumatori", "구마토리"], 東佐野: ["東佐野", "东佐野", "Higashi-Sano", "히가시사노"], 和泉橋本: ["和泉橋本", "和泉桥本", "Izumi-Hashimoto", "이즈미하시모토"], 東貝塚: ["東貝塚", "东贝冢", "Higashi-Kaizuka", "히가시카이즈카"],
  長滝: ["長滝", "长泷", "Nagataki", "나가타키"], 新家: ["新家", "新家", "Shinge", "신게"], 和泉砂川: ["和泉砂川", "和泉砂川", "Izumi-Sunagawa", "이즈미스나가와"],
  泉佐野: ["泉佐野", "泉佐野", "Izumisano", "이즈미사노"], 井原里: ["井原里", "井原里", "Iharanosato", "이하라노사토"], 鶴原: ["鶴原", "鹤原", "Tsuruhara", "쓰루하라"], 羽倉崎: ["羽倉崎", "羽仓崎", "Hagurazaki", "하구라자키"], 吉見ノ里: ["吉見ノ里", "吉见之里", "Yoshiminosato", "요시미노사토"], 貝塚: ["貝塚", "贝冢", "Kaizuka", "가이즈카"],
  大阪: ["大阪", "大阪", "Osaka", "오사카"], 天王寺: ["天王寺", "天王寺", "Tennoji", "덴노지"], 京都: ["京都", "京都", "Kyoto", "교토"], 和歌山: ["和歌山", "和歌山", "Wakayama", "와카야마"], なんば: ["なんば", "难波", "Namba", "난바"], 和歌山市: ["和歌山市", "和歌山市", "Wakayamashi", "와카야마시"],
};
const LI: Record<GLang, number> = { ja: 0, zh: 1, en: 2, ko: 3 };
export const stName = (k: string, l: GLang) => (N[k] ?? [k, k, k, k])[LI[l]];
/** 種別 (色・名前) */
export const TRAIN_TYPES: Record<string, { c: string; n: [string, string, string, string] }> = {
  kk: { c: "#1a8cff", n: ["関空・紀州路快速", "关空·纪州路快速", "Airport / Kishuji Rapid", "간쿠·기슈지 쾌속"] },
  kq: { c: "#1a8cff", n: ["関空快速", "关空快速", "Kansai Airport Rapid", "간쿠 쾌속"] },
  kr: { c: "#f39800", n: ["紀州路快速", "纪州路快速", "Kishuji Rapid", "기슈지 쾌속"] },
  hr: { c: "#4d7cff", n: ["特急はるか", "特急HARUKA", "Ltd. Exp. HARUKA", "특급 하루카"] },
  lc: { c: "#7c8aa0", n: ["普通", "普通", "Local", "보통"] },
  ap: { c: "#e4007f", n: ["空港急行", "机场急行", "Airport Express", "공항 급행"] },
  rp: { c: "#3b6fd6", n: ["特急ラピート", "特急Rapi:t", "Ltd. Exp. Rapi:t", "특급 라피트"] },
  ex: { c: "#e0452f", n: ["急行", "急行", "Express", "급행"] },
  nl: { c: "#7c8aa0", n: ["普通", "普通", "Local", "보통"] },
};
export const typeName = (t: string, l: GLang) => (TRAIN_TYPES[t]?.n ?? [t, t, t, t])[LI[l]];
export const OP_NAME: Record<TrainOp, Record<GLang, string>> = { jr: { ja: "JR", zh: "JR", en: "JR", ko: "JR" }, nk: { ja: "南海", zh: "南海", en: "Nankai", ko: "난카이" } };

/* ---------- 時刻表 ---------- */
/**
 * 本番の時刻表 (公式の時刻表から登録する)。空のうちは、ゲストの画面に電車の案内は出ない。
 *   例: hineno: { key: "hineno", op: "jr", name: "日根野", dirs: [{ id: "up", lab: {...}, strip: [...], here: 1, run: [...], wk: [["05:12", "lc", "天王寺"], ...], hol: [...] }] }
 */
export const TRAIN_TIMETABLE: Record<string, TrainStation[]> = {};

/** サンプル (仮の時刻)。見本の画面だけで使う。本番のゲストの画面には出さない */
export function sampleStations(): Record<string, TrainStation[]> {
  const gen = (types: [string, string, number, number, 1?][]): Dep[] => { // [種別, 行き先, 何分ごと, 最初の分, 始発]
    const out: Dep[] = [];
    for (const [t, to, every, off, orig] of types) for (let m = 5 * 60 + off; m < 24 * 60; m += every) out.push([`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, t, to, orig]);
    return out.sort((a, b) => a[0].localeCompare(b[0]));
  };
  const L = (ja: string, zh: string, en: string, ko: string) => ({ ja, zh, en, ko });
  const d = (id: string, lab: Record<GLang, string>, strip: string[], here: number, run: number[], types: [string, string, number, number, 1?][]): TrainDir => ({ id, lab, strip, here, run, wk: gen(types), hol: gen(types) });
  const hineno: TrainStation = { key: "hineno", op: "jr", name: "日根野", sample: true, dirs: [
    d("up", L("天王寺・大阪方面", "天王寺·大阪方向", "Tennoji / Osaka", "덴노지·오사카 방면"), ["りんくうタウン", "日根野", "熊取", "東佐野", "和泉橋本"], 1, [6, 3, 2, 3], [["kk", "大阪", 15, 8], ["lc", "天王寺", 15, 12, 1]]),
    d("ap", L("関西空港方面", "关西机场方向", "Kansai Airport", "간사이공항 방면"), ["東佐野", "熊取", "日根野", "りんくうタウン", "関西空港"], 2, [2, 3, 5, 6], [["kq", "関西空港", 15, 5]]),
  ] };
  const rinkuJr: TrainStation = { key: "rinku_jr", op: "jr", name: "りんくうタウン", sample: true, dirs: [
    d("up", L("天王寺・大阪方面", "天王寺·大阪方向", "Tennoji / Osaka", "덴노지·오사카 방면"), ["関西空港", "りんくうタウン", "日根野", "熊取"], 1, [6, 6, 3], [["kk", "大阪", 15, 2], ["hr", "京都", 30, 16]]),
    d("ap", L("関西空港方面", "关西机场方向", "Kansai Airport", "간사이공항 방면"), ["熊取", "日根野", "りんくうタウン", "関西空港"], 2, [3, 5, 6], [["kq", "関西空港", 15, 11], ["hr", "関西空港", 30, 24]]),
  ] };
  const rinkuNk: TrainStation = { key: "rinku_nk", op: "nk", name: "りんくうタウン", sample: true, dirs: [
    d("up", L("なんば方面", "难波方向", "Namba", "난바 방면"), ["関西空港", "りんくうタウン", "泉佐野", "井原里", "鶴原"], 1, [6, 3, 2, 2], [["ap", "なんば", 15, 5], ["rp", "なんば", 30, 20]]),
    d("ap", L("関西空港方面", "关西机场方向", "Kansai Airport", "간사이공항 방면"), ["鶴原", "井原里", "泉佐野", "りんくうタウン", "関西空港"], 3, [2, 2, 3, 6], [["ap", "関西空港", 15, 12], ["rp", "関西空港", 30, 27]]),
  ] };
  const sano: TrainStation = { key: "sano_nk", op: "nk", name: "泉佐野", sample: true, dirs: [
    d("up", L("なんば方面", "难波方向", "Namba", "난바 방면"), ["りんくうタウン", "泉佐野", "井原里", "鶴原", "貝塚"], 1, [3, 2, 2, 3], [["ap", "なんば", 15, 11], ["nl", "なんば", 15, 3, 1]]),
    d("ap", L("関西空港方面", "关西机场方向", "Kansai Airport", "간사이공항 방면"), ["鶴原", "井原里", "泉佐野", "りんくうタウン", "関西空港"], 2, [2, 2, 3, 6], [["ap", "関西空港", 15, 4]]),
    d("wk", L("和歌山市方面", "和歌山市方向", "Wakayamashi", "와카야마시 방면"), ["井原里", "泉佐野", "羽倉崎", "吉見ノ里"], 1, [2, 3, 3], [["ex", "和歌山市", 30, 17]]),
  ] };
  return { hineno: [hineno], rinku: [rinkuJr, rinkuNk], r833: [rinkuJr, rinkuNk], sano: [sano] };
}

/** 送り先 → 案内する駅 (りんくうタウンは JR と南海の両方)。泉佐野駅は「その他」で名前から */
export function stationsFor(placeKey: string, placeName: string | null, table: Record<string, TrainStation[]> = TRAIN_TIMETABLE): TrainStation[] {
  const k = placeKey === "other" && /泉佐野駅|izumisano st/i.test(placeName || "") ? "sano" : placeKey;
  return (table[k] ?? []).filter((s) => s.dirs.some((d) => d.wk.length || d.hol.length));
}

/* ---------- 次の電車・今ごろここ ---------- */
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
export interface NextTrain { st: TrainStation; dir: TrainDir; dep: number; type: string; to: string; orig: boolean }
/** 日本時間の今 (0 時からの分) と、土休日か */
export function jstNow(ms: number) { const d = new Date(ms + 9 * 3600e3); return { min: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60, hol: d.getUTCDay() === 0 || d.getUTCDay() === 6 }; }
/** これから出る電車 (全部の方面を時刻順に) */
export function nextTrains(sts: TrainStation[], nowMin: number, hol: boolean, n = 4): NextTrain[] {
  const out: NextTrain[] = [];
  for (const st of sts) for (const dir of st.dirs) for (const [t, ty, to, o] of hol ? dir.hol : dir.wk) { const m = toMin(t); if (m >= nowMin - 0.3) out.push({ st, dir, dep: m, type: ty, to, orig: !!o }); }
  return out.sort((a, b) => a.dep - b.dep).slice(0, n);
}
/** 時刻表上の位置: strip の何番目 (小数 = 駅と駅の間)。まだ路線図に入っていなければ null */
export function schedPos(dir: TrainDir, dep: number, orig: boolean, nowMin: number): number | null {
  const DW = 0.5; // 停車
  // この駅の発車から前後の駅の時刻を作る
  const at: number[] = []; at[dir.here] = dep;
  for (let i = dir.here - 1; i >= 0; i--) at[i] = at[i + 1] - DW - dir.run[i];
  for (let i = dir.here + 1; i < dir.strip.length; i++) at[i] = at[i - 1] + dir.run[i - 1] + DW;
  const first = orig ? dir.here : 0;
  if (nowMin < at[first] - (orig ? 4 : 0) || nowMin > at[dir.strip.length - 1]) return null;
  if (nowMin <= at[first]) return first;
  for (let i = first; i < dir.strip.length - 1; i++) {
    const leave = at[i], arr = at[i + 1] - DW;
    if (nowMin >= leave && nowMin < arr) return i + (nowMin - leave) / (arr - leave);
    if (nowMin >= arr && nowMin < at[i + 1]) return i + 1;
  }
  return dir.strip.length - 1;
}
