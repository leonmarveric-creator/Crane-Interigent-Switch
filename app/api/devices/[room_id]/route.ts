import { NextRequest, NextResponse } from "next/server";
import { authorizeRoomRequest } from "@/lib/auth";
import { executeDeviceAction, type DeviceAction } from "@/lib/deviceControl";

export const runtime = "nodejs"; // crypto / aes-cmac のため Edge不可

/**
 * デバイス操作プロキシ。秘密鍵はここ(サーバ)から出ない。
 * 認証は PIN認証で発行された署名付きセッションCookie。
 * POST /api/devices/[room_id]   body: { action }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { action } = (await req.json().catch(() => ({}))) as { action?: DeviceAction };

  const stay = await authorizeRoomRequest(params.room_id);
  if (!stay) {
    return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
  }

  try {
    const r = await executeDeviceAction(
      stay.room,
      action as DeviceAction,
      `Guest:${stay.reservation.id.slice(0, 8)}`
    );
    return NextResponse.json({ ok: r.ok, error: r.error }, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error("device cmd error", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}
