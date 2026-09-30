/**
 * Crane Nest のシステムのフォーム (パスポート登録・お見送りの送迎予約) から呼ばれる。
 *   GET ?r=<予約の合言葉 (guest_token)> → お部屋の漢字・チェックアウト日・名前 (フォームに最初から入れる用)
 *   返すのは最小限だけ。合言葉が合わない・終わった予約は 404。
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toCabinRoom } from "@/lib/cabinData";
import { CRANENEST_APP_URL } from "@/lib/craneNest";

export const dynamic = "force-dynamic";
const ORIGINS = [CRANENEST_APP_URL, ...(process.env.CRANENEST_ALLOW_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)];
function cors(req: NextRequest) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^https:\/\/crane-nest-cmn2(-[a-z0-9-]+)?\.vercel\.app$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "access-control-allow-origin": ok ? o : CRANENEST_APP_URL, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin", "cache-control": "no-store" };
}
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(req) }); }

export async function GET(req: NextRequest) {
  const h = cors(req);
  const r = (req.nextUrl.searchParams.get("r") || "").trim();
  if (!/^[a-f0-9]{24,128}$/i.test(r)) return NextResponse.json({ ok: false, error: "BAD" }, { status: 400, headers: h });
  const { data: res } = await supabaseAdmin.from("reservations").select("*").eq("guest_token", r).neq("status", "cancelled").maybeSingle();
  const out = (res as any)?.late_checkout_at || (res as any)?.check_out;
  if (!res || !out || Date.parse(out) < Date.now() - 86400e3) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: h });
  const roomId = (res as any).assigned_room_id || (res as any).room_id;
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  const kanji = room ? toCabinRoom(room).kanji : null;
  const d = new Date(Date.parse(out) + 9 * 3600e3).toISOString().slice(0, 10);
  const name = String((res as any).entrance_name || (res as any).guest_name || "").trim();
  return NextResponse.json({ ok: true, room: kanji, checkOut: d, guest: name ? name.split(/\s+/)[0] : null, lang: (res as any).guest_lang ?? null }, { headers: h });
}
