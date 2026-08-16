// =========================================================
// POST /api/admin/tank/test-alert
//   WxPusher の通知経路を手動テストする。
//   実通知と同じ dispatchTankAlerts を使うが、alerted フラグは変更しない。
//   管理者Cookie(admin_session)必須。
// =========================================================
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { alertLineLiters, statusFor, tankPct } from "@/lib/stays/tank";
import { dispatchTankAlerts } from "@/lib/stays/tankAlerts";
import { buildResponse } from "@/lib/stays/tankEvaluate";
import { getTankState } from "@/lib/stays/tankStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_ALERT_COOLDOWN_MS = 60_000;
const g = globalThis as unknown as { __tankTestAlertLastSentAt?: number };

export async function POST() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = Date.now();
  const lastSentAt = g.__tankTestAlertLastSentAt || 0;
  if (now - lastSentAt < TEST_ALERT_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "通知テストは1分に1回までです。少し待ってから再実行してください。" },
      { status: 429 }
    );
  }

  try {
    const state = await getTankState();
    const alertLine = alertLineLiters(state.capacityLiters);
    const alert = await dispatchTankAlerts({
      currentLiters: state.currentLiters,
      capacityLiters: state.capacityLiters,
      alertLine,
      pct: tankPct(state.currentLiters, state.capacityLiters),
      status: statusFor(state.currentLiters, state.capacityLiters),
      test: true,
    });

    g.__tankTestAlertLastSentAt = now;

    return NextResponse.json({
      ...(await buildResponse(state)),
      alertDispatched: alert,
      testAlert: true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "通知テストに失敗しました" }, { status: 500 });
  }
}
