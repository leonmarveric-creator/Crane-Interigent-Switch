import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseAdmin";
import { verifyScopedSession } from "./roomSession";
import {
  DEFAULT_SMARTKEY_SETTINGS, sanitizeSettings, keyStateFor, reservationCode,
  type SmartKeySettings, type GuestKeyData, type KeyState,
} from "./smartkeyLogic";

/**
 * スマートキー（メインエントランス）のサーバ専用ヘルパ。
 * Sesame の秘密鍵はここから外へ出さない。
 */

export const ENTRANCE_SCOPE = "entrance";
export const entranceCookieName = (slug: string) => `ek_${slug}`;

/** 設定を取得 (テーブル未作成・取得失敗時は既定値)。 */
export async function getSmartKeySettings(): Promise<SmartKeySettings> {
  try {
    const { data, error } = await supabaseAdmin.from("smartkey_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return { ...DEFAULT_SMARTKEY_SETTINGS };
    return sanitizeSettings(data);
  } catch {
    return { ...DEFAULT_SMARTKEY_SETTINGS };
  }
}

/** アプリ解錠が緊急停止中か。 */
export async function isAppUnlockStopped(): Promise<boolean> {
  const s = await getSmartKeySettings();
  return !s.app_unlock_enabled;
}

export async function getEntranceBySlug(slug: string): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from("entrances").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  return data ?? null;
}

/** エントランス Sesame の資格情報 (API キーは未入力なら環境変数)。未設定なら null。 */
export function entranceCreds(e: any): { deviceUuid: string; secretKey: string; apiKey: string } | null {
  const apiKey = e?.sesame_api_key || process.env.SESAME_API_KEY || "";
  if (!e?.sesame_device_uuid || !e?.sesame_secret_key || !apiKey) return null;
  return { deviceUuid: e.sesame_device_uuid, secretKey: e.sesame_secret_key, apiKey };
}

/** 棟に属する部屋 (秘密鍵込み・サーバ専用)。 */
export async function getBuildingRooms(building: string): Promise<any[]> {
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("building", building).eq("is_active", true);
  return data ?? [];
}

export async function logEntrance(entry: {
  entrance_id: string | null; room_id?: string | null; reservation_id?: string | null;
  guest_name?: string | null; action: string; source?: "guest" | "admin"; success: boolean;
}) {
  try { await supabaseAdmin.from("entrance_logs").insert({ source: "guest", ...entry }); } catch { /* ignore */ }
}

export interface GuestKeyContext {
  entrance: any;
  settings: SmartKeySettings;
  state: KeyState;
  reservation: any | null; // 本人確認済みの予約
  room: any | null;        // 実際に泊まる部屋 (秘密鍵込み)
  data: GuestKeyData;      // クライアントへ渡してよい情報
}

/**
 * エントランスのゲスト状態を解決する。
 *  Cookie(ek_<slug>) → 予約 → 棟の部屋か確認 → 状態(開始前/利用中/期限切れ)。
 * 無効なら state="verify"(本人確認画面)。
 */
export async function resolveGuestKey(slug: string): Promise<GuestKeyContext | null> {
  const entrance = await getEntranceBySlug(slug);
  if (!entrance) return null;
  const settings = await getSmartKeySettings();

  const base: GuestKeyData = {
    entranceSlug: entrance.slug,
    entranceName: entrance.display_name,
    building: entrance.building,
    guestName: "",
    roomName: null, roomSlug: null, roomHasLock: false,
    checkIn: null, checkOut: null, reservationCode: null,
    keypadCode: null, wifiSsid: null, wifiPassword: null, supportUrl: entrance.support_url ?? null,
  };

  const v = verifyScopedSession(ENTRANCE_SCOPE, cookies().get(entranceCookieName(slug))?.value);
  if (!v) return { entrance, settings, state: "verify", reservation: null, room: null, data: base };

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, assigned_room_id, status, check_in, check_out, guest_name, entrance_name, welcomed_at, guest_lang")
    .eq("id", v.reservationId)
    .maybeSingle();
  if (!reservation) return { entrance, settings, state: "verify", reservation: null, room: null, data: base };

  const roomId = reservation.assigned_room_id || reservation.room_id;
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  // 別の棟の予約になっていたら (客室割り当ての変更など) 本人確認からやり直し
  if (!room || (room.building || "Crane Nest") !== entrance.building) {
    return { entrance, settings, state: "verify", reservation: null, room: null, data: base };
  }

  const state = keyStateFor(reservation, Date.now());
  const showSecrets = state === "active" || state === "before";
  return {
    entrance, settings, state, reservation, room,
    data: {
      ...base,
      guestName: reservation.entrance_name || reservation.guest_name || "",
      roomName: room.display_name,
      roomSlug: room.slug,
      roomHasLock: !!(room.sesame_device_uuid && room.sesame_secret_key && room.sesame_api_key),
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      reservationCode: reservationCode(reservation.id),
      // 暗証番号・Wi-Fi は利用中(と開始前)のゲストにだけ渡す
      keypadCode: showSecrets && settings.show_keypad_code ? entrance.keypad_code ?? null : null,
      wifiSsid: showSecrets && settings.show_wifi ? entrance.wifi_ssid ?? null : null,
      wifiPassword: showSecrets && settings.show_wifi ? entrance.wifi_password ?? null : null,
    },
  };
}

/** 直近1分の操作回数 (連打対策)。 */
export async function recentCommandCount(reservationId: string): Promise<number> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("entrance_logs")
    .select("id", { count: "exact", head: true })
    .eq("reservation_id", reservationId)
    .in("action", ["unlock", "lock", "room_unlock", "room_lock"])
    .gte("created_at", since);
  return count ?? 0;
}
