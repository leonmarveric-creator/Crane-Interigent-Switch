import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runIcalSync } from "@/lib/syncIcal";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * iCal 差分同期 Cron。全部屋・全イベントを並列処理して高速化。
 * 同期コアは lib/syncIcal.ts に集約 (管理画面の「今すぐ同期」ボタンと共通)。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 全部屋を並列同期 + チェックアウト自動OFF
  const { summary, cleanedRooms } = await runIcalSync();

  // 古いログ削除 (並列)
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS || "90");
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  // PIN失敗記録は1日より古いものを削除 (ロック判定は直近のみ参照のため)
  const pinCutoff = new Date(Date.now() - 86400000).toISOString();
  const [purgeRes] = await Promise.all([
    retentionDays > 0
      ? supabaseAdmin.from("device_logs").delete({ count: "exact" }).lt("created_at", cutoff)
      : Promise.resolve({ count: null }),
    supabaseAdmin.from("pin_attempts").delete().lt("created_at", pinCutoff),
  ]);

  return NextResponse.json({
    ok: true, summary, cleanedRooms,
    purgedLogs: (purgeRes as any)?.count ?? null,
    ranAt: new Date().toISOString(),
  });
}
