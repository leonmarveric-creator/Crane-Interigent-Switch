/**
 * スマートキー（エントランス）の純粋ロジック。DB・Next に依存しないのでテスト可能。
 */

export type KeyState = "verify" | "before" | "active" | "expired";

/** 本人確認は「チェックイン24時間前〜チェックアウト」まで受け付ける (開始前画面を出すため)。 */
export const VERIFY_EARLY_MS = 24 * 60 * 60 * 1000;
/** エントランスのセッションはチェックアウト後この時間まで残し、「期限切れ」画面を出す。 */
export const SESSION_GRACE_MS = 12 * 60 * 60 * 1000;

export interface CandidateReservation {
  id: string;
  room_id: string;
  assigned_room_id: string | null;
  unlock_pin: string | null;
  guest_name: string | null;
  entrance_name?: string | null;
  check_in: string;
  check_out: string;
  status: string;
}

/** 名前比較用に正規化: 小文字化・全角→半角・空白や記号を除去。 */
export function normalizeName(v: string | null | undefined): string {
  return String(v ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/(様|さま|さん|san)$/u, "")
    .replace(/[\s　・.,'’"\-_()（）]/g, "");
}

/** 入力名と予約名がゆるく一致するか (どちらかがもう一方を含む、または姓/名のどれかが一致)。 */
export function nameMatches(input: string, reserved: string | null | undefined): boolean {
  const a = normalizeName(input);
  const b = normalizeName(reserved);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = String(reserved ?? "").normalize("NFKC").toLowerCase().split(/[\s　,]+/).map(normalizeName).filter((t) => t.length >= 2);
  return tokens.some((t) => a.includes(t));
}

/** 予約が実際に泊まる物理部屋 (客室割り当てがあればそちら)。 */
export const effectiveRoomId = (r: Pick<CandidateReservation, "room_id" | "assigned_room_id">) =>
  r.assigned_room_id || r.room_id;

/**
 * 入力(名前 + 数字)に合う予約を選ぶ。
 *  - 対象棟の部屋に泊まる、active な予約
 *  - チェックイン24時間前〜チェックアウト前
 *  - unlock_pin (= 電話番号下4桁) が完全一致
 * 同じ数字の予約が複数あれば名前で絞る。絞れなければ AMBIGUOUS。
 */
export function pickReservation(
  candidates: CandidateReservation[],
  input: { name: string; digits: string },
  buildingRoomIds: string[],
  nowMs: number
): { ok: true; reservation: CandidateReservation } | { ok: false; error: "BAD_CODE" | "AMBIGUOUS" } {
  const digits = input.digits.replace(/\D/g, "");
  const inBuilding = new Set(buildingRoomIds);
  const hits = candidates.filter((r) =>
    r.status === "active" &&
    !!r.unlock_pin && r.unlock_pin === digits &&
    inBuilding.has(effectiveRoomId(r)) &&
    new Date(r.check_out).getTime() > nowMs &&
    new Date(r.check_in).getTime() - VERIFY_EARLY_MS <= nowMs
  );
  if (hits.length === 0) return { ok: false, error: "BAD_CODE" };
  if (hits.length === 1) return { ok: true, reservation: hits[0] };

  const byName = hits.filter((r) => nameMatches(input.name, r.guest_name) || nameMatches(input.name, r.entrance_name));
  if (byName.length === 1) return { ok: true, reservation: byName[0] };

  // 同じ部屋・同じ期間の重複 (iCal と手動の二重登録など) は実質同一ゲストなので、今滞在中のものを優先
  const staying = hits.filter((r) => new Date(r.check_in).getTime() <= nowMs);
  const rooms = new Set(hits.map(effectiveRoomId));
  if (rooms.size === 1) return { ok: true, reservation: (staying[0] ?? hits[0]) };
  return { ok: false, error: "AMBIGUOUS" };
}

/** 画面の状態 (予約の期間と現在時刻から)。 */
export function keyStateFor(r: { check_in: string; check_out: string; status: string } | null, nowMs: number): KeyState {
  if (!r || r.status !== "active") return "verify";
  if (nowMs >= new Date(r.check_out).getTime()) return "expired";
  if (nowMs < new Date(r.check_in).getTime()) return "before";
  return "active";
}

/** 予約番号の表示用 (UUID先頭8桁を大文字)。 */
export const reservationCode = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

/* ---------------- 設定 (クライアントでも使う型と既定値) ---------------- */
export interface SmartKeySettings {
  app_unlock_enabled: boolean;
  hold_ms: number;
  countdown_sec: number;
  show_lock_now: boolean;
  show_keypad_code: boolean;
  show_wifi: boolean;
  show_support: boolean;
}

export const DEFAULT_SMARTKEY_SETTINGS: SmartKeySettings = {
  app_unlock_enabled: true,
  hold_ms: 1200,
  countdown_sec: 8,
  show_lock_now: true,
  show_keypad_code: true,
  show_wifi: true,
  show_support: true,
};

export function sanitizeSettings(v: Partial<SmartKeySettings> | null | undefined): SmartKeySettings {
  const d = DEFAULT_SMARTKEY_SETTINGS;
  const num = (x: unknown, lo: number, hi: number, def: number) => {
    const n = Math.round(Number(x));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const bool = (x: unknown, def: boolean) => (typeof x === "boolean" ? x : def);
  return {
    app_unlock_enabled: bool(v?.app_unlock_enabled, d.app_unlock_enabled),
    hold_ms: num(v?.hold_ms, 500, 3000, d.hold_ms),
    countdown_sec: num(v?.countdown_sec, 3, 60, d.countdown_sec),
    show_lock_now: bool(v?.show_lock_now, d.show_lock_now),
    show_keypad_code: bool(v?.show_keypad_code, d.show_keypad_code),
    show_wifi: bool(v?.show_wifi, d.show_wifi),
    show_support: bool(v?.show_support, d.show_support),
  };
}

/** ゲスト鍵画面に渡すデータ (秘密情報は含めない)。 */
export interface GuestKeyData {
  entranceSlug: string;
  entranceName: string;
  building: string;
  guestName: string;
  roomName: string | null;
  roomSlug: string | null;
  roomHasLock: boolean;
  checkIn: string | null;
  checkOut: string | null;
  reservationCode: string | null;
  keypadCode: string | null;
  wifiSsid: string | null;
  wifiPassword: string | null;
  supportUrl: string | null;
}

/** 1分あたりの操作上限 (連打・自動化対策)。 */
export const CMD_LIMIT_PER_MIN = 10;
