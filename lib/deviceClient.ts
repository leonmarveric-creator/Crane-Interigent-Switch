/**
 * クライアント側デバイス操作の共通ヘルパー。
 * ゲスト操作画面 (ControlPanel) と和風ライト詳細ページ (WafuDetail) で共有する。
 */

// サーバの DeviceAction (lib/deviceControl.ts) と一致させる。
export type DeviceAction =
  | "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off"
  | "galaxy_on" | "galaxy_off"
  | "wafu_on" | "wafu_off"
  | "wafu_on_warm" | "wafu_warm"
  | "wafu_brightness" | "wafu_temp" | "wafu_color"
  | "welcome" | "welcome_cozy" | "away";

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
  const res = await fetch(admin ? "/api/admin/test-device" : `/api/devices/${roomSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(admin ? { roomSlug, action, value } : { action, value }),
  });
  return res.ok;
}
