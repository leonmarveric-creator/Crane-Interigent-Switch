/**
 * お父さんの送迎画面の自動処理 (wake-alarm の Cron から 1〜2 分毎に呼ぶ)。サーバ専用。
 *   1. 自動準備: お迎え (なければチェックイン) の N 分前に、その部屋を快適モードに (設定でオフにできる)
 *   2. 飛行機の自動確認: 便名がある予約だけ、到着の 1 時間前に 1 回 (設定でオフにできる)
 *   3. 鍵の電池: 鍵のある部屋を 15 日に 1 回だけ確認 (朝 9 時以降)。10% 以下なら父の画面と WxPusher で知らせる
 *   migration_driver.sql 未実行なら何もしない。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { getSesameStatus } from "@/lib/sesame";
import { fetchFlight, flightConfigured } from "@/lib/flight";
import { loadReservations, getDriverSettings, toDRoom } from "@/lib/driverData";
import { prepDue, pickupBase, batteryTargets, batteryLow, jstDay } from "@/lib/driverLogic";
import { sendWxPusher } from "@/lib/wxpusher";

export async function runDriverAuto(nowMs = Date.now()) {
  const out = { prepared: 0, flights: 0, battery: 0 };
  const { res, missing } = await loadReservations(nowMs - 2 * 86400e3, nowMs + 5 * 86400e3);
  if (missing) return out;
  const settings = await getDriverSettings();
  const { data: roomRows } = await supabaseAdmin.from("rooms").select("*").eq("is_active", true);
  const byId = new Map((roomRows ?? []).map((r: any) => [r.id, r]));

  // 1. 自動準備
  if (settings.autoPrep) {
    for (const r of res.filter((x) => prepDue(x, nowMs, settings.autoPrepMin))) {
      const room = byId.get(r.roomId); if (!room) continue;
      // 先に記録して二重実行を防ぐ (失敗したら戻す)
      const { data: claimed } = await supabaseAdmin.from("reservations").update({ prepared_at: new Date(nowMs).toISOString() })
        .eq("id", r.id).is("prepared_at", null).select("id").maybeSingle();
      if (!claimed) continue;
      const ok = (await executeDeviceAction(room, "welcome", "Driver Auto Prep").catch(() => ({ ok: false }))).ok;
      await logDevice({ room_id: room.id, reservation_id: r.id, action: "welcome", source: "cron", success: ok });
      if (!ok) await supabaseAdmin.from("reservations").update({ prepared_at: null }).eq("id", r.id);
      else out.prepared++;
    }
  }

  // 2. 飛行機の自動確認 (到着 1 時間前〜到着、まだ自動確認していない)
  if (settings.flightAuto && flightConfigured()) {
    for (const r of res) {
      if (!r.flightNo || r.pickupNone) continue;
      const at = Date.parse(pickupBase(r));
      if (nowMs < at - 60 * 60e3 || nowMs > at) continue;
      if (r.flightCheckedAt && Date.parse(r.flightCheckedAt) > at - 60 * 60e3) continue;
      const f = await fetchFlight(r.flightNo, pickupBase(r));
      if (!f.ok) continue;
      await supabaseAdmin.from("reservations").update({ flight_info: f.info ?? null, flight_checked_at: new Date(nowMs).toISOString() }).eq("id", r.id);
      out.flights++;
    }
  }

  // 3. 鍵の電池 (日本時間の朝 9 時以降、1 日 1 回)
  const today = jstDay(nowMs);
  const hour = new Date(nowMs + 9 * 3600e3).getUTCHours();
  if (hour >= 9) {
    const { data: st } = await supabaseAdmin.from("app_settings").select("driver_battery_day").eq("id", 1).maybeSingle();
    if (st && (st as any).driver_battery_day !== today) {
      await supabaseAdmin.from("app_settings").update({ driver_battery_day: today }).eq("id", 1);
      const rooms = (roomRows ?? []).map(toDRoom);
      const { data: logs } = await supabaseAdmin.from("lock_battery_logs").select("room_id, battery, checked_at").order("checked_at", { ascending: false }).limit(1000);
      const last: Record<string, string> = {};
      for (const l of logs ?? []) if (!last[l.room_id]) last[l.room_id] = l.checked_at;
      for (const id of batteryTargets(rooms, last, nowMs)) {
        const room = byId.get(id); if (!room) continue;
        const s = await getSesameStatus({ deviceUuid: room.sesame_device_uuid, apiKey: room.sesame_api_key });
        if (!s.ok || typeof s.battery !== "number") continue;
        await supabaseAdmin.from("lock_battery_logs").insert({ room_id: room.id, battery: s.battery, locked: s.locked ?? null });
        out.battery++;
        if (!batteryLow(s.battery)) continue;
        const { data: open } = await supabaseAdmin.from("driver_alerts").select("id").eq("room_id", room.id).eq("kind", "battery").is("resolved_at", null).limit(1);
        if (open?.length) continue;
        const next = res.filter((r) => r.roomId === room.id && Date.parse(r.checkIn) > nowMs).sort((a, b) => Date.parse(a.checkIn) - Date.parse(b.checkIn))[0];
        await supabaseAdmin.from("driver_alerts").insert({ room_id: room.id, kind: "battery", battery: s.battery, due_at: next?.checkIn ?? null });
        const name = room.display_name || room.slug;
        await sendWxPusher({
          title: `【鍵の電池】${name} 残り ${s.battery}%`,
          content: [`【鍵の電池】${name} の電池が残り ${s.battery}% です。`, "電池を交換してください。", next ? `次のチェックイン: ${jstDay(next.checkIn)}` : "", "交換したら、お父さんの画面の「已更换」を押してください。"].filter(Boolean).join("\n"),
        }).catch(() => null);
      }
    }
  }
  return out;
}
