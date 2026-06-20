import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchIcalEvents, applyStayTimes, extractPhoneLast4, randomPin, extractReservationUrl } from "@/lib/ical";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * iCal 差分同期 Cron (1時間毎)。
 *  - 新規 airbnb_uid -> 予約を挿入し guest_token を自動発行
 *  - 既存 -> 期間更新
 *  - iCalから消滅した「未来の active 予約」 -> status='cancelled' で無効化
 * Vercel Cron は Authorization: Bearer ${CRON_SECRET} を付与。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: rooms } = await supabaseAdmin
    .from("rooms")
    .select("id, slug, airbnb_ical_url")
    .eq("is_active", true)
    .not("airbnb_ical_url", "is", null);

  const summary: Record<string, { added: number; updated: number; cancelled: number }> = {};

  for (const room of rooms ?? []) {
    const stat = { added: 0, updated: 0, cancelled: 0 };
    summary[room.slug] = stat;

    let events;
    try {
      events = await fetchIcalEvents(room.airbnb_ical_url);
    } catch (e) {
      console.error(`iCal fetch failed for ${room.slug}`, e);
      continue; // この部屋はスキップ (キャンセル誤判定を避けるため)
    }

    const seenUids = new Set<string>();

    // --- upsert (新規追加 / 期間更新) ---
    for (const ev of events) {
      seenUids.add(ev.uid);
      const { checkIn, checkOut } = applyStayTimes(ev.start, ev.end);

      const { data: existing } = await supabaseAdmin
        .from("reservations")
        .select("id, status")
        .eq("room_id", room.id)
        .eq("airbnb_uid", ev.uid)
        .maybeSingle();

      const reservationUrl = extractReservationUrl(ev.description);

      if (existing) {
        await supabaseAdmin
          .from("reservations")
          .update({
            check_in: checkIn.toISOString(),
            check_out: checkOut.toISOString(),
            status: "active", // 再出現したら復活
            airbnb_reservation_url: reservationUrl, // 既存ぶんも埋める
          })
          .eq("id", existing.id);
        stat.updated++;
      } else {
        // PIN: iCalに電話下4桁があればそれを、無ければランダム4桁
        const pin = extractPhoneLast4(ev.description) ?? randomPin();
        // guest_token はDBデフォルト(gen_random_bytes)で自動発行
        await supabaseAdmin.from("reservations").insert({
          room_id: room.id,
          source: "ical",
          airbnb_uid: ev.uid,
          check_in: checkIn.toISOString(),
          check_out: checkOut.toISOString(),
          status: "active",
          unlock_pin: pin,
          airbnb_reservation_url: reservationUrl,
        });
        stat.added++;
      }
    }

    // --- キャンセル無効化: iCalから消えた未来の active(ical) 予約 ---
    const nowIso = new Date().toISOString();
    const { data: dbActive } = await supabaseAdmin
      .from("reservations")
      .select("id, airbnb_uid")
      .eq("room_id", room.id)
      .eq("source", "ical")
      .eq("status", "active")
      .gt("check_out", nowIso); // 未来の予約のみ対象 (過去はcompletedへ別途)

    for (const r of dbActive ?? []) {
      if (r.airbnb_uid && !seenUids.has(r.airbnb_uid)) {
        await supabaseAdmin
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", r.id);
        stat.cancelled++;
      }
    }
  }

  // ===== チェックアウト後の自動OFF (エアコン・照明) + completed化 =====
  // 施錠はドアの開閉が分からないため対象外。
  const endNow = new Date().toISOString();
  const { data: ended } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id")
    .eq("status", "active")
    .lt("check_out", endNow);

  let cleanedRooms = 0;
  if (ended && ended.length) {
    const roomIds = [...new Set(ended.map((r) => r.room_id))];
    for (const roomId of roomIds) {
      const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (!room) continue;
      if (room.switchbot_ac_device_id) {
        const x = await executeDeviceAction(room, "ac_off", "Checkout");
        await logDevice({ room_id: roomId, action: "ac_off", source: "cron", success: x.ok });
      }
      if (room.switchbot_light_device_id) {
        const x = await executeDeviceAction(room, "light_off", "Checkout");
        await logDevice({ room_id: roomId, action: "light_off", source: "cron", success: x.ok });
      }
      cleanedRooms++;
    }
    // 過去予約を completed にして再処理を防止
    await supabaseAdmin.from("reservations").update({ status: "completed" })
      .in("id", ended.map((r) => r.id));
  }

  // 古い操作ログを自動削除 (既定90日、LOG_RETENTION_DAYS で変更可)
  let purged: number | null = null;
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS || "90");
  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const { count } = await supabaseAdmin
      .from("device_logs")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);
    purged = count ?? null;
  }

  return NextResponse.json({ ok: true, summary, cleanedRooms, purgedLogs: purged, ranAt: new Date().toISOString() });
}
