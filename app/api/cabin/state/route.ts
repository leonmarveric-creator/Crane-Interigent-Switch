import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { activeTrip, cabinRoomById, cabinTrackById, toCabinDevice } from "@/lib/cabinData";
import { cleanCmd } from "@/lib/cabinMusic";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { checkinQrUrl } from "@/lib/cabinData";

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
  const [room, track, checkin] = await Promise.all([
    trip ? cabinRoomById(trip.roomId) : null,
    trip?.np && trip.np.id !== have ? cabinTrackById(trip.np.id).catch(() => null) : null,
    trip ? checkinQrUrl().catch(() => null) : null,
  ]);
  return J({ ok: true, device, trip, room, track, checkin, now: Date.now() });
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
  return J({ ok: false, error: "BAD_OP" }, 400);
}
