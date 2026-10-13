/**
 * ゲスト乗車 (回送 → ゲスト) のときに、お部屋を自動で準備する。
 * - お迎え (宿へ向かう送迎) で、部屋が決まっているときだけ
 * - 1 回の送迎で 1 回だけ (回送 → ゲストに切り替わったときだけ)
 * - つけるのはエアコンだけ (ac_comfort)。明かりは着いて鍵を開けたときに、ゲストがコンシェルジュで選んだ明かりでつく (lib/arrivalLight.ts)
 * - 結果は cabin_trips.ai_cmd に残す → 車内 iPad の ASTRAEA が「お部屋の準備」を話す / お父さんのスマホに通知
 * スマホの「ゲスト乗車」ボタン (cabinBoard) と iPad の乗車ボタン (/api/cabin/state op=board) の両方から呼ぶ
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";

export interface RoomPrep { n: number; room: string; act: "ac_comfort"; ok: boolean }

export async function boardTrip(tripId: string): Promise<{ ok: true; prep: RoomPrep | null } | { ok: false; error: string }> {
  const { data: before } = await supabaseAdmin.from("cabin_trips").select("*").eq("id", tripId).eq("status", "active").maybeSingle();
  const { error } = await supabaseAdmin.from("cabin_trips").update({ phase: "guest", started_at: new Date().toISOString() }).eq("id", tripId).eq("status", "active");
  if (error) return { ok: false, error: /phase/.test(error.message) ? "SETUP" : error.message };
  if (!before || before.phase !== "dead" || before.direction !== "in" || !before.room_id) return { ok: true, prep: null };
  const prep = await prepareRoom(tripId, before.room_id).catch(() => null);
  return { ok: true, prep };
}

async function prepareRoom(tripId: string, roomId: string): Promise<RoomPrep | null> {
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return null;
  if (!room.switchbot_ac_device_id) return null;
  const act = "ac_comfort" as const;
  const r = await executeDeviceAction(room, act, "Cabin boarding").catch(() => ({ ok: false }));
  await logDevice({ room_id: room.id, action: act, source: "admin", success: r.ok }).catch(() => {});
  const prep: RoomPrep = { n: Date.now(), room: String(room.display_name || room.name || room.slug || "").slice(0, 40), act, ok: !!r.ok };
  // iPad の ASTRAEA に「お部屋の準備」を話してもらう (auto = 乗車のあいさつのあとで)。migration がまだなら何もしない
  await supabaseAdmin.from("cabin_trips").update({ ai_cmd: { c: "room", n: prep.n, auto: 1, room: prep.room, act, ok: prep.ok } }).eq("id", tripId).then(() => null, () => null);
  return prep;
}

/** お父さんのスマホの「止める」: 自動でつけたエアコンを消す (鍵は触らない) */
export async function stopRoomPrep(tripId: string): Promise<boolean> {
  const { data: t } = await supabaseAdmin.from("cabin_trips").select("room_id").eq("id", tripId).maybeSingle();
  if (!t?.room_id) return false;
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", t.room_id).maybeSingle();
  if (!room) return false;
  const r = await executeDeviceAction(room, "ac_off", "Cabin boarding (stop)").catch(() => ({ ok: false }));
  await logDevice({ room_id: room.id, action: "ac_off", source: "admin", success: r.ok }).catch(() => {});
  return !!r.ok;
}

/** ai_cmd から自動準備の結果を読む (スマホの通知用) */
export function prepFromCmd(c: any): RoomPrep | null {
  if (!c || c.c !== "room" || !c.auto || typeof c.n !== "number") return null;
  return { n: c.n, room: String(c.room || ""), act: "ac_comfort", ok: !!c.ok };
}
