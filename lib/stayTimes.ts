/**
 * 早期チェックイン / レイトチェックアウトを反映した「実際に使える時間」。
 * 依存なしの純粋関数 (テスト可能)。
 */
export interface StayTimes {
  check_in: string;
  check_out: string;
  early_checkin_at?: string | null;
  late_checkout_at?: string | null;
}

export const effectiveIn = (r: StayTimes): string => r.early_checkin_at || r.check_in;
export const effectiveOut = (r: StayTimes): string => r.late_checkout_at || r.check_out;

/** check_in / check_out を「実際に使える時間」に置き換えた予約を返す (元の値は orig_* に残す)。 */
export function withEffectiveTimes<T extends StayTimes>(r: T): T & { orig_check_in: string; orig_check_out: string } {
  return { ...r, orig_check_in: r.check_in, orig_check_out: r.check_out, check_in: effectiveIn(r), check_out: effectiveOut(r) };
}

export const isStayingAt = (r: StayTimes, nowMs: number) =>
  new Date(effectiveIn(r)).getTime() <= nowMs && nowMs < new Date(effectiveOut(r)).getTime();

/** 検索の余裕 (早期/レイトは最大でもこの範囲内でしか動かさない) */
export const STAY_SHIFT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/** 列が未作成 (migration_staff.sql 未実行) のエラーか */
export const isMissingColumn = (err: any) =>
  !!err && (err.code === "42703" || /column .* does not exist/i.test(String(err.message ?? "")));
