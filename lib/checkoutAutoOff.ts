/**
 * チェックアウトボタンが押されなかった部屋を、チェックアウト時刻のあとで自動 OFF にする (外出と同じ: エアコン + 照明 + ギャラクシー + NEST + 和風ライト)。
 *   wake-alarm の Cron (1〜2 分毎) から呼ぶ。
 *   - 実際のチェックアウト時刻 (レイトチェックアウトがあればそちら) を過ぎてから 6 時間後までの間に 1 回だけ
 *   - ゲストがボタンを押していれば何もしない (押したときに OFF 済み)
 *   - その部屋に次のゲストがもう滞在中 (アーリーチェックイン) なら何もしない
 *   - チェックアウトのあとに、その部屋で「次のゲストの準備」(乗車時のエアコン・ウェルカム) が始まっていれば何もしない
 *   - 予約に auto_off_at を記録 (二重に動かない)。列が無い (migration_ac_climate.sql 未実行) ときは何もしない
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { effectiveOut, isStayingAt } from "@/lib/stayTimes";

export const AUTO_OFF_GRACE_MS = 0; // チェックアウト時刻になったらすぐ (Cron は 1 分ごと)
const AUTO_OFF_WINDOW_MS = 6 * 60 * 60 * 1000;
const PREP_ACTIONS = ["ac_comfort", "welcome", "welcome_cozy", "ac_on"];

/** 純粋関数 (テスト用): この予約を今、自動 OFF にしてよいか */
export function autoOffDue(r: { check_out: string; late_checkout_at?: string | null; guest_checkout_at?: string | null; auto_off_at?: string | null; status?: string | null }, nowMs: number): boolean {
  if (r.guest_checkout_at || r.auto_off_at || r.status === "cancelled") return false;
  const out = new Date(effectiveOut(r as any)).getTime();
  if (!Number.isFinite(out)) return false;
  return nowMs >= out + AUTO_OFF_GRACE_MS && nowMs < out + AUTO_OFF_WINDOW_MS;
}

export async function runCheckoutAutoOff(nowMs = Date.now()): Promise<{ done: number; skipped: number } | null> {
  const from = new Date(nowMs - AUTO_OFF_WINDOW_MS - 2 * 24 * 3600 * 1000).toISOString(), to = new Date(nowMs).toISOString();
  const { data, error } = await supabaseAdmin.from("reservations")
    .select("id, room_id, assigned_room_id, check_in, check_out, early_checkin_at, late_checkout_at, guest_checkout_at, auto_off_at, status")
    .neq("status", "cancelled").gte("check_out", from).lte("check_out", new Date(nowMs + 2 * 24 * 3600 * 1000).toISOString());
  if (error) return null; // 列がまだ無い → 何もしない (毎分 OFF を送らないように)
  void to;
  const all = (data ?? []) as any[];
  let done = 0, skipped = 0;
  for (const r of all.filter((x) => autoOffDue(x, nowMs))) {
    const roomId = r.assigned_room_id || r.room_id;
    const outIso = effectiveOut(r);
    // 次のゲストがもう滞在中
    const next = all.find((x) => x.id !== r.id && (x.assigned_room_id || x.room_id) === roomId && isStayingAt(x, nowMs));
    // チェックアウトのあとに、この部屋で次のゲストの準備が始まっている
    const { data: prep } = await supabaseAdmin.from("device_logs").select("id").eq("room_id", roomId).in("action", PREP_ACTIONS).gte("created_at", outIso).limit(1);
    // 先に記録 (失敗したら動かさない → 毎分送り続けない)
    const mark = await supabaseAdmin.from("reservations").update({ auto_off_at: new Date(nowMs).toISOString() }).eq("id", r.id).is("auto_off_at", null).select("id");
    if (mark.error || !(mark.data ?? []).length) continue;
    if (next || (prep ?? []).length) { skipped++; continue; }
    const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room) continue;
    const p = await executeDeviceAction(room, "away", `AutoCheckout:${String(r.id).slice(0, 8)}`).catch(() => ({ ok: false }));
    await logDevice({ room_id: roomId, reservation_id: r.id, action: "auto_checkout_off", source: "cron", success: !!p.ok });
    done++;
  }
  return { done, skipped };
}
