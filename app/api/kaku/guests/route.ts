import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toDRes } from "@/lib/driverData";
import { toCabinRoom } from "@/lib/cabinData";
import { loadCraneNestDrops } from "@/lib/craneNest";
import { jstDay } from "@/lib/driverLogic";

/**
 * K-OPS のゲスト画面: 過去のゲスト (チェックアウトが今より前) の記録。
 *   GET ?q=名前 (部分一致・なくても可) &before=ISO (続きを読むとき: この日時より前) → 新しい順に 40 件
 *   Crane Nest のシステムの送迎予約 (人数・荷物・パスポート) も、あれば付ける
 */
export const dynamic = "force-dynamic";
const NAT: Record<string, string> = { zh: "CHN", ko: "KOR", ja: "JPN", en: "" };
const LIMIT = 40;

export async function GET(req: NextRequest) {
  const J = (v: any, s = 200) => NextResponse.json(v, { status: s, headers: { "cache-control": "no-store" } });
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const q = (req.nextUrl.searchParams.get("q") || "").replace(/[%,()*\\]/g, " ").trim().slice(0, 40);
  const bRaw = req.nextUrl.searchParams.get("before");
  const before = bRaw && !isNaN(Date.parse(bRaw)) ? new Date(bRaw).toISOString() : new Date().toISOString();
  try {
    const cols = "id, room_id, guest_name, guest_lang, status, check_in, check_out, guest_token, assigned_room_id, entrance_name, early_checkin_at, late_checkout_at, pickup_place, flight_no";
    const run = (c: string, withName: boolean) => {
      let x = supabaseAdmin.from("reservations").select(c).neq("status", "cancelled").lt("check_out", before).order("check_out", { ascending: false }).limit(LIMIT);
      if (q) x = x.or(withName ? `guest_name.ilike.%${q}%,entrance_name.ilike.%${q}%` : `guest_name.ilike.%${q}%`);
      return x;
    };
    let r: any = await run(cols, true);
    if (r.error && /column/.test(r.error.message)) r = await run("id, room_id, guest_name, guest_lang, status, check_in, check_out, guest_token", false);
    if (r.error) return J({ ok: false, error: r.error.message });
    const rows = (r.data ?? []) as any[];
    const { data: rq } = await supabaseAdmin.from("rooms").select("*");
    const kanji = new Map(((rq ?? []) as any[]).map((x) => [x.id, toCabinRoom(x).kanji]));
    const res = rows.map((x) => ({ raw: x, d: toDRes(x) }));
    const drops = await loadCraneNestDrops(res.map(({ raw, d }) => ({ id: d.id, roomKanji: kanji.get(d.roomId) ?? null, checkOut: d.checkOut, token: raw.guest_token ?? null }))).catch(() => ({} as Record<string, any>));
    const nights = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400e3));
    const guests = res.map(({ d }) => {
      const drop = (drops as any)[d.id] ?? null;
      return {
        id: d.id, name: drop?.names?.[0] || d.guest || "Guest", room: kanji.get(d.roomId) ?? "", roomId: d.roomId, lang: d.lang, cat: "past",
        place: null, pax: drop?.pax ?? 0, L: drop?.large ?? 0, S: drop?.small ?? 0, sp: drop?.special ?? 0,
        nights: nights(d.checkIn, d.checkOut), reg: !!drop?.names?.length, dropId: drop?.id ?? null,
        note: [drop?.dest, d.pickupPlace, d.flightNo ? `FLT ${d.flightNo}` : ""].filter(Boolean).join(" · ") || "—",
        nat: NAT[d.lang] ?? "", inDay: jstDay(d.checkIn), outDay: jstDay(d.checkOut), outAt: d.checkOut,
        others: (drop?.names ?? []).slice(1, 6),
      };
    });
    return J({ ok: true, guests, more: rows.length === LIMIT ? (rows[rows.length - 1]?.check_out ?? null) : null });
  } catch (e) {
    return J({ ok: false, error: String((e as Error)?.message || e) });
  }
}
