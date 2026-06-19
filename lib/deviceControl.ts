import { sendSesameCommand, SESAME_CMD } from "./sesame";
import {
  acTurnOn, acTurnOff, lightTurnOn, lightTurnOff, type SwitchBotCreds,
} from "./switchbot";

export type DeviceAction =
  | "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off";

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
    default:
      return { ok: false, error: "BAD_ACTION" };
  }
}
