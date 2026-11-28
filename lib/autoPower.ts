/**
 * 「自動 ON / 自動 OFF」に当たる操作か (演出・通知を出すもの)。device_logs の action / source / 予約 から決める。
 *   ON : 到着前の自動準備 (cron の welcome) / お迎えの乗車でエアコン (ac_comfort) / お父さんの「準備」(予約つきの welcome)
 *   OFF: お見送りで離れたときの自動 OFF (drive_off) / チェックアウトの自動 OFF / ゲストのチェックアウトボタン / お父さんの「全部 OFF」(予約つき)
 *   管理画面のデバイステストなど、予約の無い手での操作は出さない
 */
export type AutoKind = "on" | "off";
export function autoKind(action: string, source: string, reservationId?: string | null): AutoKind | null {
  if (action === "ac_comfort" && source === "admin") return "on";
  if ((action === "welcome" || action === "welcome_cozy") && (source === "cron" || !!reservationId)) return "on";
  if (action === "drive_off" || action === "auto_checkout_off") return "off";
  if (action === "checkout" && source === "guest") return "off";
  if (action === "away" && !!reservationId) return "off";
  return null;
}
/** 演出で光らせる機器 */
export const autoParts = (action: string, has: string[]): string[] =>
  action === "ac_comfort" ? ["ac"] : action === "welcome" ? has.filter((p) => p === "ac" || p === "ceil") : action === "welcome_cozy" ? has.filter((p) => p === "ac" || p === "wa") : has;
export const AUTO_LABEL: Record<string, string> = {
  ac_comfort: "お迎えの乗車でエアコン", welcome: "到着前の準備", welcome_cozy: "到着前の準備（和み）",
  drive_off: "お見送りで出発したので自動OFF", auto_checkout_off: "チェックアウトの自動OFF", checkout: "ゲストがチェックアウト", away: "全部OFF",
};
