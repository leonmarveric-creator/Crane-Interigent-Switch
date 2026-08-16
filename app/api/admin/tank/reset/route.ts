// =========================================================
// POST /api/admin/tank/reset
//   バキュームカーによる汲み取り完了時に呼ぶ。
//   前回汲み取り日を「今日」に更新し、以降の宿泊夜だけを加算対象にする（=0Lに戻る）。
//   （UI側で確認ダイアログを挟む前提。誤操作防止のため GET では実行しない）
//   管理者Cookie(admin_session)必須。
// =========================================================
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { resetTank } from "@/lib/stays/tankStore";
import { buildResponse } from "@/lib/stays/tankEvaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const state = await resetTank();
    return NextResponse.json(await buildResponse(state));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "リセットに失敗しました" }, { status: 500 });
  }
}
