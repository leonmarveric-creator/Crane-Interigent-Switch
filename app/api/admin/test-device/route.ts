import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice, type DeviceAction } from "@/lib/deviceControl";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * 管理画面からのデバイス動作テスト (ホスト専用・PIN不要)。
 * POST /api/admin/test-device  body: { roomSlug, action }
 */
export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { roomSlug, action } = (await req.json().catch(() => ({}))) as {
    roomSlug?: string;
    action?: DeviceAction;
  };

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("slug", roomSlug)
    .maybeSingle();
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });

  try {
    const r = await executeDeviceAction(room, action as DeviceAction, "Admin Test");
    await logDevice({ room_id: room.id, action: String(action), source: "admin", success: r.ok });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error("admin test error", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}
