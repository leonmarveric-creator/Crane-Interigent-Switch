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
export const LOCK_MODES = ["timer", "sensor", "off"] as const;
export type LockMode = (typeof LOCK_MODES)[number];
const isLockMode = (v: unknown): v is LockMode => LOCK_MODES.includes(v as LockMode);
export interface SmartKeySettings {
  app_unlock_enabled: boolean;
  hold_ms: number;
  /** 解錠後の施錠方法 (ドアごと)
   *  timer  = ◯秒後に自動施錠 (カウントダウン表示)
   *  sensor = ドアを閉めると自動施錠 (Sesame のオープンセンサー)
   *  off    = 自動施錠しない (ゲストが「施錠する」で閉める) */
  entrance_lock: LockMode;
  room_lock: LockMode;
  countdown_sec: number;
  show_lock_now: boolean;
  show_keypad_code: boolean;
  show_wifi: boolean;
  show_support: boolean;
}

export const DEFAULT_SMARTKEY_SETTINGS: SmartKeySettings = {
  app_unlock_enabled: true,
  hold_ms: 1200,
  entrance_lock: "timer",
  room_lock: "timer",
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
    entrance_lock: isLockMode(v?.entrance_lock) ? v!.entrance_lock : d.entrance_lock,
    room_lock: isLockMode(v?.room_lock) ? v!.room_lock : d.room_lock,
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
  /** エントランスに位置制限がある (近くにいるときだけ解錠できる) */
  geofence: boolean;
}

/** 1分あたりの操作上限 (連打・自動化対策)。 */
export const CMD_LIMIT_PER_MIN = 10;

/* ---------------- エントランスの位置制限 ---------------- */
export const DEFAULT_GEOFENCE_M = 100;
/** GPS の誤差として大目に見る最大距離 (m) */
export const GEO_ACCURACY_SLACK_M = 50;
/** これより誤差が大きい位置は判定に使わない (iPhone の「正確な位置情報」OFF など) */
export const GEO_MAX_ACCURACY_M = 500;

/** 2点間の距離 (m)。 */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** エントランスに位置制限が設定されているか。 */
export function hasGeofence(e: { lat?: unknown; lng?: unknown } | null | undefined): boolean {
  return num(e?.lat) !== null && num(e?.lng) !== null;
}

export type GeoError = "GEO_REQUIRED" | "GEO_IMPRECISE" | "GEO_FAR";
/**
 * ゲストの現在地がエントランスの近くか判定する。
 *  pos が無い → GEO_REQUIRED / 誤差が大きすぎる → GEO_IMPRECISE / 遠い → GEO_FAR (distance 付き)
 */
export function checkGeofence(
  e: { lat?: unknown; lng?: unknown; geofence_radius_m?: unknown },
  pos: { lat?: unknown; lng?: unknown; acc?: unknown } | null | undefined,
): { ok: true; distance: number | null } | { ok: false; error: GeoError; distance?: number } {
  const eLat = num(e.lat), eLng = num(e.lng);
  if (eLat === null || eLng === null) return { ok: true, distance: null };
  const lat = num(pos?.lat), lng = num(pos?.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "GEO_REQUIRED" };
  const acc = Math.max(0, num(pos?.acc) ?? 0);
  if (acc > GEO_MAX_ACCURACY_M) return { ok: false, error: "GEO_IMPRECISE" };
  const radius = num(e.geofence_radius_m) ?? DEFAULT_GEOFENCE_M;
  const d = distanceM(eLat, eLng, lat, lng);
  if (d - Math.min(acc, GEO_ACCURACY_SLACK_M) > radius) return { ok: false, error: "GEO_FAR", distance: Math.round(d) };
  return { ok: true, distance: Math.round(d) };
}
