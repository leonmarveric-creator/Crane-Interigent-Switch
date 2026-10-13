/**
 * クライアント側デバイス操作の共通ヘルパー。
 * ゲスト操作画面 (ControlPanel) と和風ライト詳細ページ (WafuDetail) で共有する。
 */

// サーバの DeviceAction (lib/deviceControl.ts) と一致させる。
export type DeviceAction =
  | "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off"
  | "galaxy_on" | "galaxy_off"
  | "nest_on" | "nest_off"
  | "wafu_on" | "wafu_off"
  | "wafu_on_warm" | "wafu_warm"
  | "wafu_brightness" | "wafu_temp" | "wafu_color"
  | "wafu_mode"
  | "welcome" | "welcome_cozy" | "good_night" | "away"
  | "normal"
  | "dream_fade";

/** 「おやすみ」の前に一度だけ挟む確認 (早朝便の自動光目覚まし)。WakeAutoBanner が登録する */
let goodNightGate: null | (() => Promise<void>) = null;
export function setGoodNightGate(fn: null | (() => Promise<void>)) { goodNightGate = fn; }

/**
 * デバイス操作を送信。
 * guest: PIN認証セッションCookie経由 / admin: 管理者Cookieでテスト操作。
 * value: 明るさ("1"〜"100") / 色温度("2700"〜"6500") / 色("R:G:B") 等。
 */
export async function callDevice(
  roomSlug: string,
  action: DeviceAction,
  admin?: boolean,
  value?: string
): Promise<boolean> {
  if (action === "good_night" && goodNightGate) { const g = goodNightGate; goodNightGate = null; await g().catch(() => {}); }
  // 回線が悪いときにボタンが回り続けないよう、20 秒で打ち切る
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
  try {
    const res = await fetch(admin ? "/api/admin/test-device" : `/api/devices/${roomSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(admin ? { roomSlug, action, value } : { action, value }),
      signal: ctrl?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
