import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { guideKeyFor } from "@/lib/nfcGate";

/**
 * Crane Nest のシステム (パスポート登録) の「登録が終わった画面」から、こちらのコンシェルジュへ戻るボタン。
 *   /g/go?r=予約の合言葉 (guest_token)&wc=1&lang=zh
 *   合言葉はその予約のチェックイン用のリンクにだけ入っている → 4 桁の確認なしで、その予約のコンシェルジュ (/g/[部屋]?k=…) へ。
 *   wc=1 なら、着いたらすぐ 🌏 WELCOME の地球儀を開く。滞在中 (チェックインの 12 時間前〜チェックアウト) だけ
 */
export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store" };

export async function GET(req: NextRequest) {
  const r = (req.nextUrl.searchParams.get("r") || "").trim();
  const wc = req.nextUrl.searchParams.get("wc") === "1", lang = req.nextUrl.searchParams.get("lang");
  const lounge = new URL("/g/lounge", req.url); if (lang) lounge.searchParams.set("lang", lang);
  if (!r || r.length < 8 || r.length > 200) return NextResponse.redirect(lounge, { status: 302, headers: noStore });
  const { data: res } = await supabaseAdmin.from("reservations").select("id, room_id, assigned_room_id, status, check_in, check_out, late_checkout_at, early_checkin_at").eq("guest_token", r).maybeSingle();
  const now = Date.now();
  const inAt = res ? Date.parse(res.early_checkin_at || res.check_in) : NaN, outAt = res ? Date.parse(res.late_checkout_at || res.check_out) : NaN;
  if (!res || res.status === "cancelled" || !(now >= inAt - 12 * 3600e3 && now <= outAt)) return NextResponse.redirect(lounge, { status: 302, headers: noStore });
  const { data: room } = await supabaseAdmin.from("rooms").select("slug").eq("id", res.assigned_room_id || res.room_id).maybeSingle();
  if (!room?.slug) return NextResponse.redirect(lounge, { status: 302, headers: noStore });
  const u = new URL(`/g/${encodeURIComponent(room.slug)}`, req.url);
  u.searchParams.set("k", guideKeyFor({ rid: res.id, roomSlug: String(room.slug), checkOut: res.late_checkout_at || res.check_out }));
  if (wc) u.searchParams.set("wc", "1");
  if (lang) u.searchParams.set("lang", lang);
  return NextResponse.redirect(u, { status: 302, headers: noStore });
}
