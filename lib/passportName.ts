/**
 * パスポート登録 (Crane Nest のシステム) の名前を、こちらの予約 (reservations.guest_name) に書き戻す。
 *   Airbnb の iCal には名前が無いので、ゲストの名前はチェックイン (パスポート登録) で初めてわかる。
 *   エントランスでは名前を聞かない → 登録が済んだら、ここで名前を入れる。
 *   すでに guest_name がある予約 (手動登録など) は上書きしない。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCraneNestDrops, craneNestOn } from "@/lib/craneNest";
import { toCabinRoom } from "@/lib/cabinData";

export interface NameTarget {
  id: string;
  guestName: string | null;
  roomKanji: string | null;
  checkOut: string;
  token: string | null;
}

/** 名前が空の予約に、パスポートの名前 (代表者) を入れる。返り値: 予約 ID → 入れた名前 */
export async function fillPassportNames(targets: NameTarget[]): Promise<Record<string, string>> {
  const need = targets.filter((t) => !String(t.guestName ?? "").trim());
  if (!need.length || !craneNestOn()) return {};
  const drops = await loadCraneNestDrops(need.map((t) => ({ id: t.id, roomKanji: t.roomKanji, checkOut: t.checkOut, token: t.token })))
    .catch(() => ({} as Record<string, { names: string[] }>));
  const out: Record<string, string> = {};
  await Promise.all(need.map(async (t) => {
    const name = String(drops[t.id]?.names?.[0] ?? "").trim().slice(0, 60);
    if (!name) return;
    // 同時に別の処理が名前を入れていたら上書きしない
    const { error } = await supabaseAdmin.from("reservations").update({ guest_name: name }).eq("id", t.id).is("guest_name", null);
    if (!error) out[t.id] = name;
  }));
  return out;
}

/** 1 件分 (エントランス・お部屋の画面用)。予約の行と部屋の行から呼ぶ。 */
export async function passportNameFor(reservation: any, room: any): Promise<string | null> {
  if (!reservation || String(reservation.guest_name ?? "").trim()) return null;
  const r = await fillPassportNames([{
    id: reservation.id, guestName: reservation.guest_name ?? null,
    roomKanji: room ? toCabinRoom(room).kanji : null,
    checkOut: reservation.check_out, token: reservation.guest_token ?? null,
  }]).catch(() => ({} as Record<string, string>));
  return r[reservation.id] ?? null;
}

/** Cron 用: 前後 2 日の予約で名前が空のものをまとめて埋める。返り値: 入れた件数 */
export async function backfillPassportNames(nowMs = Date.now()): Promise<number> {
  if (!craneNestOn()) return 0;
  const { data, error } = await supabaseAdmin.from("reservations")
    .select("id, room_id, assigned_room_id, guest_name, check_out, guest_token")
    .eq("status", "active").is("guest_name", null)
    .gt("check_out", new Date(nowMs - 86400e3).toISOString())
    .lt("check_in", new Date(nowMs + 2 * 86400e3).toISOString());
  if (error || !data?.length) return 0;
  const { data: rooms } = await supabaseAdmin.from("rooms").select("*");
  const kanji = new Map(((rooms ?? []) as any[]).map((r) => [r.id, toCabinRoom(r).kanji]));
  const filled = await fillPassportNames((data as any[]).map((r) => ({
    id: r.id, guestName: r.guest_name, roomKanji: kanji.get(r.assigned_room_id || r.room_id) ?? null,
    checkOut: r.check_out, token: r.guest_token ?? null,
  })));
  return Object.keys(filled).length;
}
