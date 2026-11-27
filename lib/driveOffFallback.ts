/**
 * お見送りの「出発後の自動 OFF」の控え (サーバー側)。
 * お父さんのスマホは、家から 200 m 離れたら部屋を全部 OFF にする (DriverCabin の autoOff)。
 * ただ、スマホの画面が消えていた・別のアプリを開いていた (GPS が止まる) と、200 m を見逃すことがある。
 * そこで送迎を終えたとき (スマホの「終了」/ 車内画面の終了) に、もう一度だけ確かめる:
 *   - お見送り (out) で、その予約が「今日チェックアウト」
 *   - その部屋の「送迎で自動OFF」「外出」「チェックアウト」がまだ成功していない (6 時間以内)
 *   - 次のゲストがもう滞在中ではない
 *   → 外出 (エアコン + 照明 + ギャラクシー + NEST + 和風ライト) を送って、履歴に「🚗 送迎で自動OFF」を残す
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { effectiveOut, isStayingAt } from "@/lib/stayTimes";

const jstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export async function driveOffFallback(tripId: string): Promise<boolean | null> {
  try {
    const { data: t } = await supabaseAdmin.from("cabin_trips").select("direction, reservation_id").eq("id", tripId).maybeSingle();
    if (!t || t.direction !== "out" || !t.reservation_id) return null;
    const { data: r } = await supabaseAdmin.from("reservations")
      .select("id, room_id, assigned_room_id, check_in, check_out, early_checkin_at, late_checkout_at, status").eq("id", t.reservation_id).maybeSingle();
    if (!r || r.status === "cancelled") return null;
    const outMs = new Date(effectiveOut(r as any)).getTime();
    if (!Number.isFinite(outMs) || jstDay(outMs) !== jstDay(Date.now())) return null; // 今日チェックアウトの予約だけ
    const roomId = r.assigned_room_id || r.room_id; if (!roomId) return null;
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    const { data: done } = await supabaseAdmin.from("device_logs").select("id").eq("room_id", roomId)
      .in("action", ["drive_off", "away", "auto_checkout_off"]).eq("success", true).gte("created_at", since).limit(1);
    if ((done ?? []).length) return null; // もう OFF にできている
    // 次のゲストがもう滞在中 (アーリーチェックイン) なら触らない
    const { data: others } = await supabaseAdmin.from("reservations")
      .select("id, room_id, assigned_room_id, check_in, check_out, early_checkin_at, late_checkout_at, status")
      .neq("status", "cancelled").neq("id", r.id).or(`room_id.eq.${roomId},assigned_room_id.eq.${roomId}`)
      .gte("check_out", new Date(Date.now() - 2 * 24 * 3600e3).toISOString()).lte("check_in", new Date(Date.now() + 2 * 24 * 3600e3).toISOString());
    if ((others ?? []).some((x: any) => (x.assigned_room_id || x.room_id) === roomId && isStayingAt(x, Date.now()))) return null;
    const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room) return null;
    const p = await executeDeviceAction(room, "away", "Drive off (trip end)").catch(() => ({ ok: false }));
    await logDevice({ room_id: roomId, reservation_id: r.id, action: "drive_off", source: "cron", success: !!p.ok });
    return !!p.ok;
  } catch { return null; }
}
