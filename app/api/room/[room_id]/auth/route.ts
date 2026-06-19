import { NextRequest, NextResponse } from "next/server";
import { getActiveStay } from "@/lib/auth";
import { signSession, roomCookieName } from "@/lib/roomSession";

export const runtime = "nodejs";

/**
 * ゲストのPIN認証。固定QRから開いたページで入力したPINを照合し、
 * 一致すれば滞在終了まで有効な署名付きセッションCookieを発行。
 * POST /api/room/[room_id]/auth  body: { pin }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  const stay = await getActiveStay(params.room_id);
  if (!stay) {
    return NextResponse.json({ ok: false, error: "NO_ACTIVE_STAY" }, { status: 403 });
  }

  const expected = stay.reservation.unlock_pin;
  if (!expected || !pin || pin.trim() !== expected) {
    return NextResponse.json({ ok: false, error: "BAD_PIN" }, { status: 401 });
  }

  const exp = new Date(stay.reservation.check_out).getTime();
  const token = signSession(stay.reservation.id, exp);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(roomCookieName(params.room_id), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
  return res;
}
