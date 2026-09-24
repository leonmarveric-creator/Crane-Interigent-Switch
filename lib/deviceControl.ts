import { sendSesameCommand, SESAME_CMD } from "./sesame";
import {
  acTurnOn, acTurnOff, acSetAll, lightTurnOn, lightTurnOff, deviceTurnOn, deviceTurnOff,
  bulbSetBrightness, bulbSetColorTemperature, bulbSetColor, type SwitchBotCreds,
} from "./switchbot";
import { supabaseAdmin } from "./supabaseAdmin";
import { DREAM_FADE_START } from "./dreamFade";

/** 和風ライトのデフォルト暖色: 電球色 2700K・明るさ100%。 */
export const WAFU_DEFAULT_WARM = { kelvin: 2700, brightness: 100 } as const;
export const GALAXY_AUTO_OFF_MS = 60 * 60 * 1000; // ギャラクシーモードは ON から 60 分で自動 OFF

async function setGalaxyAutoOffAt(
  room: any,
  galaxy_auto_off_at: string | null,
  expectedAutoOffAt?: string
): Promise<boolean> {
  if (!room.id) return true;

  let q = supabaseAdmin
    .from("rooms")
    .update({ galaxy_auto_off_at })
    .eq("id", room.id);
  if (expectedAutoOffAt) q = q.eq("galaxy_auto_off_at", expectedAutoOffAt);

  const { error } = await q;
  if (error) {
    console.error("galaxy auto-off update failed", error);
    return false;
  }
  return true;
}

/**
 * Dream Fade の進行状態 (rooms.dream_fade_started_at / dream_fade_step) を設定・解除する。
 * migration_dream_fade.sql 未実行で列が無い場合は false。
 */
async function setDreamFade(room: any, startedAt: string | null): Promise<boolean> {
  if (!room.id) return true;
  const { error } = await supabaseAdmin
    .from("rooms")
    .update({ dream_fade_started_at: startedAt, dream_fade_step: 0 })
    .eq("id", room.id);
  if (error) { console.error("dream fade update failed", error); return false; }
  return true;
}

/** 灯りを操作したら Dream Fade を止める (実行中の部屋だけ。失敗しても本処理は止めない) */
const DREAM_FADE_CANCEL: ReadonlySet<string> = new Set([
  "light_on", "light_off", "galaxy_on", "galaxy_off", "nest_on", "nest_off",
  "wafu_on", "wafu_off", "wafu_on_warm", "wafu_warm", "wafu_brightness", "wafu_temp", "wafu_color",
  "welcome", "welcome_cozy", "good_night", "away", "normal",
]);
async function cancelDreamFade(room: any) {
  if (!room.id) return;
  try {
    await supabaseAdmin.from("rooms").update({ dream_fade_started_at: null, dream_fade_step: 0 })
      .eq("id", room.id).not("dream_fade_started_at", "is", null);
  } catch { /* 列が無い等は無視 */ }
}

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
  | "nest_on" | "nest_off" // NESTモード: 藤編みボールランプ(間接照明)
  | "wafu_on" | "wafu_off" // 和風ライト(行灯): スマート電球 ON/OFF
  | "wafu_on_warm" // ON + 既定の暖色 (管理者ON用)
  | "wafu_warm" // 既定の暖色に戻す (トグルなし)
  | "wafu_brightness" | "wafu_temp" | "wafu_color" // 詳細: 明るさ / 色温度 / フルカラー (value必須)
  | "welcome" | "welcome_cozy" | "good_night" | "away"
  | "normal" // シーン: 快適 / 和み / おやすみ / 外出全OFF
  | "dream_fade"; // Dream Fade: 和風ライトだけにして 30 分でゆっくり消灯

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

  if (DREAM_FADE_CANCEL.has(action) && room.dream_fade_started_at !== null) await cancelDreamFade(room);

  // 「ついでに消す」灯り。複数の機器は同時に送る (IR はライブラリ側で 1 つずつ順番に送信)。
  // 失敗しても例外にせず false を返す (ベストエフォート)。
  const safe = async (fn: () => Promise<boolean>) => { try { return await fn(); } catch { return false; } };
  const offLight = () => safe(async () => !room.switchbot_light_device_id || (await lightTurnOff(sbCreds, room.switchbot_light_device_id)).ok);
  const offNest = () => safe(async () => !room.switchbot_nest_device_id || (await deviceTurnOff(sbCreds, room.switchbot_nest_device_id)).ok);
  const offWafu = () => safe(async () => !room.switchbot_wafu_device_id || (await deviceTurnOff(sbCreds, room.switchbot_wafu_device_id)).ok);
  const offGalaxy = () => safe(async () => {
    if (!room.switchbot_galaxy_device_id) return true;
    const r = await deviceTurnOff(sbCreds, room.switchbot_galaxy_device_id);
    if (r.ok) await setGalaxyAutoOffAt(room, null);
    return r.ok;
  });

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
      // ギャラクシーON時は、星空を引き立てるため他のライト(通常/NEST/和風)を消灯する。
      // 消灯の失敗はギャラクシー本体の結果に影響させない(ベストエフォート)。
      if (action === "galaxy_on" && r.ok) {
        await Promise.all([offLight(), offNest(), offWafu()]);
        const autoOffAt = new Date(Date.now() + GALAXY_AUTO_OFF_MS).toISOString();
        const scheduled = await setGalaxyAutoOffAt(room, autoOffAt);
        return { ok: scheduled, error: scheduled ? undefined : "GALAXY_AUTO_OFF_FAILED" };
      }
      if (action === "galaxy_off" && r.ok) {
        const cleared = await setGalaxyAutoOffAt(room, null, value);
        return { ok: cleared, error: cleared ? undefined : "GALAXY_AUTO_OFF_CLEAR_FAILED" };
      }
      return { ok: r.ok };
    }
    case "nest_on":
    case "nest_off": {
      // NESTモード: 藤編みボールランプを ON/OFF。
      // ON のときは、藤の灯りを引き立てるため他のライト(通常/ギャラクシー/和風)を消灯する (ベストエフォート)。
      if (!room.switchbot_nest_device_id) return { ok: false, error: "NO_NEST" };
      const r = action === "nest_on"
        ? await deviceTurnOn(sbCreds, room.switchbot_nest_device_id)
        : await deviceTurnOff(sbCreds, room.switchbot_nest_device_id);
      if (action === "nest_on" && r.ok) {
        await Promise.all([offLight(), offGalaxy(), offWafu()]);
      }
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
      const [ac, light] = await Promise.all([
        safe(() => sceneAcComfort(sbCreds, room)),
        safe(async () => !room.switchbot_light_device_id || (await lightTurnOn(sbCreds, room.switchbot_light_device_id)).ok),
      ]);
      return { ok: ac && light };
    }
    case "welcome_cozy": {
      // 和みモード: エアコン適温ON + 和風ライトを暖色で点灯。
      // 和みの雰囲気を出すため、和風以外のライト(通常照明/ギャラクシー/NEST)は消灯する。
      // 消灯はベストエフォート(失敗しても和みモード全体の結果には影響させない)。
      const [ac, wafu] = await Promise.all([
        safe(() => sceneAcComfort(sbCreds, room)),
        safe(async () => {
          if (!room.switchbot_wafu_device_id) return true;
          const on = await deviceTurnOn(sbCreds, room.switchbot_wafu_device_id);
          const warm = await applyWafuWarm(sbCreds, room.switchbot_wafu_device_id);
          return on.ok && warm;
        }),
        offLight(), offGalaxy(), offNest(),
      ]);
      return { ok: ac && wafu };
    }
    case "normal": {
      // ノーマル: ギャラクシー / NEST / 和み などから「メインライトだけ点灯」の状態に戻す。
      // エアコンはそのまま。メインライトの点灯結果を返し、他ライトの消灯はベストエフォート。
      const [ok] = await Promise.all([
        safe(async () => !room.switchbot_light_device_id || (await lightTurnOn(sbCreds, room.switchbot_light_device_id)).ok),
        offGalaxy(), offNest(), offWafu(),
      ]);
      return { ok };
    }
    case "dream_fade": {
      // Dream Fade: 和風ライト以外の灯りを消し、和風ライトだけを暖色 (2700K・60%) で点灯。
      // 以後 30 分かけて Cron が少しずつ暗くし、最後に消灯する。エアコンはそのまま。
      if (!room.switchbot_wafu_device_id) return { ok: false, error: "NO_WAFU" };
      const [wafu] = await Promise.all([
        safe(async () => {
          const on = await deviceTurnOn(sbCreds, room.switchbot_wafu_device_id);
          const t = await bulbSetColorTemperature(sbCreds, room.switchbot_wafu_device_id, DREAM_FADE_START.kelvin);
          const b = await bulbSetBrightness(sbCreds, room.switchbot_wafu_device_id, DREAM_FADE_START.brightness);
          return on.ok && t.ok && b.ok;
        }),
        offLight(), offGalaxy(), offNest(),
      ]);
      if (!wafu) return { ok: false };
      const saved = await setDreamFade(room, new Date().toISOString());
      return saved ? { ok: true } : { ok: false, error: "DREAM_FADE_SQL_NEEDED" };
    }
    case "good_night": {
      // おやすみ: エアコンは維持し、部屋のライト系だけをまとめて消灯する。
      const all = await Promise.all([offLight(), offGalaxy(), offNest(), offWafu()]);
      return { ok: all.every(Boolean) };
    }
    case "away": {
      // 外出: エアコン + 照明 + ギャラクシー + NEST OFF
      const all = await Promise.all([
        safe(async () => !room.switchbot_ac_device_id || (await acTurnOff(sbCreds, room.switchbot_ac_device_id)).ok),
        offLight(), offGalaxy(), offNest(), offWafu(),
      ]);
      return { ok: all.every(Boolean) };
    }
    default:
      return { ok: false, error: "BAD_ACTION" };
  }
}
