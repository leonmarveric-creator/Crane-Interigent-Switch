import { NextRequest, NextResponse } from "next/server";
import { validateStay } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * ゲストが光目覚ましを設定/解除。
 * POST /api/alarms/[room_id]  body: { token, fireAtIso } または { token, clear:true }
 * 1滞在につき1アラーム (upsert)。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { token, fireAtIso, clear } = (await req.json().catch(() => ({}))) as {
    token?: string;
    fireAtIso?: string;
    clear?: boolean;
  };

  const stay = await validateStay(params.room_id, token);
  if (!stay) return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });

  const { reservation } = stay;

  // 既存のこの滞在のアラームを削除 (シンプルに1件運用)
  await supabaseAdmin.from("alarms").delete().eq("reservation_id", reservation.id);

  if (clear) return NextResponse.json({ ok: true, cleared: true });

  if (!fireAtIso) return NextResponse.json({ ok: false, error: "NO_TIME" }, { status: 400 });
  const fireAt = new Date(fireAtIso);
  if (isNaN(fireAt.getTime()) || fireAt.getTime() < Date.now())
    return NextResponse.json({ ok: false, error: "BAD_TIME" }, { status: 400 });

  // 滞在期間内かチェック
  if (fireAt > new Date(reservation.check_out))
    return NextResponse.json({ ok: false, error: "OUT_OF_STAY" }, { status: 400 });

  await supabaseAdmin.from("alarms").insert({
    reservation_id: reservation.id,
    room_id: reservation.room_id,
    fire_at: fireAt.toISOString(),
    is_enabled: true,
  });

  return NextResponse.json({ ok: true, fireAt: fireAt.toISOString() });
}
