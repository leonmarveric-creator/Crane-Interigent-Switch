// =========================================================
// /api/admin/tank/sync
//   Gmail から Airbnb の予約確定/キャンセルメールを取得・解析し、
//   stays_ext_reservations に反映（confirmed→cancelled も追跡）。
//   その後タンクを再計算し、80%超過を検知したら WxPusher 通知する。
//
//   POST … 画面の「Airbnb同期」ボタンから手動実行（管理者Cookie必須）
//   GET  … Cron からの自動実行用。CRON_SECRET を Authorization: Bearer か
//          ?key= で認証（Switch既存のcronと同じ方式）。
//   GMAIL_* 未設定時は skipped を返す（アプリは落ちない）。
// =========================================================
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { fetchAirbnbEmails } from "@/lib/stays/gmail";
import { parseAirbnbEmail } from "@/lib/stays/airbnbEmail";
import { upsertExternalReservation } from "@/lib/stays/tankStore";
import { evaluateAndAlert } from "@/lib/stays/tankEvaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runSync() {
  const gmail = await fetchAirbnbEmails();

  let parsed = 0;
  let confirmed = 0;
  let cancelled = 0;
  let ignored = 0;

  for (const email of gmail.emails) {
    const r = parseAirbnbEmail(email.subject, email.body);
    if (!r) {
      ignored++;
      continue;
    }
    await upsertExternalReservation(r, email.id);
    parsed++;
    if (r.status === "cancelled") cancelled++;
    else confirmed++;
  }

  const { response, alert } = await evaluateAndAlert();

  return {
    ...response,
    alertDispatched: alert,
    sync: {
      gmail: { ok: gmail.ok, skipped: gmail.skipped, error: gmail.error },
      fetched: gmail.emails.length,
      parsed,
      confirmed,
      cancelled,
      ignored,
    },
  };
}

// 手動同期（画面のボタン）— 管理者Cookie必須
export async function POST() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runSync());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "同期に失敗しました" }, { status: 500 });
  }
}

// 自動同期（Cron）。CRON_SECRET を Bearer か ?key= で認証。
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runSync());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "同期に失敗しました" }, { status: 500 });
  }
}
