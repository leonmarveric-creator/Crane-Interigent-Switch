import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchIcalEvents, applyStayTimes, extractPhoneLast4, randomPin, extractReservationUrl } from "@/lib/ical";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";

export const runtime = "nodejs";
export const maxDuration = 60;

type Stat = { added: number; updated: number; cancelled: number };

/** 1部屋のiCal同期 (並列実行用)。 */
async function processRoom(room: { id: string; slug: string; airbnb_ical_url: string }): Promise<Stat> {
  const stat: Stat = { added: 0, updated: 0, cancelled: 0 };

  let events;
  try {
    events = await fetchIcalEvents(room.airbnb_ical_url);
  } catch (e) {
    console.error(`iCal fetch failed for ${room.slug}`, e);
    return stat; // この部屋はスキップ (キャンセル誤判定回避)
  }

  const seenUids = new Set<string>();

  // --- upsert (新規追加 / 期間更新) を並列実行 ---
  await Promise.all(events.map(async (ev) => {
    seenUids.add(ev.uid);
    const { checkIn, checkOut } = applyStayTimes(ev.start, ev.end);
    const reservationUrl = extractReservationUrl(ev.description);

    const { data: existing } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("room_id", room.id)
      .eq("airbnb_uid", ev.uid)
      .maybeSingle();

    if (existing) {
      const upd: Record<string, any> = {
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        airbnb_reservation_url: reservationUrl,
      };
      // 未来の予約のみ active に復活。過去(終了済み)はステータスを触らない → ピンポン防止
      if (checkOut.getTime() > Date.now()) upd.status = "active";
      await supabaseAdmin.from("reservations").update(upd).eq("id", existing.id);
      stat.updated++;
    } else {
      const pin = extractPhoneLast4(ev.description) ?? randomPin();
      await supabaseAdmin.from("reservations").insert({
        room_id: room.id, source: "ical", airbnb_uid: ev.uid,
        check_in: checkIn.toISOString(), check_out: checkOut.toISOString(),
        status: "active", unlock_pin: pin, airbnb_reservation_url: reservationUrl,
      });
      stat.added++;
    }
  }));

  // --- キャンセル無効化: iCalから消えた未来の active(ical) 予約 ---
  const nowIso = new Date().toISOString();
  const { data: dbActive } = await supabaseAdmin
    .from("reservations")
    .select("id, airbnb_uid")
    .eq("room_id", room.id)
    .eq("source", "ical")
    .eq("status", "active")
    .gt("check_out", nowIso);

  await Promise.all((dbActive ?? []).map(async (r) => {
    if (r.airbnb_uid && !seenUids.has(r.airbnb_uid)) {
      await supabaseAdmin.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
      stat.cancelled++;
    }
  }));

  return stat;
}

/**
 * チェックアウト後処理。退室済み(誰もいない)の部屋だけエアコン・照明をOFFし、
 * 終了した予約を completed 化する。
 * 滞在中(チェックイン済み&チェックアウト前の客がいる)の部屋は絶対に触らない。
 */
async function checkoutCleanup(): Promise<number> {
  const endNow = new Date().toISOString();
  const { data: ended } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id")
    .eq("status", "active")
    .lt("check_out", endNow);
  if (!ended || !ended.length) return 0;

  const roomIds = [...new Set(ended.map((r) => r.room_id))];
  let offCount = 0;
  await Promise.all(roomIds.map(async (roomId) => {
    // 現在その部屋に滞在中の客がいれば絶対にOFFしない (退室後のみOFF)
    const { data: occ } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("room_id", roomId)
      .eq("status", "active")
      .lte("check_in", endNow)
      .gt("check_out", endNow)
      .limit(1)
      .maybeSingle();
    if (occ) return; // 在室中 → スキップ

    const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room) return;
    if (room.switchbot_ac_device_id) {
      const x = await executeDeviceAction(room, "ac_off", "Checkout");
      await logDevice({ room_id: roomId, action: "ac_off", source: "cron", success: x.ok });
    }
    if (room.switchbot_light_device_id) {
      const x = await executeDeviceAction(room, "light_off", "Checkout");
      await logDevice({ room_id: roomId, action: "light_off", source: "cron", success: x.ok });
    }
    offCount++;
  }));

  // 終了した予約は completed にして再処理を防止 (在室有無に関わらず)
  await supabaseAdmin.from("reservations").update({ status: "completed" }).in("id", ended.map((r) => r.id));
  return offCount;
}

/**
 * iCal 差分同期 Cron。全部屋・全イベントを並列処理して高速化。
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

  // 全部屋を並列同期
  const summary: Record<string, Stat> = {};
  await Promise.all((rooms ?? []).map(async (room) => {
    summary[room.slug] = await processRoom(room as any);
  }));

  // チェックアウト自動OFF + ログ削除 (並列)
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS || "90");
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  // PIN失敗記録は1日より古いものを削除 (ロック判定は直近のみ参照のため)
  const pinCutoff = new Date(Date.now() - 86400000).toISOString();
  const [cleanedRooms, purgeRes] = await Promise.all([
    checkoutCleanup(),
    retentionDays > 0
      ? supabaseAdmin.from("device_logs").delete({ count: "exact" }).lt("created_at", cutoff)
      : Promise.resolve({ count: null }),
    supabaseAdmin.from("pin_attempts").delete().lt("created_at", pinCutoff),
  ]);

  return NextResponse.json({
    ok: true, summary, cleanedRooms,
    purgedLogs: (purgeRes as any)?.count ?? null,
    ranAt: new Date().toISOString(),
  });
}
