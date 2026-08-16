// =========================================================
// し尿タンク モニタリング API（自社/手動予約＋Airbnbを統合して自動計算）
//   GET  /api/admin/tank   … 再計算した現在状態＋サマリーを返す（副作用なし）
//   POST /api/admin/tank   … 再評価し、80%超過を検知したら WxPusher 通知。
//                            body に { date, guests } で手動補正(override)を設定、
//                            { date, guests: null } で補正を解除。
//
//   いずれも管理者Cookie(admin_session)必須。
// =========================================================
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { getTankState, setOverride } from "@/lib/stays/tankStore";
import { buildResponse, evaluateAndAlert } from "@/lib/stays/tankEvaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return !token || token !== process.env.ADMIN_SESSION_TOKEN;
}

// ---- GET：現在状態（予約から自動計算） ----
export async function GET() {
  if (unauthorized()) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const state = await getTankState();
    return NextResponse.json(await buildResponse(state));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "取得に失敗しました" }, { status: 500 });
  }
}

// ---- POST：再評価（＋任意で手動補正） → 必要なら通知 ----
export async function POST(req: NextRequest) {
  if (unauthorized()) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const hasOverride = body && typeof body === "object" && "guests" in body && "date" in body;

    if (hasOverride) {
      const date: string = body.date || new Date().toISOString().slice(0, 10);
      const guests = body.guests === null ? null : Number(body.guests);
      if (guests !== null && (!Number.isFinite(guests) || guests < 0)) {
        return NextResponse.json({ error: "guests は0以上の数値、または null で指定してください" }, { status: 400 });
      }
      await setOverride(date, guests);
    }

    const { response, alert } = await evaluateAndAlert();
    return NextResponse.json({ ...response, alertDispatched: alert });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "更新に失敗しました" }, { status: 500 });
  }
}
