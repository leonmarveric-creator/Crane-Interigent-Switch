"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logEntrance } from "@/lib/smartkey";
import { sanitizeSettings, type SmartKeySettings } from "@/lib/smartkeyLogic";

const slugify = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");

/**
 * エントランスを追加 / 更新。
 * 秘密鍵・APIキーは「空欄なら変更しない」(画面に既存値を出さないため)。
 */
export async function saveEntrance(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  const id = String(formData.get("id") || "");
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const display_name = str("display_name");
  const building = str("building");
  if (!display_name || !building) return { ok: false, error: "名前と棟は必須です" };

  const uuid = str("sesame_device_uuid");
  if (uuid && !/^[0-9a-f-]{32,36}$/i.test(uuid)) return { ok: false, error: "Sesame UUID の形式が正しくありません" };
  const secret = str("sesame_secret_key").replace(/\s/g, "");
  if (secret && !/^[0-9a-f]{32}$/i.test(secret)) return { ok: false, error: "シークレットキーは32桁の16進数です" };

  const row: Record<string, unknown> = {
    display_name,
    building,
    is_active: formData.get("is_active") === "on",
    sesame_device_uuid: uuid || null,
    keypad_code: str("keypad_code") || null,
    wifi_ssid: str("wifi_ssid") || null,
    wifi_password: str("wifi_password") || null,
    support_url: str("support_url") || null,
  };
  if (secret) row.sesame_secret_key = secret.toLowerCase();
  if (str("sesame_api_key")) row.sesame_api_key = str("sesame_api_key");
  if (formData.get("clear_secret") === "on") row.sesame_secret_key = null;
  if (formData.get("clear_api_key") === "on") row.sesame_api_key = null;

  if (id) {
    const { error } = await supabaseAdmin.from("entrances").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const slug = slugify(str("slug") || display_name);
    if (!slug) return { ok: false, error: "slug（半角英数とハイフン）を入力してください" };
    const { error } = await supabaseAdmin.from("entrances").insert({ ...row, slug });
    if (error) return { ok: false, error: error.code === "23505" ? "同じ slug のエントランスがあります" : error.message };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** ゲスト画面の設定を保存 (緊急停止の状態はここでは変えない)。 */
export async function saveSmartKeySettings(input: Partial<SmartKeySettings>): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  const s = sanitizeSettings(input);
  const { error } = await supabaseAdmin.from("smartkey_settings").upsert({
    id: 1,
    hold_ms: s.hold_ms,
    countdown_sec: s.countdown_sec,
    show_lock_now: s.show_lock_now,
    show_keypad_code: s.show_keypad_code,
    show_wifi: s.show_wifi,
    show_support: s.show_support,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** 緊急停止 / 再開 (全物件のアプリ解錠)。 */
export async function setAppUnlockEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  const { error } = await supabaseAdmin.from("smartkey_settings")
    .upsert({ id: 1, app_unlock_enabled: enabled, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  await logEntrance({ entrance_id: null, action: enabled ? "resume" : "stop", source: "admin", success: true });
  revalidatePath("/admin");
  return { ok: true };
}
