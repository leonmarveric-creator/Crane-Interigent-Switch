import { NextRequest, NextResponse } from "next/server";
import { getActiveStays } from "@/lib/auth";
import { signSession, roomCookieName, signScopedSession } from "@/lib/roomSession";
import { ENTRANCE_SCOPE, entranceCookieName } from "@/lib/smartkey";
import { nameMatches, SESSION_GRACE_MS } from "@/lib/smartkeyLogic";
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
  const { pin, name: rawName } = (await req.json().catch(() => ({}))) as { pin?: string; name?: string };
  const name = String(rawName ?? "").trim().slice(0, 60);
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
  // 同じPINの予約が重なっていたら、入力された名前で絞る
  const hits = entered ? stays.reservations.filter((r) => r.unlock_pin && r.unlock_pin === entered) : [];
  let match = hits[0];
  if (hits.length > 1 && name) {
    const { data: named } = await supabaseAdmin
      .from("reservations").select("id, guest_name, entrance_name").in("id", hits.map((h) => h.id));
    const hit = (named ?? []).find((r: any) => nameMatches(name, r.guest_name) || nameMatches(name, r.entrance_name));
    if (hit) match = hits.find((h) => h.id === hit.id) ?? match;
  }
  if (!match) {
    // 失敗を記録 (次回以降のロックアウト判定に使用)
    await supabaseAdmin.from("pin_attempts").insert({ room_slug: slug });
    return NextResponse.json({ ok: false, error: "BAD_PIN" }, { status: 401 });
  }

  // 認証成功 → その部屋の失敗履歴をクリア (ロックを解除)
  await supabaseAdmin.from("pin_attempts").delete().eq("room_slug", slug);

  // 入力された名前を保存 (部屋画面・エントランス画面の「ようこそ、◯◯様」に使う)
  if (name) {
    await supabaseAdmin.from("reservations")
      .update({ entrance_name: name, entrance_verified_at: new Date().toISOString() })
      .eq("id", match.id)
      .then(() => null, () => null); // 列が未作成でも認証は通す
  }

  const exp = new Date(match.check_out).getTime();
  const token = signSession(match.id, exp);

  const res = NextResponse.json({ ok: true });
  const cookieBase = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  res.cookies.set(roomCookieName(params.room_id), token, { ...cookieBase, expires: new Date(exp) });

  // 同じ棟のエントランスも本人確認なしで使えるように、エントランス用セッションも発行
  try {
    const { data: ents } = await supabaseAdmin
      .from("entrances").select("slug")
      .eq("building", stays.room.building || "Crane Nest").eq("is_active", true);
    const keyExp = exp + SESSION_GRACE_MS;
    for (const e of ents ?? []) {
      res.cookies.set(entranceCookieName(e.slug), signScopedSession(ENTRANCE_SCOPE, match.id, keyExp), {
        ...cookieBase, expires: new Date(keyExp),
      });
    }
  } catch { /* エントランス未設定でも部屋の認証は成功させる */ }
  return res;
}
