import { NextRequest, NextResponse } from "next/server";
import { findCheckoutStay, performCheckout } from "@/lib/guestCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ゲストのチェックアウト。POST /api/checkout/[room_id]  body: { lang, items: number[], via: "room" | "concierge" }
 *   本人確認: お部屋の PIN (Cookie) か、エントランス・コンシェルジュの 4 桁 (Cookie)。
 *   同意の記録 → 予約に「チェックアウト済み」 → 電源 OFF。何度押しても記録は 1 つ。
 */
export async function POST(req: NextRequest, { params }: { params: { room_id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { lang?: unknown; items?: unknown; via?: unknown };
  const stay = await findCheckoutStay(params.room_id);
  if (!stay) return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const r = await performCheckout(stay, { ...body, ua: req.headers.get("user-agent"), ip });
  if (!r.ok) return NextResponse.json(r, { status: r.error === "NOT_YET" ? 409 : 500 });
  return NextResponse.json(r);
}
