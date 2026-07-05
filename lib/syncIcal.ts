import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchIcalEvents, applyStayTimes, extractPhoneLast4, randomPin, extractReservationUrl } from "@/lib/ical";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";

/**
 * iCal同期のコアロジック。Cron (定期) と 管理画面の「今すぐ同期」ボタン (手動) の
 * 両方から呼べるよう共通化している。
 */

export type Stat = { added: number; updated: number; cancelled: number };

/** 1部屋のiCal同期 (並列実行用)。 */
export async function processRoom(room: { id: string; slug: string; airbnb_ical_url: string }): Promise<Stat> {
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
export async function checkoutCleanup(): Promise<number> {
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
 * 全 is_active 部屋の iCal を並列同期し、チェックアウト後処理まで行う。
 * 戻り値: 部屋slugごとの追加/更新/キャンセル件数と、OFFした部屋数。
 */
export async function runIcalSync(): Promise<{ summary: Record<string, Stat>; cleanedRooms: number }> {
  const { data: rooms } = await supabaseAdmin
    .from("rooms")
    .select("id, slug, airbnb_ical_url")
    .eq("is_active", true)
    .not("airbnb_ical_url", "is", null);

  const summary: Record<string, Stat> = {};
  await Promise.all((rooms ?? []).map(async (room) => {
    summary[room.slug] = await processRoom(room as any);
  }));

  const cleanedRooms = await checkoutCleanup();
  return { summary, cleanedRooms };
}
