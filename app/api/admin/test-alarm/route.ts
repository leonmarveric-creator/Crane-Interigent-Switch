import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * 管理画面テストページからの光目覚まし設定/解除 (ホスト専用・PIN不要)。
 * ゲスト用 /api/alarms/[room_id] と同じ挙動だが、予約(滞在)に紐付けず
 * reservation_id = null のテスト用アラームとして保存する。
 * wake-alarm Cron は room_id だけを見るため点灯動作は本番と同じ。
 * POST /api/admin/test-alarm  body: { roomSlug, fireAtIso } または { roomSlug, clear:true }
 */
export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { roomSlug, fireAtIso, clear } = (await req.json().catch(() => ({}))) as {
    roomSlug?: string;
    fireAtIso?: string;
    clear?: boolean;
  };

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id")
    .eq("slug", roomSlug)
    .maybeSingle();
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });

  // この部屋のテスト用アラーム(予約なし)は1件運用: 既存を削除してから入れ直す
  await supabaseAdmin
    .from("alarms")
    .delete()
    .eq("room_id", room.id)
    .is("reservation_id", null);

  if (clear) return NextResponse.json({ ok: true, cleared: true });

  if (!fireAtIso) return NextResponse.json({ ok: false, error: "NO_TIME" }, { status: 400 });
  const fireAt = new Date(fireAtIso);
  if (isNaN(fireAt.getTime()) || fireAt.getTime() < Date.now())
    return NextResponse.json({ ok: false, error: "BAD_TIME" }, { status: 400 });

  // テストモードなので滞在期間(チェックアウト)チェックは行わない。
  await supabaseAdmin.from("alarms").insert({
    reservation_id: null,
    room_id: room.id,
    fire_at: fireAt.toISOString(),
    is_enabled: true,
  });

  return NextResponse.json({ ok: true, fireAt: fireAt.toISOString() });
}
