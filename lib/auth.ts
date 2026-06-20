import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseAdmin";
import { verifySession, roomCookieName } from "./roomSession";

export interface StayReservation {
  id: string;
  room_id: string;
  guest_lang: string;
  check_in: string;
  check_out: string;
  unlock_pin: string | null;
  welcomed_at: string | null;
}

export interface ActiveStay {
  reservation: StayReservation;
  room: any; // 秘密鍵を含む。サーバ内でのみ使用。
}

export interface ActiveStays {
  reservations: StayReservation[]; // 今の時刻に有効な予約 (通常1件、重複時は複数)
  room: any;
}

/**
 * 部屋slugから「今アクティブな滞在(複数可)」を取得 (トークン不要・時刻で判定)。
 * 期間が重なる予約が複数あってもエラーにならないよう配列で返す。
 */
export async function getActiveStays(roomSlug: string): Promise<ActiveStays | null> {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("slug", roomSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!room) return null;

  const nowIso = new Date().toISOString();
  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, guest_lang, check_in, check_out, unlock_pin, welcomed_at")
    .eq("room_id", room.id)
    .eq("status", "active")
    .lte("check_in", nowIso)
    .gt("check_out", nowIso)
    .order("check_in", { ascending: false }); // 直近チェックインを優先

  if (!reservations || reservations.length === 0) return null;
  return { room, reservations };
}

/** 代表1件のみ返す簡易版 (表示用)。 */
export async function getActiveStay(roomSlug: string): Promise<ActiveStay | null> {
  const stays = await getActiveStays(roomSlug);
  if (!stays) return null;
  return { room: stays.room, reservation: stays.reservations[0] };
}

/** Cookieのセッションが現在の有効滞在のいずれかと一致するか確認。 */
export async function authorizeRoomRequest(roomSlug: string): Promise<ActiveStay | null> {
  const stays = await getActiveStays(roomSlug);
  if (!stays) return null;

  const token = cookies().get(roomCookieName(roomSlug))?.value;
  const v = verifySession(token);
  if (!v) return null;
  const match = stays.reservations.find((r) => r.id === v.reservationId);
  if (!match) return null;
  return { room: stays.room, reservation: match };
}
