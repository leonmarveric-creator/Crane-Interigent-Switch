"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

/** datetime-local (JST入力) を ISO(UTC) へ。例 "2026-06-20T15:00" */
function jstLocalToIso(v: string): string {
  return new Date(`${v}:00+09:00`).toISOString();
}

function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/** 手動予約を追加。PINを発行 (指定が無ければランダム4桁)。 */
export async function addReservation(formData: FormData) {
  requireAdmin();

  const room_id = String(formData.get("room_id") || "");
  const checkInRaw = String(formData.get("check_in") || "");
  const checkOutRaw = String(formData.get("check_out") || "");
  const guest_name = String(formData.get("guest_name") || "") || null;
  const guest_lang = String(formData.get("guest_lang") || "en");
  const pinRaw = String(formData.get("unlock_pin") || "").replace(/\D/g, "");

  if (!room_id || !checkInRaw || !checkOutRaw) throw new Error("MISSING_FIELDS");

  const check_in = jstLocalToIso(checkInRaw);
  const check_out = jstLocalToIso(checkOutRaw);
  if (new Date(check_out) <= new Date(check_in)) throw new Error("BAD_RANGE");

  const unlock_pin = pinRaw.length >= 4 ? pinRaw.slice(0, 6) : randomPin();

  await supabaseAdmin.from("reservations").insert({
    room_id, source: "manual", check_in, check_out, guest_name, guest_lang,
    status: "active", unlock_pin,
  });

  revalidatePath("/admin");
}

/** 予約をキャンセル (無効化)。 */
export async function cancelReservation(formData: FormData) {
  requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabaseAdmin.from("reservations").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/admin");
}

/** 部屋にSwitchBotデバイス(エアコン/照明)を割り当て。 */
export async function assignDevices(formData: FormData) {
  requireAdmin();
  const room_id = String(formData.get("room_id") || "");
  if (!room_id) return;
  const ac = String(formData.get("ac") || "") || null;
  const light = String(formData.get("light") || "") || null;
  await supabaseAdmin
    .from("rooms")
    .update({ switchbot_ac_device_id: ac, switchbot_light_device_id: light })
    .eq("id", room_id);
  revalidatePath("/admin");
}

/** 部屋のジオフェンス(座標・半径)を更新。空欄で解除。 */
export async function updateGeofence(formData: FormData) {
  requireAdmin();
  const room_id = String(formData.get("room_id") || "");
  if (!room_id) return;
  const latRaw = String(formData.get("lat") || "").trim();
  const lngRaw = String(formData.get("lng") || "").trim();
  const radRaw = String(formData.get("radius") || "").trim();
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;
  const geofence_radius_m = radRaw ? Math.max(20, Math.round(Number(radRaw))) : 150;
  await supabaseAdmin
    .from("rooms")
    .update({
      lat: Number.isFinite(lat as number) ? lat : null,
      lng: Number.isFinite(lng as number) ? lng : null,
      geofence_radius_m,
    })
    .eq("id", room_id);
  revalidatePath("/admin");
}

/** 部屋のアート画像URLを更新。 */
export async function updateRoomImage(formData: FormData) {
  requireAdmin();
  const room_id = String(formData.get("room_id") || "");
  if (!room_id) return;
  const image_url = String(formData.get("image_url") || "").trim() || null;
  await supabaseAdmin.from("rooms").update({ image_url }).eq("id", room_id);
  revalidatePath("/admin");
}

/** PINを再発行 (現在のPINを無効化して4桁を作り直す)。 */
export async function regeneratePin(formData: FormData) {
  requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabaseAdmin.from("reservations").update({ unlock_pin: randomPin() }).eq("id", id);
  revalidatePath("/admin");
}
