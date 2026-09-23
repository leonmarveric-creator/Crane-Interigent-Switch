import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseAdmin";
import { verifySession, roomCookieName } from "./roomSession";
import { withEffectiveTimes, isStayingAt, STAY_SHIFT_WINDOW_MS, isMissingColumn } from "./stayTimes";

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

  // 早期チェックイン / レイトチェックアウトを考慮するため、少し広めに取ってから時刻で絞る
  const now = Date.now();
  const base = "id, room_id, guest_lang, check_in, check_out, unlock_pin, welcomed_at";
  const query = (cols: string) => supabaseAdmin
    .from("reservations")
    .select(cols)
    .eq("status", "active")
    .lte("check_in", new Date(now + STAY_SHIFT_WINDOW_MS).toISOString())
    .gt("check_out", new Date(now - STAY_SHIFT_WINDOW_MS).toISOString())
    // 「物理的にこの部屋にいる予約」を対象にする:
    //   1) この部屋へ割り当て済み(assigned_room_id = この部屋)
    //   2) 未割り当て(assigned_room_id is null)で、元の部屋がこの部屋
    //   ※割り当てが一切無ければ 2) だけになり、従来と同じ挙動。
    .or(`assigned_room_id.eq.${room.id},and(assigned_room_id.is.null,room_id.eq.${room.id})`);
  let res: any = await query(`${base}, early_checkin_at, late_checkout_at`);
  if (isMissingColumn(res.error)) res = await query(base); // migration_staff.sql 未実行でも動く
  const reservations: StayReservation[] = ((res.data ?? []) as any[])
    .filter((r) => isStayingAt(r, now))
    .map((r) => withEffectiveTimes(r)) // 以降の check_in / check_out は「実際に使える時間」
    .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()); // 直近チェックインを優先

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
