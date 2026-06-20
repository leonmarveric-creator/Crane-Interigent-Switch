import { NextRequest, NextResponse } from "next/server";
import { getActiveStays } from "@/lib/auth";
import { signSession, roomCookieName } from "@/lib/roomSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ブルートフォース対策: WINDOW_MIN分間に MAX_FAILS 回失敗したら一時ロック。
// 4桁(1万通り)でも 8回/10分 ≒ 全探索に200時間以上かかり実質不可能。
const WINDOW_MIN = 10;
const MAX_FAILS = 8;

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
  const slug = params.room_id;

  // --- ロックアウト判定: 直近WINDOW_MIN分の失敗回数を確認 ---
  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const { count: failCount } = await supabaseAdmin
    .from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("room_slug", slug)
    .gte("created_at", since);
  if ((failCount ?? 0) >= MAX_FAILS) {
    return NextResponse.json(
      { ok: false, error: "LOCKED", retryAfterMin: WINDOW_MIN },
      { status: 429 }
    );
  }

  const stays = await getActiveStays(slug);
  if (!stays) {
    return NextResponse.json({ ok: false, error: "NO_ACTIVE_STAY" }, { status: 403 });
  }

  const entered = pin?.trim();
  const match = entered
    ? stays.reservations.find((r) => r.unlock_pin && r.unlock_pin === entered)
    : undefined;
  if (!match) {
    // 失敗を記録 (次回以降のロックアウト判定に使用)
    await supabaseAdmin.from("pin_attempts").insert({ room_slug: slug });
    return NextResponse.json({ ok: false, error: "BAD_PIN" }, { status: 401 });
  }

  // 認証成功 → その部屋の失敗履歴をクリア (ロックを解除)
  await supabaseAdmin.from("pin_attempts").delete().eq("room_slug", slug);

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
