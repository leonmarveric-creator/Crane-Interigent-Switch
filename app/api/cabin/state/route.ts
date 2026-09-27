import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { activeTrip, cabinRoomById, toCabinDevice } from "@/lib/cabinData";

export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * 車内 iPad が 3 秒ごとに聞きに来る: 「今、送迎は始まっている？」
 *   ?d=iPad の ID &gps=1|0 (この iPad に GPS があるか。分からなければ付けない)
 *   返すもの: この iPad の名前 / 送迎 (スマホの位置も) / 部屋の写真など
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
  const room = trip ? await cabinRoomById(trip.roomId) : null;
  return J({ ok: true, device, trip, room, now: Date.now() });
}

/** 登録 (初回) / 名前の変更 / 送迎の終了 (到着後に iPad から) */
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
  return J({ ok: false, error: "BAD_OP" }, 400);
}
