// =========================================================
// し尿タンク（便槽）モニタリング — 共有ロジック
//   型定義・定数・純粋な計算関数のみを置く。
//   Node固有APIに依存しないため、クライアント/サーバの両方から import 可能。
//   （通知やDBアクセスは tankAlerts.ts / tankStore.ts 側に分離している）
// =========================================================

// ---- 既定値（実測ベース。あとから管理画面/DBで上書き可能） ----
//   Crane Nest の便槽 実測:
//     ・実質容量 ≈ 300L
//     ・匂いが出始める ≈ 270L（≈90%）
//     ・夏(6〜9月)は匂いが出やすいので早めに警告する
//   → 匂い(270L)の手前で汲み取りを手配できるよう、警告ラインを下に置く。
export const TANK_DEFAULTS = {
  capacityLiters: 300, // 実質タンク容量 L（実測）
  litersPerGuestPerDay: 3.0, // 簡易水洗トイレ 1人1泊あたりの使用量 L（尿＋便＋流し水の目安。実データで較正推奨）
  smellPct: 0.9, // 👃 匂いが出始める実測ライン（≈270L / 300L）
  // 通常期
  cautionPct: 0.7, // 🟡 注意（≈210L）
  alertPct: 0.8, // 🔴 警告＝汲み取り手配（≈240L・匂いの手前）
  // 夏(6〜9月)は匂いが出やすいので早めに
  summerCautionPct: 0.6, // 🟡 夏の注意（≈180L）
  summerAlertPct: 0.7, // 🔴 夏の警告（≈210L）
  summerMonths: [6, 7, 8, 9],
} as const;

export type TankStatus = "safe" | "caution" | "alert";

// ---- 季節（匂いが出やすい夏）判定 ----
//   便槽の「今月」は日本時間(JST)基準で判定する。
const TANK_JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export function jstMonth(now: Date = new Date()): number {
  return new Date(now.getTime() + TANK_JST_OFFSET_MS).getUTCMonth() + 1;
}
export function isOdorSeason(now: Date = new Date()): boolean {
  return (TANK_DEFAULTS.summerMonths as readonly number[]).includes(jstMonth(now));
}
// その時期に適用される警告/注意しきい値（%）
export function effectiveAlertPct(now: Date = new Date()): number {
  return isOdorSeason(now) ? TANK_DEFAULTS.summerAlertPct : TANK_DEFAULTS.alertPct;
}
export function effectiveCautionPct(now: Date = new Date()): number {
  return isOdorSeason(now) ? TANK_DEFAULTS.summerCautionPct : TANK_DEFAULTS.cautionPct;
}

// その日の宿泊ログ
export interface DailyLog {
  date: string; // YYYY-MM-DD
  guests: number; // 宿泊人数
  liters: number; // guests * litersPerGuestPerDay（保存時点の値）
  overridden?: boolean; // true: 予約自動値ではなくスタッフ手動補正が適用されている
}

// タンクの現在状態（GET /api/stays/tank のレスポンス本体）
export interface TankState {
  capacityLiters: number;
  litersPerGuestPerDay: number;
  currentLiters: number; // 前回汲み取り以降の累積水量
  lastEmptiedDate: string; // 前回汲み取り日 YYYY-MM-DD
  logs: DailyLog[]; // 前回汲み取り以降のログ（新しい順）
  alerted: boolean; // 警告通知を既に送ったか（多重通知の抑制）
  updatedAt: string; // ISO 8601
}

// ---- 予約（宿泊）→ 夜次の人数展開 ----
//   「予約リストから自動計算」の中核。予約イベントごとに水量を足し込むのではなく、
//   毎回この関数で「実際に泊まった夜の人数」を再計算するため、
//   キャンセルは自動的に除外され、未来の予約は現在の水量を膨らませない。

// 計算対象に含める予約ステータス（cancelled / pending は除外）
//   Switch本体の予約(public.reservations)は 'active' / 'completed' を使い、
//   Airbnb取り込み(stays_ext_reservations)は 'confirmed' を使うため、両方を許容する。
export const COUNTED_STATUSES = ["confirmed", "completed", "active"] as const;

// tank計算に必要な最小限の予約情報（Booking の部分集合）
export interface ReservationLite {
  check_in: string; // YYYY-MM-DD（チェックイン＝最初の宿泊夜）
  check_out: string; // YYYY-MM-DD（チェックアウト＝この夜は泊まらない）
  guests: number; // 宿泊人数
  status: string; // confirmed / completed / cancelled / pending ...
}

// 日付文字列(YYYY-MM-DD)に n 日加算
export function addDaysStr(dateStr: string, n: number): string {
  const dt = new Date(dateStr + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// 予約が占有する「宿泊夜」の配列 [check_in, check_out)。
// 例: 8/1 IN 〜 8/3 OUT → 泊まる夜は 8/1, 8/2（8/3は泊まらない）。
export function eachNight(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  let d = checkIn;
  // 不正データ(逆転)や無限ループ防止に上限を設ける
  let guard = 0;
  while (d < checkOut && guard < 3660) {
    out.push(d);
    d = addDaysStr(d, 1);
    guard++;
  }
  return out;
}

// 予約リストを日ごとの宿泊人数に集約する。
//   - COUNTED_STATUSES 以外（キャンセル・保留）は無視
//   - [fromInclusive, toExclusive) の範囲の夜だけを対象
//     （tank現在値では from=前回汲み取り日 / to=今日 を渡し「過去の夜のみ」を数える）
//   - 同じ夜に複数予約（複数部屋）があれば合算
export function nightlyGuests(
  reservations: ReservationLite[],
  fromInclusive: string,
  toExclusive: string
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of reservations) {
    if (!(COUNTED_STATUSES as readonly string[]).includes(r.status)) continue;
    for (const night of eachNight(r.check_in, r.check_out)) {
      if (night >= fromInclusive && night < toExclusive) {
        map[night] = (map[night] || 0) + Math.max(0, Math.floor(r.guests || 0));
      }
    }
  }
  return map;
}

// 自動集計(auto)に手動補正(override)を重ねて、確定版の日次ログを作る。
//   override が指定された日付は、その値で auto を上書きする（スタッフの微調整）。
//   override 値が入っていない日付は auto をそのまま採用。
export function mergeNightly(
  auto: Record<string, number>,
  overrides: Record<string, number>,
  perGuest: number = TANK_DEFAULTS.litersPerGuestPerDay
): DailyLog[] {
  const dates = new Set<string>([...Object.keys(auto), ...Object.keys(overrides)]);
  const logs: DailyLog[] = [];
  for (const date of dates) {
    const overridden = date in overrides;
    const guests = overridden ? overrides[date] : auto[date] || 0;
    logs.push({ date, guests, liters: litersForGuests(guests, perGuest), overridden });
  }
  logs.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい順
  return logs;
}

// ---- 数値ユーティリティ ----

// 小数第1位で丸める（L表示のブレを防ぐ）
export function roundL(n: number): number {
  return Math.round(n * 10) / 10;
}

// 宿泊人数 → 加算される水量。0人の日は 0L（メーターは進まない）。
export function litersForGuests(
  guests: number,
  perGuest: number = TANK_DEFAULTS.litersPerGuestPerDay
): number {
  const g = Math.max(0, Math.floor(guests || 0));
  return roundL(g * perGuest);
}

// ログ配列から累積水量を再計算する（編集・訂正に強い設計）
export function sumLiters(logs: DailyLog[]): number {
  return roundL(logs.reduce((acc, l) => acc + (l.liters || 0), 0));
}

// 充填率（%）。オーバーフローも見えるよう上限は999%に緩める。
export function tankPct(currentLiters: number, capacityLiters: number): number {
  if (capacityLiters <= 0) return 0;
  return Math.min(999, Math.max(0, (currentLiters / capacityLiters) * 100));
}

// 警告ライン（L）。季節で変動（夏は早め）。既定300Lなら 通常240L / 夏210L。
export function alertLineLiters(
  capacityLiters: number,
  now: Date = new Date()
): number {
  return roundL(capacityLiters * effectiveAlertPct(now));
}

// 注意ライン（L）。既定300Lなら 通常210L / 夏180L。
export function cautionLineLiters(
  capacityLiters: number,
  now: Date = new Date()
): number {
  return roundL(capacityLiters * effectiveCautionPct(now));
}

// 匂いが出始める実測ライン（L）。既定300Lなら 270L。
export function smellLineLiters(capacityLiters: number): number {
  return roundL(capacityLiters * TANK_DEFAULTS.smellPct);
}

// 満杯までの残り猶予（L）。マイナスにはしない。
export function remainingLiters(currentLiters: number, capacityLiters: number): number {
  return roundL(Math.max(0, capacityLiters - currentLiters));
}

// 現在の状態区分を判定（季節で変動）
export function statusFor(
  currentLiters: number,
  capacityLiters: number,
  now: Date = new Date()
): TankStatus {
  if (capacityLiters <= 0) return "safe";
  const p = currentLiters / capacityLiters;
  if (p >= effectiveAlertPct(now)) return "alert";
  if (p >= effectiveCautionPct(now)) return "caution";
  return "safe";
}

// ある水量ライン(L)に達するまでの「残り人泊」。簡易水洗の1人あたり量で割る。
export function guestNightsToLiters(
  currentLiters: number,
  targetLiters: number,
  perGuest: number = TANK_DEFAULTS.litersPerGuestPerDay
): number {
  if (perGuest <= 0) return 0;
  return Math.max(0, Math.ceil((targetLiters - currentLiters) / perGuest));
}

// 直近ログの平均宿泊人数（予測日数の基礎値）。既定で直近7日分を見る。
export function recentAvgGuests(logs: DailyLog[], window = 7): number {
  if (!logs.length) return 0;
  const recent = logs.slice(0, window);
  const total = recent.reduce((acc, l) => acc + (l.guests || 0), 0);
  return total / recent.length;
}

// 目標ライン(既定=満杯)までの残り予測日数。宿泊が0（またはデータ無し）の場合は null。
//   targetLiters に警告ラインを渡せば「あと何日で警告か」を出せる。
export function forecastDays(
  currentLiters: number,
  capacityLiters: number,
  guestsPerDay: number,
  perGuest: number = TANK_DEFAULTS.litersPerGuestPerDay,
  targetLiters?: number
): number | null {
  const daily = guestsPerDay * perGuest;
  if (daily <= 0) return null;
  const target = typeof targetLiters === "number" ? targetLiters : capacityLiters;
  const remain = roundL(Math.max(0, target - currentLiters));
  return Math.floor(remain / daily);
}

// ---- ステータスの表示メタ（UIと通知文で共通利用） ----
export const STATUS_META: Record<
  TankStatus,
  { emoji: string; label: string; message: string }
> = {
  safe: {
    emoji: "🟢",
    label: "安全",
    message: "まだ余裕があります",
  },
  caution: {
    emoji: "🟡",
    label: "注意",
    message: "そろそろ汲み取りの準備をしてください",
  },
  alert: {
    emoji: "🔴",
    label: "警告",
    message: "【至急】バキュームカーを手配してください",
  },
};
