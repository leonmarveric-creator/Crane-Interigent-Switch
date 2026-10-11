/**
 * 早朝便の自動光目覚まし (サーバー側)。
 *   ・getWakeState: 画面に出す状態 (前の晩 20:00 〜 点灯まで)。出すときに、まだ無ければ自動でセットする
 *   ・setWake: ゲストの「使わない / やっぱり使う / 時間を変える」
 *   ・syncAutoWakes: Cron (wake-alarm) から。送迎の時刻が変わったら作り直す
 *   SQL (migration_wake_auto.sql) が無ければ何もしない。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCraneNestDrops, type CnDrop } from "@/lib/craneNest";
import { toCabinRoom } from "@/lib/cabinData";
import { getWafuAutoOffAtMs } from "@/lib/wakePrewake";
import { withEffectiveTimes } from "@/lib/stayTimes";
import { planWake, wakeFromHm, type WakePlan, type WakeState } from "@/lib/wakeAutoLogic";

const WINDOW_MS = 36 * 3600e3; // チェックアウトがこの時間内の予約だけ見る (送迎予約の読み込みを減らす)

/** 画面に出すのは夜 20:00 〜 朝 7:00 (日本時間) だけ。昼間はデータベースも見ずに終わる (通信を増やさない) */
export const inWakeHours = (nowMs: number) => { const h = new Date(nowMs + 9 * 3600e3).getUTCHours(); return h >= 20 || h < 7; };

async function loadRes(reservationId: string) {
  const { data, error } = await supabaseAdmin.from("reservations")
    .select("id, room_id, assigned_room_id, check_in, check_out, early_checkin_at, late_checkout_at, guest_token, guest_checkout_at, wake_auto_off, status")
    .eq("id", reservationId).maybeSingle();
  if (error || !data) return null; // 列が無い (SQL 未実行) ときも null
  return withEffectiveTimes(data as any) as any;
}

const alarmRow = (room: any, reservationId: string, ms: number, source: "auto" | "auto_edited") => {
  const mode = room?.switchbot_wafu_device_id ? "horizon_rise" : "flame_on";
  return {
    reservation_id: reservationId, room_id: room.id, fire_at: new Date(ms).toISOString(), is_enabled: true, wake_mode: mode, source,
    wafu_auto_off_at: mode === "horizon_rise" ? new Date(getWafuAutoOffAtMs(ms)).toISOString() : null,
  };
};

async function pendingAlarm(reservationId: string): Promise<{ id: string; fire_at: string; source: string } | null | "nosql"> {
  const { data, error } = await supabaseAdmin.from("alarms").select("id, fire_at, source").eq("reservation_id", reservationId).is("triggered_at", null).limit(1).maybeSingle();
  if (error) return "nosql";
  return (data as any) ?? null;
}

async function dropFor(r: any, room: any): Promise<CnDrop | null> {
  const d = await loadCraneNestDrops([{ id: r.id, roomKanji: room ? toCabinRoom(room).kanji : null, checkOut: r.check_out, token: r.guest_token ?? null }]).catch(() => ({} as Record<string, CnDrop>));
  return d[r.id] ?? null;
}

/** 画面に出す状態。出さないときは null */
export async function getWakeState(reservationId: string, room: any, nowMs = Date.now()): Promise<WakeState | null> {
  if (!inWakeHours(nowMs)) return null;
  try {
    const r = await loadRes(reservationId);
    if (!r || r.guest_checkout_at || r.status !== "active") return null;
    const out = Date.parse(r.check_out);
    if (!(out > nowMs && out - nowMs < WINDOW_MS)) return null;
    const drop = await dropFor(r, room);
    const plan = planWake(drop, r.check_out);
    if (!plan || nowMs < plan.showFromMs || nowMs >= plan.departMs) return null;
    const a0 = await pendingAlarm(r.id);
    if (a0 === "nosql") return null;
    let alarm: { id: string; fire_at: string; source: string } | null = a0;
    if (alarm && alarm.source === "guest") return null; // ゲストが自分で目覚ましを入れている
    const on = !r.wake_auto_off;
    if (on && !alarm && nowMs < plan.wakeMs) {
      // まだ Cron がセットしていなければ、ここでセット
      const { data } = await supabaseAdmin.from("alarms").insert(alarmRow(room, r.id, plan.wakeMs, "auto")).select("id, fire_at, source").maybeSingle();
      alarm = (data as any) ?? null;
    }
    if (!alarm && nowMs >= plan.wakeMs) return null; // もう点灯した
    return {
      on: on && !!alarm, edited: alarm?.source === "auto_edited",
      wakeAt: alarm ? alarm.fire_at : new Date(plan.wakeMs).toISOString(), departAt: new Date(plan.departMs).toISOString(),
      flightAt: plan.flightMs ? new Date(plan.flightMs).toISOString() : null, dest: drop?.dest ?? null, terminal: drop?.terminal ?? null,
      minAt: new Date(plan.minMs).toISOString(), maxAt: new Date(plan.maxMs).toISOString(),
    };
  } catch { return null; }
}

export type WakeAction = { action: "off" } | { action: "on" } | { action: "set"; time: string };

/** ゲストの操作。返り値は新しい状態 */
export async function setWake(reservationId: string, room: any, a: WakeAction, nowMs = Date.now()): Promise<{ ok: true; state: WakeState | null } | { ok: false; error: string }> {
  const r = await loadRes(reservationId);
  if (!r) return { ok: false, error: "SQL_NEEDED" };
  const drop = await dropFor(r, room);
  const plan: WakePlan | null = planWake(drop, r.check_out);
  if (!plan || nowMs >= plan.departMs) return { ok: false, error: "NO_PLAN" };
  const clearAuto = () => supabaseAdmin.from("alarms").delete().eq("reservation_id", r.id).is("triggered_at", null).in("source", ["auto", "auto_edited"]);
  if (a.action === "off") {
    await clearAuto();
    await supabaseAdmin.from("reservations").update({ wake_auto_off: true }).eq("id", r.id);
  } else {
    let ms = plan.wakeMs, source: "auto" | "auto_edited" = "auto";
    if (a.action === "set") {
      const t = wakeFromHm(String(a.time ?? ""), plan);
      if (t == null) return { ok: false, error: "BAD_TIME" };
      if (t < plan.minMs) return { ok: false, error: "TOO_EARLY" };
      if (t > plan.maxMs) return { ok: false, error: "TOO_LATE" };
      ms = t; source = "auto_edited";
    }
    if (ms <= nowMs) return { ok: false, error: "PAST" };
    await clearAuto();
    const { error } = await supabaseAdmin.from("alarms").insert(alarmRow(room, r.id, ms, source));
    if (error) return { ok: false, error: "SAVE_FAILED" };
    await supabaseAdmin.from("reservations").update({ wake_auto_off: false }).eq("id", r.id);
  }
  return { ok: true, state: await getWakeState(r.id, room, nowMs) };
}

/** Cron: 前の晩 20:00 を過ぎた早朝便の予約に、自動でセット (送迎の時刻が変わったら合わせる) */
export async function syncAutoWakes(nowMs = Date.now()): Promise<number> {
  if (!inWakeHours(nowMs)) return 0;
  try {
    const { data, error } = await supabaseAdmin.from("reservations")
      .select("id, room_id, assigned_room_id, check_in, check_out, early_checkin_at, late_checkout_at, guest_token, guest_checkout_at, wake_auto_off, status")
      .eq("status", "active").eq("wake_auto_off", false).is("guest_checkout_at", null)
      .gt("check_out", new Date(nowMs).toISOString()).lt("check_out", new Date(nowMs + WINDOW_MS + 6 * 3600e3).toISOString());
    if (error || !data?.length) return 0;
    const rs = (data as any[]).map((x) => withEffectiveTimes(x) as any).filter((x) => Date.parse(x.check_out) - nowMs < WINDOW_MS);
    if (!rs.length) return 0;
    const { data: rooms } = await supabaseAdmin.from("rooms").select("*");
    const roomById = new Map(((rooms ?? []) as any[]).map((x) => [x.id, x]));
    const drops = await loadCraneNestDrops(rs.map((r) => {
      const room = roomById.get(r.assigned_room_id || r.room_id);
      return { id: r.id, roomKanji: room ? toCabinRoom(room).kanji : null, checkOut: r.check_out, token: r.guest_token ?? null };
    })).catch(() => ({} as Record<string, CnDrop>));
    let n = 0;
    for (const r of rs) {
      const room = roomById.get(r.assigned_room_id || r.room_id);
      const plan = planWake(drops[r.id], r.check_out);
      if (!room || !plan || nowMs < plan.showFromMs || nowMs >= plan.wakeMs - 60e3) continue;
      const alarm = await pendingAlarm(r.id);
      if (alarm === "nosql") return n;
      if (alarm && alarm.source !== "auto") continue; // ゲストのもの・ゲストが変えたものはそのまま
      if (alarm && Math.abs(Date.parse(alarm.fire_at) - plan.wakeMs) < 60e3) continue;
      if (alarm) await supabaseAdmin.from("alarms").delete().eq("id", alarm.id);
      const { error: e2 } = await supabaseAdmin.from("alarms").insert(alarmRow(room, r.id, plan.wakeMs, "auto"));
      if (!e2) n++;
    }
    return n;
  } catch { return 0; }
}
