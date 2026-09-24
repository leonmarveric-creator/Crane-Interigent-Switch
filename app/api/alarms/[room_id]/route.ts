import { NextRequest, NextResponse } from "next/server";
import { authorizeRoomRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWafuAutoOffAtMs, isWakeLightMode } from "@/lib/wakePrewake";

export const runtime = "nodejs";

/**
 * ゲストが光目覚ましを設定/解除。
 * 認証はPIN認証で発行された署名付きセッションCookie。
 * POST /api/alarms/[room_id]  body: { fireAtIso, mode } または { clear:true }
 * 1滞在につき1アラーム (upsert)。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { fireAtIso, clear, mode } = (await req.json().catch(() => ({}))) as {
    fireAtIso?: string;
    clear?: boolean;
    mode?: unknown;
  };

  const stay = await authorizeRoomRequest(params.room_id);
  if (!stay) return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });

  const { reservation, room } = stay;

  if (clear) {
    await supabaseAdmin.from("alarms").delete().eq("reservation_id", reservation.id);
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

  // 滞在期間内かチェック
  if (fireAt > new Date(reservation.check_out))
    return NextResponse.json({ ok: false, error: "OUT_OF_STAY" }, { status: 400 });

  // 1滞在1件。入力が有効だと確定してから既存設定を置き換える。
  await supabaseAdmin.from("alarms").delete().eq("reservation_id", reservation.id);
  const { error } = await supabaseAdmin.from("alarms").insert({
    reservation_id: reservation.id,
    room_id: reservation.room_id,
    fire_at: fireAt.toISOString(),
    is_enabled: true,
    wake_mode: wakeMode,
    wafu_auto_off_at: wakeMode === "horizon_rise"
      ? new Date(getWafuAutoOffAtMs(fireAt.getTime())).toISOString()
      : null,
  });
  if (error) {
    // 原因が分かるよう DB のエラー内容も返す (列が無い・NOT NULL 違反なら SQL 未実行)
    console.error("[alarm] insert failed", error);
    return NextResponse.json(
      { ok: false, error: "SAVE_FAILED", detail: `${error.code ?? ""} ${error.message ?? ""}`.trim() },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, fireAt: fireAt.toISOString(), mode: wakeMode });
}
