import { supabaseAdmin } from "./supabaseAdmin";

export interface ValidatedStay {
  reservation: {
    id: string;
    room_id: string;
    guest_lang: string;
    check_in: string;
    check_out: string;
  };
  room: any; // 秘密鍵を含む。サーバ内でのみ使用。
}

/**
 * room slug + guest_token + 現在時刻 を照合して、有効な滞在のみ通す。
 * 無効なら null を返す (期間外 / トークン不一致 / cancelled / 部屋停止)。
 */
export async function validateStay(
  roomSlug: string,
  token: string | null | undefined
): Promise<ValidatedStay | null> {
  if (!token) return null;

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
    .select("id, room_id, guest_lang, check_in, check_out")
    .eq("room_id", room.id)
    .eq("guest_token", token)
    .eq("status", "active")
    .lte("check_in", nowIso)
    .gt("check_out", nowIso)
    .maybeSingle();
  if (!reservation) return null;

  return { reservation, room };
}
