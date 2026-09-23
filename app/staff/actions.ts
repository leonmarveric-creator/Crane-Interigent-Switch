"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffAuth";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { planEarlyCheckin, planLateCheckout, type StaffRes } from "@/lib/staffLogic";
import { STAY_SHIFT_WINDOW_MS } from "@/lib/stayTimes";

type Res = { ok: boolean; error?: string; conflictAt?: string; conflictName?: string | null };

/** 同じ部屋の前後の予約 (重なりチェック用)。 */
async function loadNeighbors(r: any): Promise<StaffRes[]> {
  const roomId = r.assigned_room_id || r.room_id;
  const from = new Date(new Date(r.check_in).getTime() - 3 * 86400e3).toISOString();
  const to = new Date(new Date(r.check_out).getTime() + 3 * 86400e3).toISOString();
  const { data } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, assigned_room_id, guest_name, entrance_name, guest_lang, unlock_pin, status, check_in, check_out, early_checkin_at, late_checkout_at")
    .neq("status", "cancelled")
    .lt("check_in", to).gt("check_out", from)
    .or(`assigned_room_id.eq.${roomId},and(assigned_room_id.is.null,room_id.eq.${roomId})`);
  return (data ?? []).map(toStaffRes);
}

function toStaffRes(r: any): StaffRes {
  return {
    id: r.id, room_id: r.assigned_room_id || r.room_id,
    guest_name: r.entrance_name || r.guest_name || null, lang: r.guest_lang || "en", pin: r.unlock_pin ?? null,
    status: r.status, check_in: r.check_in, check_out: r.check_out,
    early_checkin_at: r.early_checkin_at ?? null, late_checkout_at: r.late_checkout_at ?? null,
  };
}

async function getRes(id: string) {
  const { data, error } = await supabaseAdmin.from("reservations").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  return { data };
}

/** 早期チェックイン (hhmm=null で取り消し)。 */
export async function setEarlyCheckin(id: string, hhmm: string | null): Promise<Res> {
  requireStaff();
  const g = await getRes(id);
  if (!g.data) return { ok: false, error: g.error ?? "NOT_FOUND" };
  let early: string | null = null;
  if (hhmm) {
    const all = await loadNeighbors(g.data);
    const p = planEarlyCheckin(toStaffRes(g.data), hhmm, all);
    if (!p.ok) return { ok: false, error: p.error, conflictAt: p.conflict?.late_checkout_at || p.conflict?.check_out, conflictName: p.conflict?.guest_name };
    // 早めすぎ防止 (検索範囲の外に出ないように)
    if (new Date(g.data.check_in).getTime() - new Date(p.at).getTime() > STAY_SHIFT_WINDOW_MS) return { ok: false, error: "BAD_TIME" };
    early = p.at;
  }
  const { error } = await supabaseAdmin.from("reservations").update({ early_checkin_at: early }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

/** レイトチェックアウト (hhmm=null で取り消し)。 */
export async function setLateCheckout(id: string, hhmm: string | null): Promise<Res> {
  requireStaff();
  const g = await getRes(id);
  if (!g.data) return { ok: false, error: g.error ?? "NOT_FOUND" };
  let late: string | null = null;
  if (hhmm) {
    const all = await loadNeighbors(g.data);
    const p = planLateCheckout(toStaffRes(g.data), hhmm, all);
    if (!p.ok) return { ok: false, error: p.error, conflictAt: p.conflict?.early_checkin_at || p.conflict?.check_in, conflictName: p.conflict?.guest_name };
    if (new Date(p.at).getTime() - new Date(g.data.check_out).getTime() > STAY_SHIFT_WINDOW_MS) return { ok: false, error: "BAD_TIME" };
    late = p.at;
  }
  const upd: Record<string, unknown> = { late_checkout_at: late };
  // チェックアウト後の自動処理で completed になっていたら、延長時は active に戻す
  if (late && g.data.status === "completed" && new Date(late).getTime() > Date.now()) upd.status = "active";
  const { error } = await supabaseAdmin.from("reservations").update(upd).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

/** 清掃完了: エアコン・照明などを全部OFF → 施錠 → 清掃完了時刻を記録。 */
export async function markCleaned(roomId: string): Promise<Res> {
  requireStaff();
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "NO_ROOM" };
  const off = await executeDeviceAction(room, "away", "Staff Clean");
  await logDevice({ room_id: room.id, action: "away", source: "admin", success: off.ok });
  let lockOk = true;
  if (room.sesame_device_uuid && room.sesame_secret_key && room.sesame_api_key) {
    const l = await executeDeviceAction(room, "lock", "Staff Clean");
    lockOk = l.ok;
    await logDevice({ room_id: room.id, action: "lock", source: "admin", success: l.ok });
  }
  const { error } = await supabaseAdmin.from("rooms").update({ cleaned_at: new Date().toISOString() }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  // 家電や鍵が失敗しても清掃完了は記録する (画面で知らせる)
  return { ok: true, error: !off.ok || !lockOk ? "DEVICE_PARTIAL" : undefined };
}

/** 清掃完了の取り消し (押し間違い用)。 */
export async function undoCleaned(roomId: string): Promise<Res> {
  requireStaff();
  const { error } = await supabaseAdmin.from("rooms").update({ cleaned_at: null }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

/** 部屋の鍵を開ける / 閉める (清掃のため)。 */
export async function roomDoor(roomId: string, action: "unlock" | "lock"): Promise<Res> {
  requireStaff();
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "NO_ROOM" };
  const r = await executeDeviceAction(room, action, "Staff");
  await logDevice({ room_id: room.id, action, source: "admin", success: r.ok });
  return { ok: r.ok, error: r.ok ? undefined : (r.error ?? "DEVICE_ERROR") };
}

/** 部屋の電気: on = メイン照明ON (なければ和風ライト) / off = ライト系をすべてOFF (エアコンはそのまま)。 */
export async function roomLights(roomId: string, on: boolean): Promise<Res> {
  requireStaff();
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "NO_ROOM" };
  const action = on ? (room.switchbot_light_device_id ? "light_on" : "wafu_on_warm") : "good_night";
  const r = await executeDeviceAction(room, action, "Staff");
  await logDevice({ room_id: room.id, action, source: "admin", success: r.ok });
  return { ok: r.ok, error: r.ok ? undefined : (r.error ?? "DEVICE_ERROR") };
}

/** 部屋のシステムをすべてOFF (エアコン・照明・ギャラクシー・NEST・和風ライト) → 施錠。清掃記録は付けない。 */
export async function roomAllOff(roomId: string): Promise<Res> {
  requireStaff();
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "NO_ROOM" };
  const off = await executeDeviceAction(room, "away", "Staff");
  await logDevice({ room_id: room.id, action: "away", source: "admin", success: off.ok });
  let lockOk = true;
  if (room.sesame_device_uuid && room.sesame_secret_key && room.sesame_api_key) {
    const l = await executeDeviceAction(room, "lock", "Staff");
    lockOk = l.ok;
    await logDevice({ room_id: room.id, action: "lock", source: "admin", success: l.ok });
  }
  return { ok: off.ok && lockOk, error: off.ok && lockOk ? undefined : "DEVICE_PARTIAL" };
}
