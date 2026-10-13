/**
 * お部屋に着いたときの明かり (ゲストがコンシェルジュで選ぶ: 和の灯り / ふつうの明かり)
 * - 送迎中 (まだ部屋に入っていない) に選ぶ → 予約に保存するだけ (電気はつけない)
 * - 初めて鍵を開けたときの自動ウェルカムで、選んだ明かりをつける (選んでいなければ和の灯り)
 * - 部屋に入ったあと (welcomed_at あり) に選ぶ → その場で切り替える
 * reservations.light_pref (migration_light_pref.sql)。列がまだ無くても動く (和の灯りになる)
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DeviceAction } from "@/lib/deviceControl";

export type LightPref = "wafu" | "normal";
export const isLightPref = (v: unknown): v is LightPref => v === "wafu" || v === "normal";

/** 初回解錠のウェルカム: 和風ライトがある部屋は、選んだ明かり (未選択は和の灯り) + エアコン */
export function welcomeActionFor(room: any, pref: LightPref | null): DeviceAction {
  if (!room?.switchbot_wafu_device_id) return "welcome";
  return pref === "normal" ? "welcome" : "welcome_cozy";
}

export async function readLightPref(resId: string | null | undefined): Promise<LightPref | null> {
  if (!resId) return null;
  const { data, error } = await supabaseAdmin.from("reservations").select("light_pref").eq("id", resId).maybeSingle();
  if (error || !data) return null;
  return isLightPref((data as any).light_pref) ? (data as any).light_pref : null;
}

/** 保存できたら true (列がまだ無いと false) */
export async function saveLightPref(resId: string, pref: LightPref): Promise<boolean> {
  const { error } = await supabaseAdmin.from("reservations").update({ light_pref: pref }).eq("id", resId);
  return !error;
}

/** コンシェルジュに出す情報: 選んだ明かり + もう部屋に入ったか */
export async function lightState(resId: string): Promise<{ pref: LightPref | null; arrived: boolean }> {
  let r = await supabaseAdmin.from("reservations").select("welcomed_at, light_pref").eq("id", resId).maybeSingle();
  if (r.error) r = await supabaseAdmin.from("reservations").select("welcomed_at").eq("id", resId).maybeSingle() as any;
  const d: any = r.data ?? {};
  return { pref: isLightPref(d.light_pref) ? d.light_pref : null, arrived: !!d.welcomed_at };
}
