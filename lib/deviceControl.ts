import { sendSesameCommand, SESAME_CMD } from "./sesame";
import {
  acTurnOn, acTurnOff, acSetAll, lightTurnOn, lightTurnOff, deviceTurnOn, deviceTurnOff,
  bulbSetBrightness, bulbSetColorTemperature, bulbSetColor, type SwitchBotCreds,
} from "./switchbot";
import { supabaseAdmin } from "./supabaseAdmin";

/** 和風ライトのデフォルト暖色: 電球色 2700K・明るさ100%。 */
export const WAFU_DEFAULT_WARM = { kelvin: 2700, brightness: 100 } as const;

/** 和風ライトを既定の暖色 (2700K・100%) に設定する共通処理。 */
async function applyWafuWarm(creds: SwitchBotCreds, deviceId: string): Promise<boolean> {
  const b = await bulbSetBrightness(creds, deviceId, WAFU_DEFAULT_WARM.brightness);
  const t = await bulbSetColorTemperature(creds, deviceId, WAFU_DEFAULT_WARM.kelvin);
  return b.ok && t.ok;
}

/** シーン共通: エアコンを季節判定で適温ON (冷房/暖房)。デバイス未設定なら true。 */
async function sceneAcComfort(creds: SwitchBotCreds, room: any): Promise<boolean> {
  if (!room.switchbot_ac_device_id) return true;
  const m = Number(new Date().toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Tokyo" }));
  const cool = m >= 5 && m <= 10; // 5〜10月は冷房
  let r = await acSetAll(creds, room.switchbot_ac_device_id,
    { temp: cool ? 26 : 24, mode: cool ? 2 : 5, fan: 1, power: "on" });
  if (!r.ok) r = await acTurnOn(creds, room.switchbot_ac_device_id); // DIY等フォールバック
  return r.ok;
}

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
  | "wafu_on" | "wafu_off" // 和風ライト(行灯): スマート電球 ON/OFF
  | "wafu_on_warm" // ON + 既定の暖色 (管理者ON用)
  | "wafu_warm" // 既定の暖色に戻す (トグルなし)
  | "wafu_brightness" | "wafu_temp" | "wafu_color" // 詳細: 明るさ / 色温度 / フルカラー (value必須)
  | "welcome" | "welcome_cozy" | "away"; // シーン: 快適 / 和み / 外出全OFF

/**
 * 部屋(秘密鍵込み)に対してデバイス操作を実行する共通ロジック。
 * ゲストAPIと管理画面テストの両方から使う。
 * value: 明るさ("1"〜"100") / 色温度("2700"〜"6500") / 色("R:G:B") 等のパラメータ。
 */
export async function executeDeviceAction(
  room: any,
  action: DeviceAction,
  historyLabel = "Guest App",
  value?: string
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
    case "wafu_on":
    case "wafu_off": {
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const r = action === "wafu_on"
        ? await deviceTurnOn(sbCreds, room.switchbot_wafu_device_id)
        : await deviceTurnOff(sbCreds, room.switchbot_wafu_device_id);
      return { ok: r.ok };
    }
    case "wafu_on_warm": {
      // 管理者ON: 点灯してから既定の暖色 (2700K・100%) に。
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const on = await deviceTurnOn(sbCreds, room.switchbot_wafu_device_id);
      const warm = await applyWafuWarm(sbCreds, room.switchbot_wafu_device_id);
      return { ok: on.ok && warm };
    }
    case "wafu_warm": {
      // 色だけ既定の暖色に戻す (ON/OFFは変更しない)。
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const ok = await applyWafuWarm(sbCreds, room.switchbot_wafu_device_id);
      return { ok };
    }
    case "wafu_brightness": {
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const r = await bulbSetBrightness(sbCreds, room.switchbot_wafu_device_id, Number(value));
      return { ok: r.ok };
    }
    case "wafu_temp": {
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const r = await bulbSetColorTemperature(sbCreds, room.switchbot_wafu_device_id, Number(value));
      return { ok: r.ok };
    }
    case "wafu_color": {
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const r = await bulbSetColor(sbCreds, room.switchbot_wafu_device_id, String(value ?? ""));
      return { ok: r.ok };
    }
    case "welcome": {
      // 快適モード: エアコン適温ON(季節判定) + メイン照明ON
      let ok = await sceneAcComfort(sbCreds, room);
      if (room.switchbot_light_device_id) {
        const r = await lightTurnOn(sbCreds, room.switchbot_light_device_id);
        ok = ok && r.ok;
      }
      return { ok };
    }
    case "welcome_cozy": {
      // 和みモード: エアコン適温ON + 和風ライトを暖色で点灯 (メイン照明は点けない)
      let ok = await sceneAcComfort(sbCreds, room);
      if (room.switchbot_wafu_device_id) {
        const on = await deviceTurnOn(sbCreds, room.switchbot_wafu_device_id);
        const warm = await applyWafuWarm(sbCreds, room.switchbot_wafu_device_id);
        ok = ok && on.ok && warm;
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
      if (room.switchbot_wafu_device_id) {
        const r = await deviceTurnOff(sbCreds, room.switchbot_wafu_device_id); ok = ok && r.ok;
      }
      return { ok };
    }
    default:
      return { ok: false, error: "BAD_ACTION" };
  }
}
