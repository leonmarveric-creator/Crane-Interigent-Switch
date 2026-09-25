/**
 * ハイテクUI の起動の声 (管理画面で切り替え)。サーバ専用。
 *   astralis = 「ASTRALIS system online」 (既定) / jarvis = 従来の J.A.R.V.I.S 系 3 種類
 *   migration_boot_voice.sql 未実行なら既定 (astralis)。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BootVoice = "astralis" | "jarvis";
export const BOOT_VOICES: BootVoice[] = ["astralis", "jarvis"];

export async function getBootVoice(): Promise<BootVoice> {
  try {
    const { data, error } = await supabaseAdmin.from("app_settings").select("boot_voice").eq("id", 1).maybeSingle();
    if (error || !data) return "astralis";
    return (data as any).boot_voice === "jarvis" ? "jarvis" : "astralis";
  } catch {
    return "astralis";
  }
}
