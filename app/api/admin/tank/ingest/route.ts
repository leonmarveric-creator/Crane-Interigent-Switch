// =========================================================
// POST /api/admin/tank/ingest
//   生のメール（件名＋本文）を直接投入して解析・反映する入口。
//   用途:
//     - メール転送Webhook（Airbnbメールを転送 → 解析）
//     - スタッフによる手動貼り付け / 動作テスト
//   Gmail連携(GMAIL_*)が使えない環境でも、この経路でAirbnb予約を取り込める。
//   管理者Cookie(admin_session)必須。
//
//   body: { subject: string, body: string }
//      or { emails: { subject, body, id? }[] }
// =========================================================
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { parseAirbnbEmail } from "@/lib/stays/airbnbEmail";
import { upsertExternalReservation } from "@/lib/stays/tankStore";
import { evaluateAndAlert } from "@/lib/stays/tankEvaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const items: { subject?: string; body?: string; id?: string }[] = Array.isArray(body?.emails)
      ? body.emails
      : [{ subject: body?.subject, body: body?.body, id: body?.id }];

    const results: any[] = [];
    let parsed = 0;
    for (const it of items) {
      const r = parseAirbnbEmail(it.subject || "", it.body || "");
      if (!r) {
        results.push({ ok: false, reason: "予約メールとして解析できませんでした" });
        continue;
      }
      await upsertExternalReservation(r, it.id);
      parsed++;
      results.push({ ok: true, code: r.code, status: r.status, guests: r.guests, checkIn: r.checkIn, checkOut: r.checkOut });
    }

    const { response, alert } = await evaluateAndAlert();
    return NextResponse.json({ ...response, alertDispatched: alert, ingest: { parsed, results } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "取り込みに失敗しました" }, { status: 500 });
  }
}
