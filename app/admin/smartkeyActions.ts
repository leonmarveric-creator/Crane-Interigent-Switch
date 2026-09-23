"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logEntrance } from "@/lib/smartkey";
import { sanitizeSettings, type SmartKeySettings } from "@/lib/smartkeyLogic";
import { assignEntranceLock } from "./sesameActions";

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

  const row: Record<string, unknown> = {
    display_name,
    building,
    is_active: formData.get("is_active") === "on",
    keypad_code: str("keypad_code") || null,
    wifi_ssid: str("wifi_ssid") || null,
    wifi_password: str("wifi_password") || null,
    support_url: str("support_url") || null,
  };
  // 位置制限 (空欄 = なし)。列が無い (migration 未実行) 場合は別に扱う
  const numOrNull = (k: string) => { const v = str(k); if (!v) return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  const lat = numOrNull("lat"), lng = numOrNull("lng");
  const radius = Math.round(Number(str("geofence_radius_m") || 100));
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat !== null && Math.abs(lat) > 90) || (lng !== null && Math.abs(lng) > 180)) {
    return { ok: false, error: "緯度・経度の数字が正しくありません" };
  }
  if ((lat === null) !== (lng === null)) return { ok: false, error: "緯度と経度は両方入力してください（または両方空欄）" };
  if (!(radius >= 20 && radius <= 2000)) return { ok: false, error: "半径は 20〜2000m にしてください" };
  const geo = formData.has("lat") ? { lat, lng, geofence_radius_m: radius } : null;

  // Sesame は「Sesame 一覧」から選ぶ ("__keep" = 変更しない / "" = なし)
  const lockSel = formData.has("sesame_lock_id") ? String(formData.get("sesame_lock_id") ?? "") : "__keep";

  if (id) {
    const { error } = await supabaseAdmin.from("entrances").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
    const a = await assignEntranceLock(id, lockSel);
    if (!a.ok) return a;
    const g = await saveGeo(id, geo);
    if (!g.ok) return g;
  } else {
    const slug = slugify(str("slug") || display_name);
    if (!slug) return { ok: false, error: "slug（半角英数とハイフン）を入力してください" };
    const { data: created, error } = await supabaseAdmin.from("entrances").insert({ ...row, slug }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "同じ slug のエントランスがあります" : error.message };
    const a = await assignEntranceLock(created.id, lockSel);
    if (!a.ok) return a;
    const g = await saveGeo(created.id, geo);
    if (!g.ok) return g;
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** 位置制限を保存。migration_entrance_geofence.sql 未実行なら、値を入れたときだけエラーにする。 */
async function saveGeo(id: string, geo: { lat: number | null; lng: number | null; geofence_radius_m: number } | null) {
  if (!geo) return { ok: true };
  const { error } = await supabaseAdmin.from("entrances").update(geo).eq("id", id);
  if (!error) return { ok: true };
  if (error.code === "42703" || /column/i.test(error.message)) {
    return geo.lat === null ? { ok: true } : { ok: false, error: "先に supabase/migration_entrance_geofence.sql を実行してください" };
  }
  return { ok: false, error: error.message };
}

/** ゲスト画面の設定を保存 (緊急停止の状態はここでは変えない)。 */
export async function saveSmartKeySettings(input: Partial<SmartKeySettings>): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  const s = sanitizeSettings(input);
  const { error } = await supabaseAdmin.from("smartkey_settings").upsert({
    id: 1,
    hold_ms: s.hold_ms,
    entrance_lock: s.entrance_lock,
    room_lock: s.room_lock,
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
