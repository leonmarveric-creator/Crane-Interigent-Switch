/**
 * Dream Fade の Cron 処理 (サーバ専用)。wake-alarm Cron (1〜2 分毎) から呼ぶので、
 * cron-job.org などに新しいジョブを追加する必要はない。
 *   rooms.dream_fade_started_at がある部屋について、経過時間から今の段階を計算し、
 *   和風ライトの色と明るさを反映する。30 分を過ぎたら消灯して終了。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bulbSetBrightness, bulbSetColor, bulbSetColorTemperature, deviceTurnOff, type SwitchBotCreds } from "@/lib/switchbot";
import { logDevice } from "@/lib/deviceControl";
import { dreamFadeColorChanged, dreamFadeTarget } from "@/lib/dreamFade";

export async function runDreamFade(nowMs = Date.now()): Promise<{ stepped: number; finished: number; failed: number }> {
  const res = { stepped: 0, finished: 0, failed: 0 };
  const { data: rooms, error } = await supabaseAdmin
    .from("rooms")
    .select("id, switchbot_wafu_device_id, switchbot_token, switchbot_secret, dream_fade_started_at, dream_fade_step")
    .not("dream_fade_started_at", "is", null);
  if (error || !rooms) return res; // 列が無い (SQL 未実行) ときは何もしない

  for (const room of rooms as any[]) {
    const startedAt = String(room.dream_fade_started_at);
    const current = Number(room.dream_fade_step ?? 0);
    const target = dreamFadeTarget(nowMs - new Date(startedAt).getTime());
    if (target.step <= current) continue;

    if (!room.switchbot_wafu_device_id) {
      await supabaseAdmin.from("rooms").update({ dream_fade_started_at: null, dream_fade_step: 0 }).eq("id", room.id);
      continue;
    }

    // 二重実行防止: 段階を先に確保 (途中で他の操作により解除されていたら何もしない)
    const { data: claimed } = await supabaseAdmin
      .from("rooms")
      .update(target.done ? { dream_fade_started_at: null, dream_fade_step: 0 } : { dream_fade_step: target.step })
      .eq("id", room.id)
      .eq("dream_fade_started_at", startedAt)
      .eq("dream_fade_step", current)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const creds: SwitchBotCreds = {
      token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
      secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
    };
    let ok = false;
    try {
      if (target.done) {
        ok = (await deviceTurnOff(creds, room.switchbot_wafu_device_id)).ok;
      } else {
        let colorOk = true;
        if (dreamFadeColorChanged(current, target)) {
          colorOk = target.color.kind === "temp"
            ? (await bulbSetColorTemperature(creds, room.switchbot_wafu_device_id, target.color.kelvin)).ok
            : (await bulbSetColor(creds, room.switchbot_wafu_device_id, target.color.rgb)).ok;
        }
        const b = await bulbSetBrightness(creds, room.switchbot_wafu_device_id, target.brightness);
        ok = colorOk && b.ok;
      }
    } catch (e) {
      console.error("dream fade step failed", room.id, e);
    }
    await logDevice({ room_id: room.id, action: target.done ? "dream_fade_off" : "dream_fade_step", source: "cron", success: ok });

    if (ok) { if (target.done) res.finished++; else res.stepped++; continue; }
    res.failed++;
    // 失敗したら元の段階に戻して、次の Cron で再試行
    const back = supabaseAdmin.from("rooms")
      .update({ dream_fade_started_at: startedAt, dream_fade_step: current })
      .eq("id", room.id);
    await (target.done
      ? back.is("dream_fade_started_at", null) // その間に別の操作があれば戻さない
      : back.eq("dream_fade_started_at", startedAt).eq("dream_fade_step", target.step));
  }
  return res;
}
