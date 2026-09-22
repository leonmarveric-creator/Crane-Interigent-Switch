import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { getWafuAutoOffAtMs, isWakeLightMode } from "@/lib/wakePrewake";

export const runtime = "nodejs";

/**
 * 管理画面テストページからの光目覚まし設定/解除 (ホスト専用・PIN不要)。
 * ゲスト用 /api/alarms/[room_id] と同じ挙動だが、予約(滞在)に紐付けず
 * reservation_id = null のテスト用アラームとして保存する。
 * wake-alarm Cron は room_id だけを見るため点灯動作は本番と同じ。
 * POST /api/admin/test-alarm  body: { roomSlug, fireAtIso, mode } または { roomSlug, clear:true }
 */
export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { roomSlug, fireAtIso, clear, mode } = (await req.json().catch(() => ({}))) as {
    roomSlug?: string;
    fireAtIso?: string;
    clear?: boolean;
    mode?: unknown;
  };

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id, switchbot_wafu_device_id")
    .eq("slug", roomSlug)
    .maybeSingle();
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });

  if (clear) {
    await supabaseAdmin
      .from("alarms")
      .delete()
      .eq("room_id", room.id)
      .is("reservation_id", null);
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!fireAtIso) return NextResponse.json({ ok: false, error: "NO_TIME" }, { status: 400 });
  if (!isWakeLightMode(mode))
    return NextResponse.json({ ok: false, error: "BAD_MODE" }, { status: 400 });
  const wakeMode = mode;
  if (wakeMode === "horizon_rise" && !room.switchbot_wafu_device_id)
    return NextResponse.json({ ok: false, error: "NO_WAFU" }, { status: 400 });

  const fireAt = new Date(fireAtIso);
  if (isNaN(fireAt.getTime()) || fireAt.getTime() < Date.now())
    return NextResponse.json({ ok: false, error: "BAD_TIME" }, { status: 400 });

  // テストモードなので滞在期間チェックは行わず、有効な入力だけ既存設定と置き換える。
  await supabaseAdmin
    .from("alarms")
    .delete()
    .eq("room_id", room.id)
    .is("reservation_id", null);
  const { error } = await supabaseAdmin.from("alarms").insert({
    reservation_id: null,
    room_id: room.id,
    fire_at: fireAt.toISOString(),
    is_enabled: true,
    wake_mode: wakeMode,
    wafu_auto_off_at: wakeMode === "horizon_rise"
      ? new Date(getWafuAutoOffAtMs(fireAt.getTime())).toISOString()
      : null,
  });
  if (error) return NextResponse.json({ ok: false, error: "SAVE_FAILED" }, { status: 500 });

  return NextResponse.json({ ok: true, fireAt: fireAt.toISOString(), mode: wakeMode });
}
