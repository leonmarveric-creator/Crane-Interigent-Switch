import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseAdmin";
import { verifySession, roomCookieName } from "./roomSession";

export interface ActiveStay {
  reservation: {
    id: string;
    room_id: string;
    guest_lang: string;
    check_in: string;
    check_out: string;
    unlock_pin: string | null;
  };
  room: any; // 秘密鍵を含む。サーバ内でのみ使用。
}

/**
 * 部屋slugから「今アクティブな滞在」を取得 (トークン不要・時刻で判定)。
 * 無効・予約なし・期間外なら null。
 */
export async function getActiveStay(roomSlug: string): Promise<ActiveStay | null> {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("slug", roomSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!room) return null;

  const nowIso = new Date().toISOString();
  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, guest_lang, check_in, check_out, unlock_pin")
    .eq("room_id", room.id)
    .eq("status", "active")
    .lte("check_in", nowIso)
    .gt("check_out", nowIso)
    .maybeSingle();
  if (!reservation) return null;

  return { room, reservation };
}

/** Cookieのセッションが現在の滞在と一致するか確認。デバイス/アラームAPIで使用。 */
export async function authorizeRoomRequest(roomSlug: string): Promise<ActiveStay | null> {
  const stay = await getActiveStay(roomSlug);
  if (!stay) return null;

  const token = cookies().get(roomCookieName(roomSlug))?.value;
  const v = verifySession(token);
  if (!v || v.reservationId !== stay.reservation.id) return null;
  return stay;
}

/** ページ表示時に「PIN認証済みか」を判定 (Cookie検証)。 */
export function hasValidSession(roomSlug: string, reservationId: string): boolean {
  const token = cookies().get(roomCookieName(roomSlug))?.value;
  const v = verifySession(token);
  return !!v && v.reservationId === reservationId;
}
