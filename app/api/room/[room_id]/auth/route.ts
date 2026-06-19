import { NextRequest, NextResponse } from "next/server";
import { getActiveStays } from "@/lib/auth";
import { signSession, roomCookieName } from "@/lib/roomSession";

export const runtime = "nodejs";

/**
 * ゲストのPIN認証。固定QRから開いたページで入力したPINを照合し、
 * 一致すれば滞在終了まで有効な署名付きセッションCookieを発行。
 * 期間が重なる予約が複数あっても、一致するPINの予約でセッションを発行する。
 * POST /api/room/[room_id]/auth  body: { pin }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  const stays = await getActiveStays(params.room_id);
  if (!stays) {
    return NextResponse.json({ ok: false, error: "NO_ACTIVE_STAY" }, { status: 403 });
  }

  const entered = pin?.trim();
  const match = entered
    ? stays.reservations.find((r) => r.unlock_pin && r.unlock_pin === entered)
    : undefined;
  if (!match) {
    return NextResponse.json({ ok: false, error: "BAD_PIN" }, { status: 401 });
  }

  const exp = new Date(match.check_out).getTime();
  const token = signSession(match.id, exp);

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
