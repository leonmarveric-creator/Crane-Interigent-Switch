import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { activeTrip, cabinRoomById, cabinTrackById, toCabinDevice } from "@/lib/cabinData";
import { cleanCmd } from "@/lib/cabinMusic";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { aiHumorOn, checkinQrUrl } from "@/lib/cabinData";
import { checkinLinkFor } from "@/lib/craneNest";
import { pendingInviteFor } from "@/lib/keepsake";

export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * 車内 iPad が 3 秒ごとに聞きに来る: 「今、送迎は始まっている？」
 *   ?d=iPad の ID &gps=1|0 (この iPad に GPS があるか。分からなければ付けない)
 *     &np=iPad が持っている曲の ID (違う曲になったときだけ、曲名・カバー・歌詞を返す)
 *   返すもの: この iPad の名前 / 送迎 (スマホの位置・再生中の曲も) / 部屋の写真など
 */
export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const d = req.nextUrl.searchParams.get("d"), gps = req.nextUrl.searchParams.get("gps");
  let device = null;
  if (isId(d)) {
    const up: any = { last_seen_at: new Date().toISOString() };
    if (gps === "1" || gps === "0") up.has_gps = gps === "1";
    const { data, error } = await supabaseAdmin.from("cabin_devices").update(up).eq("id", d).select("*").maybeSingle();
    if (error && /cabin_devices/.test(error.message)) return J({ ok: false, error: "SETUP" });
    device = data ? toCabinDevice(data) : null;
    if (!device) return J({ ok: true, device: null, trip: null, room: null });
  }
  const trip = await activeTrip(device?.id ?? null);
  const have = req.nextUrl.searchParams.get("np") || "";
  const [room, track, checkin, checkinLink, humor] = await Promise.all([
    trip ? cabinRoomById(trip.roomId) : null,
    trip?.np && trip.np.id !== have ? cabinTrackById(trip.np.id).catch(() => null) : null,
    trip ? checkinQrUrl().catch(() => null) : null,
    // 予約つきのチェックイン QR (パスポート登録・お見送りの送迎予約。その予約の合言葉入り → 自動で紐づく)
    trip?.resId ? (async () => { const { data } = await supabaseAdmin.from("reservations").select("guest_token").eq("id", trip.resId!).maybeSingle(); return data?.guest_token ? checkinLinkFor(String(data.guest_token)) : null; })().catch(() => null) : null,
    trip ? aiHumorOn().catch(() => false) : false,
  ]);
  // 回送中 (ゲストなし): 迎えに行くゲストの情報・お部屋の準備・鍵の電池 (父向けの画面に出す)
  let dh: any = null;
  if (trip?.phase === "dead") {
    try {
      const [{ data: r }, { data: bt }] = await Promise.all([
        trip.resId ? supabaseAdmin.from("reservations").select("*").eq("id", trip.resId).maybeSingle() : Promise.resolve({ data: null }),
        trip.roomId ? supabaseAdmin.from("lock_battery_logs").select("battery, checked_at").eq("room_id", trip.roomId).order("checked_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      ] as any);
      dh = {
        guest: (r as any)?.entrance_name || (r as any)?.guest_name || null, flightNo: (r as any)?.flight_no ?? null, flight: (r as any)?.flight_info ?? null,
        prepared: (r as any)?.prepared_at ?? null, pickupAt: (r as any)?.pickup_at ?? null, battery: typeof (bt as any)?.battery === "number" ? (bt as any).battery : null,
      };
    } catch { dh = {}; }
  }
  // お見送りの組に「招待くじ」があれば (まだ引いていない)、降りる直前に iPad に出す
  const gift = trip?.dir === "out" && trip.resId ? await pendingInviteFor(trip.resId) : null;
  return J({ ok: true, device, trip, room, track, checkin, checkinLink, humor, dh, gift, now: Date.now() });
}

/** 登録 (初回) / 名前の変更 / 送迎の終了 (到着後に iPad から) / 音楽の操作 (iPad の再生ボタン → スマホ) */
export async function POST(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const b = await req.json().catch(() => ({}));
  if (b.op === "register") {
    const name = String(b.name || "").trim().slice(0, 30) || "iPad";
    const { count } = await supabaseAdmin.from("cabin_devices").select("id", { count: "exact", head: true });
    const { data, error } = await supabaseAdmin.from("cabin_devices").insert({ name, sort: count ?? 0, last_seen_at: new Date().toISOString() }).select("*").single();
    if (error || !data) return J({ ok: false, error: /cabin_devices/.test(error?.message || "") ? "SETUP" : error?.message || "INSERT" });
    return J({ ok: true, device: toCabinDevice(data) });
  }
  if (b.op === "rename" && isId(b.id)) {
    const name = String(b.name || "").trim().slice(0, 30); if (!name) return J({ ok: false, error: "NAME" });
    const { error } = await supabaseAdmin.from("cabin_devices").update({ name }).eq("id", b.id);
    return J(error ? { ok: false, error: error.message } : { ok: true });
  }
  if (b.op === "end" && isId(b.trip)) {
    const { error } = await supabaseAdmin.from("cabin_trips").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", b.trip).eq("status", "active");
    return J(error ? { ok: false, error: error.message } : { ok: true });
  }
  // ゲストが iPad で「お部屋の明かりをつけて」(送迎中のお迎えだけ)
  if (b.op === "lights" && isId(b.trip)) {
    const { data: t } = await supabaseAdmin.from("cabin_trips").select("room_id, direction, status").eq("id", b.trip).maybeSingle();
    if (!t || t.status !== "active" || t.direction !== "in" || !t.room_id) return J({ ok: false, error: "NO_TRIP" });
    const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", t.room_id).maybeSingle();
    if (!room) return J({ ok: false, error: "NO_ROOM" });
    const action = room.switchbot_wafu_device_id ? "wafu_on_warm" : "light_on";
    const r = await executeDeviceAction(room, action, "Cabin iPad").catch(() => ({ ok: false }));
    await logDevice({ room_id: room.id, action, source: "admin", success: r.ok }).catch(() => {});
    return J({ ok: r.ok });
  }
  if (b.op === "cmd" && isId(b.trip)) {
    const cmd = cleanCmd(b.c, b.v); if (!cmd) return J({ ok: false, error: "BAD_CMD" }, 400);
    const { error } = await supabaseAdmin.from("cabin_trips").update({ music_cmd: cmd }).eq("id", b.trip).eq("status", "active");
    return J(error ? { ok: false, error: /music_cmd/.test(error.message) ? "SETUP" : error.message } : { ok: true });
  }
  // 回送の切り替え: board = ゲスト乗車 (iPad のボタン) / deadhead = お見送りの到着のあと、帰り道へ
  if ((b.op === "board" || b.op === "deadhead") && isId(b.trip)) {
    const up = b.op === "board" ? { phase: "guest", started_at: new Date().toISOString() } : { phase: "dead" };
    const { error } = await supabaseAdmin.from("cabin_trips").update(up).eq("id", b.trip).eq("status", "active");
    return J(error ? { ok: false, error: /phase/.test(error.message) ? "SETUP" : error.message } : { ok: true });
  }
  // iPad が話す声を、スマホで流してもらう (順番待ちに足す。古いものは 30 秒で消える)
  if (b.op === "say" && isId(b.trip)) {
    const u = String(b.u || "");
    if (!/^\/(cabin|kaku)\/audio\/[\w\/.-]+\.mp3$/.test(u)) return J({ ok: false, error: "BAD_URL" }, 400);
    const { data: t, error: e1 } = await supabaseAdmin.from("cabin_trips").select("voice_q, status").eq("id", b.trip).maybeSingle();
    if (e1) return J({ ok: false, error: /voice_q/.test(e1.message) ? "SETUP" : e1.message });
    if (!t || t.status !== "active") return J({ ok: false, error: "NO_TRIP" });
    const now = Date.now(), q = (Array.isArray((t as any).voice_q) ? (t as any).voice_q : []).filter((x: any) => x && now - Number(x.n) < 30000);
    const n = Math.max(now, ...q.map((x: any) => Number(x.n) + 1));
    q.push({ n, u, s: String(b.s || "").slice(0, 300) });
    const { error } = await supabaseAdmin.from("cabin_trips").update({ voice_q: q.slice(-8) }).eq("id", b.trip);
    // n はスマホの返事 (voice_ack) と照らし合わせるために返す
    return J(error ? { ok: false, error: error.message } : { ok: true, n });
  }
  return J({ ok: false, error: "BAD_OP" }, 400);
}
