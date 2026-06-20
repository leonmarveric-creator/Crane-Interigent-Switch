import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { lightTurnOn, type SwitchBotCreds } from "@/lib/switchbot";
import { logDevice } from "@/lib/deviceControl";

export const runtime = "nodejs";

/**
 * 光目覚まし Cron (1〜5分毎推奨)。
 *  fire_at を過ぎ、まだ triggered_at が無い有効アラームを取得し、
 *  該当部屋の照明をONして triggered_at を記録 (二重点灯防止)。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("alarms")
    .select("id, room_id")
    .eq("is_enabled", true)
    .is("triggered_at", null)
    .lte("fire_at", nowIso);

  let fired = 0;
  for (const alarm of due ?? []) {
    // 二重実行防止: triggered_at を先にCAS的に確保
    const { data: claimed } = await supabaseAdmin
      .from("alarms")
      .update({ triggered_at: nowIso })
      .eq("id", alarm.id)
      .is("triggered_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // 他プロセスが既に処理

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("switchbot_light_device_id, switchbot_token, switchbot_secret")
      .eq("id", alarm.room_id)
      .maybeSingle();
    if (!room?.switchbot_light_device_id) continue;

    const creds: SwitchBotCreds = {
      token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
      secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
    };

    let ok = false;
    try {
      const r = await lightTurnOn(creds, room.switchbot_light_device_id);
      ok = r.ok; // SwitchBotの論理失敗(ok:false)も検知
    } catch (e) {
      console.error("alarm light failed", alarm.id, e);
      ok = false;
    }

    await logDevice({ room_id: alarm.room_id, action: "light_on", source: "cron", success: ok });

    if (ok) {
      fired++;
    } else {
      // 失敗時は triggered_at を戻して次回(数分後)に再試行できるようにする
      await supabaseAdmin.from("alarms").update({ triggered_at: null }).eq("id", alarm.id);
    }
  }

  return NextResponse.json({ ok: true, fired, ranAt: nowIso });
}
