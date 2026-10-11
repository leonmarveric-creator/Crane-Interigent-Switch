import { NextRequest, NextResponse } from "next/server";
import { findCheckoutStay } from "@/lib/guestCheckout";
import { setWake } from "@/lib/wakeAuto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 早朝便の自動光目覚まし: ゲストの操作。POST /api/wake/[room]  body: { action: "off" | "on" | "set", time?: "HH:MM" }
 *   本人確認はお部屋の PIN か、エントランス・コンシェルジュの 4 桁 (Cookie)。チェックアウト後は使えない。
 */
export async function POST(req: NextRequest, { params }: { params: { room: string } }) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; time?: string };
  const stay = await findCheckoutStay(params.room);
  if (!stay || stay.reservation.guest_checkout_at) return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
  const a = body.action === "off" ? { action: "off" as const } : body.action === "on" ? { action: "on" as const }
    : body.action === "set" ? { action: "set" as const, time: String(body.time ?? "") } : null;
  if (!a) return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
  const r = await setWake(stay.reservation.id, stay.room, a);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
