import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  bulbSetBrightness,
  bulbSetColorTemperature,
  deviceTurnOff,
  deviceTurnOn,
  lightTurnOn,
  type SwitchBotCreds,
} from "@/lib/switchbot";
import { logDevice } from "@/lib/deviceControl";
import { getWafuPrewakeStep, PREWAKE_WINDOW_MS } from "@/lib/wakePrewake";

export const runtime = "nodejs";

/**
 * 光目覚まし Cron (1〜5分毎推奨)。
 *  fire_at を過ぎ、まだ triggered_at が無い有効アラームを取得し、
 *  該当部屋の照明をONして triggered_at を記録 (二重点灯防止)。
 *  Horizon Rise は10分前から和風ライトを段階的に明るくし、
 *  メインライト点灯5分後に和風ライトだけを消灯する。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const prewakeUntilIso = new Date(nowMs + PREWAKE_WINDOW_MS).toISOString();
  const { data: prewakeDue } = await supabaseAdmin
    .from("alarms")
    .select("id, room_id, fire_at, wafu_prewake_started_at, wafu_prewake_step")
    .eq("is_enabled", true)
    .eq("wake_mode", "horizon_rise")
    .is("triggered_at", null)
    .gt("fire_at", nowIso)
    .lte("fire_at", prewakeUntilIso);

  let prewaked = 0;
  for (const alarm of prewakeDue ?? []) {
    const currentStep = Number(alarm.wafu_prewake_step ?? 0);
    const next = getWafuPrewakeStep(nowMs, new Date(alarm.fire_at).getTime(), currentStep);
    if (!next) continue;

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("switchbot_wafu_device_id, switchbot_token, switchbot_secret")
      .eq("id", alarm.room_id)
      .maybeSingle();
    if (!room?.switchbot_wafu_device_id) continue;

    const { data: claimed } = await supabaseAdmin
      .from("alarms")
      .update({
        wafu_prewake_started_at: alarm.wafu_prewake_started_at ?? nowIso,
        wafu_prewake_step: next.step,
      })
      .eq("id", alarm.id)
      .lt("wafu_prewake_step", next.step)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const creds: SwitchBotCreds = {
      token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
      secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
    };

    let ok = false;
    try {
      const on = await deviceTurnOn(creds, room.switchbot_wafu_device_id);
      const temp = await bulbSetColorTemperature(creds, room.switchbot_wafu_device_id, 2700);
      const brightness = await bulbSetBrightness(creds, room.switchbot_wafu_device_id, next.brightness);
      ok = on.ok && temp.ok && brightness.ok;
    } catch (e) {
      console.error("wafu prewake failed", alarm.id, e);
      ok = false;
    }

    await logDevice({ room_id: alarm.room_id, action: "wafu_prewake", source: "cron", success: ok });

    if (ok) {
      prewaked++;
    } else {
      await supabaseAdmin
        .from("alarms")
        .update({
          wafu_prewake_started_at: currentStep > 0 ? alarm.wafu_prewake_started_at : null,
          wafu_prewake_step: currentStep,
        })
        .eq("id", alarm.id)
        .eq("wafu_prewake_step", next.step);
    }
  }

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

  const { data: autoOffDue } = await supabaseAdmin
    .from("alarms")
    .select("id, room_id")
    .eq("is_enabled", true)
    .eq("wake_mode", "horizon_rise")
    .not("triggered_at", "is", null)
    .is("wafu_auto_off_completed_at", null)
    .lte("wafu_auto_off_at", nowIso);

  let wafuAutoOff = 0;
  for (const alarm of autoOffDue ?? []) {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("switchbot_wafu_device_id, switchbot_token, switchbot_secret")
      .eq("id", alarm.room_id)
      .maybeSingle();
    if (!room?.switchbot_wafu_device_id) continue;

    const { data: claimed } = await supabaseAdmin
      .from("alarms")
      .update({ wafu_auto_off_completed_at: nowIso })
      .eq("id", alarm.id)
      .is("wafu_auto_off_completed_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const creds: SwitchBotCreds = {
      token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
      secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
    };

    let ok = false;
    try {
      const result = await deviceTurnOff(creds, room.switchbot_wafu_device_id);
      ok = result.ok;
    } catch (e) {
      console.error("wafu wake auto-off failed", alarm.id, e);
      ok = false;
    }

    await logDevice({ room_id: alarm.room_id, action: "wafu_wake_auto_off", source: "cron", success: ok });

    if (ok) {
      wafuAutoOff++;
    } else {
      await supabaseAdmin
        .from("alarms")
        .update({ wafu_auto_off_completed_at: null })
        .eq("id", alarm.id)
        .eq("wafu_auto_off_completed_at", nowIso);
    }
  }

  return NextResponse.json({ ok: true, fired, prewaked, wafuAutoOff, ranAt: nowIso });
}
