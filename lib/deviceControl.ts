import { sendSesameCommand, SESAME_CMD } from "./sesame";
import {
  acTurnOn, acTurnOff, acSetAll, lightTurnOn, lightTurnOff, deviceTurnOn, deviceTurnOff, type SwitchBotCreds,
} from "./switchbot";
import { supabaseAdmin } from "./supabaseAdmin";

/** 操作ログを記録 (失敗しても本処理は止めない)。 */
export async function logDevice(entry: {
  room_id: string; reservation_id?: string | null;
  action: string; source: "guest" | "admin" | "cron"; success: boolean;
}) {
  try { await supabaseAdmin.from("device_logs").insert(entry); } catch { /* ignore */ }
}

export type DeviceAction =
  | "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off"
  | "galaxy_on" | "galaxy_off" // ギャラクシーモード: プラネタリウムプロジェクター
  | "welcome" | "away"; // シーン: 快適モード / 外出全OFF

/**
 * 部屋(秘密鍵込み)に対してデバイス操作を実行する共通ロジック。
 * ゲストAPIと管理画面テストの両方から使う。
 */
export async function executeDeviceAction(
  room: any,
  action: DeviceAction,
  historyLabel = "Guest App"
): Promise<{ ok: boolean; error?: string }> {
  const sbCreds: SwitchBotCreds = {
    token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
    secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
  };

  switch (action) {
    case "unlock":
    case "lock": {
      if (!room.sesame_device_uuid || !room.sesame_secret_key || !room.sesame_api_key)
        return { ok: false, error: "NO_LOCK" };
      const r = await sendSesameCommand(
        {
          deviceUuid: room.sesame_device_uuid,
          secretKey: room.sesame_secret_key,
          apiKey: room.sesame_api_key,
        },
        action === "unlock" ? SESAME_CMD.UNLOCK : SESAME_CMD.LOCK,
        historyLabel
      );
      return { ok: r.ok };
    }
    case "ac_on":
    case "ac_off": {
      if (!room.switchbot_ac_device_id) return { ok: false, error: "NO_AC" };
      const r = action === "ac_on"
        ? await acTurnOn(sbCreds, room.switchbot_ac_device_id)
        : await acTurnOff(sbCreds, room.switchbot_ac_device_id);
      return { ok: r.ok };
    }
    case "light_on":
    case "light_off": {
      if (!room.switchbot_light_device_id) return { ok: false, error: "NO_LIGHT" };
      const r = action === "light_on"
        ? await lightTurnOn(sbCreds, room.switchbot_light_device_id)
        : await lightTurnOff(sbCreds, room.switchbot_light_device_id);
      return { ok: r.ok };
    }
    case "galaxy_on":
    case "galaxy_off": {
      if (!room.switchbot_galaxy_device_id) return { ok: false, error: "NO_GALAXY" };
      const r = action === "galaxy_on"
        ? await deviceTurnOn(sbCreds, room.switchbot_galaxy_device_id)
        : await deviceTurnOff(sbCreds, room.switchbot_galaxy_device_id);
      return { ok: r.ok };
    }
    case "welcome": {
      // 快適モード: エアコン適温ON(季節判定) + 照明ON
      let ok = true;
      if (room.switchbot_ac_device_id) {
        const m = Number(new Date().toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Tokyo" }));
        const cool = m >= 5 && m <= 10; // 5〜10月は冷房
        let r = await acSetAll(sbCreds, room.switchbot_ac_device_id,
          { temp: cool ? 26 : 24, mode: cool ? 2 : 5, fan: 1, power: "on" });
        if (!r.ok) r = await acTurnOn(sbCreds, room.switchbot_ac_device_id); // DIY等フォールバック
        ok = ok && r.ok;
      }
      if (room.switchbot_light_device_id) {
        const r = await lightTurnOn(sbCreds, room.switchbot_light_device_id);
        ok = ok && r.ok;
      }
      return { ok };
    }
    case "away": {
      // 外出: エアコン + 照明 + ギャラクシー OFF
      let ok = true;
      if (room.switchbot_ac_device_id) {
        const r = await acTurnOff(sbCreds, room.switchbot_ac_device_id); ok = ok && r.ok;
      }
      if (room.switchbot_light_device_id) {
        const r = await lightTurnOff(sbCreds, room.switchbot_light_device_id); ok = ok && r.ok;
      }
      if (room.switchbot_galaxy_device_id) {
        const r = await deviceTurnOff(sbCreds, room.switchbot_galaxy_device_id); ok = ok && r.ok;
      }
      return { ok };
    }
    default:
      return { ok: false, error: "BAD_ACTION" };
  }
}
