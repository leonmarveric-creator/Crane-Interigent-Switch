import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCraneNestDrops, craneNestOn } from "@/lib/craneNest";
import { toCountryCode } from "@/lib/countryCode";
import { toCabinRoom } from "@/lib/cabinData";

export const dynamic = "force-dynamic";
const J = (v: any) => NextResponse.json(v, { headers: { "cache-control": "no-store" } });
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * 「WELCOME, ○○ FAMILY」地球儀ホログラム用: お迎えの送迎中に、ゲストが車の中でパスポート登録を済ませたか。
 *   ?t=送迎 (cabin_trips) の ID → { ok, done, name, cc, pax }
 *   Crane Nest のシステム (パスポート登録) を、予約の合言葉 (guest_token) か お部屋 + チェックアウト日で探す。
 *   車内画面が 20 秒ごとに聞きに来る (登録が済んだら、もう聞かない)
 */
export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" });
  const t = req.nextUrl.searchParams.get("t");
  if (!isId(t) || !craneNestOn()) return J({ ok: true, done: false });
  const { data: trip } = await supabaseAdmin.from("cabin_trips").select("reservation_id, direction, status").eq("id", t).maybeSingle();
  if (!trip?.reservation_id || trip.status !== "active") return J({ ok: true, done: false });
  const { data: r } = await supabaseAdmin.from("reservations").select("id, room_id, assigned_room_id, check_out, late_checkout_at, guest_token").eq("id", trip.reservation_id).maybeSingle();
  if (!r) return J({ ok: true, done: false });
  const roomId = r.assigned_room_id || r.room_id;
  const { data: room } = roomId ? await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle() : { data: null };
  const drops = await loadCraneNestDrops([{ id: r.id, roomKanji: room ? toCabinRoom(room).kanji : null, checkOut: r.late_checkout_at || r.check_out, token: r.guest_token ?? null }]).catch(() => ({} as Record<string, any>));
  const d = drops[r.id];
  if (!d || !d.names?.length) return J({ ok: true, done: false });
  return J({ ok: true, done: true, name: String(d.names[0]).slice(0, 60), cc: toCountryCode(d.nationality ?? null), pax: Math.max(d.pax || 0, d.names.length) });
}
