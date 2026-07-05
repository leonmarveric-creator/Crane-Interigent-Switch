"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { runIcalSync } from "@/lib/syncIcal";

/**
 * Airbnb iCal を今すぐ手動同期 (Cronを待たずに新規予約を取り込む)。
 * 追加/更新/キャンセル件数の合計を返す。
 */
export async function syncNow(): Promise<{ ok: boolean; added: number; updated: number; cancelled: number; error?: string }> {
  requireAdmin();
  try {
    const { summary } = await runIcalSync();
    const total = Object.values(summary).reduce(
      (a, s) => ({ added: a.added + s.added, updated: a.updated + s.updated, cancelled: a.cancelled + s.cancelled }),
      { added: 0, updated: 0, cancelled: 0 }
    );
    revalidatePath("/admin");
    return { ok: true, ...total };
  } catch (e: any) {
    return { ok: false, added: 0, updated: 0, cancelled: 0, error: e?.message || "SYNC_FAILED" };
  }
}

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
  // 位置制限ON/OFF。OFFなら半径0(=制限なし)で保存し、座標は天気用に残す。
  const on = String(formData.get("geofence_on") || "") === "on";
  const geofence_radius_m = on
    ? (radRaw ? Math.max(20, Math.round(Number(radRaw))) : 150)
    : 0;
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

/**
 * 部屋アートをファイルからアップロード。
 * Supabase Storage の公開バケット "room-art" に保存し、公開URLを rooms.image_url に保存。
 */
export async function uploadRoomImage(formData: FormData) {
  requireAdmin();
  const room_id = String(formData.get("room_id") || "");
  const file = formData.get("image") as File | null;
  if (!room_id || !file || file.size === 0) return;
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new Error("NOT_MEDIA");
  // Vercelのリクエスト上限(4.5MB)を超えるとアップロード自体が失敗するため4MBに制限。
  // 大きい動画は外部URLを画像URL欄に貼って使う運用とする。
  if (file.size > 4 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");

  const extRaw = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
  const okExt = isVideo ? /^(mp4|webm|mov|m4v|ogv)$/ : /^(jpg|jpeg|png|webp|gif|avif)$/;
  const ext = okExt.test(extRaw) ? extRaw : (isVideo ? "mp4" : "jpg");
  const path = `${room_id}/${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from("room-art")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error("UPLOAD_FAILED: " + error.message);

  const { data } = supabaseAdmin.storage.from("room-art").getPublicUrl(path);
  await supabaseAdmin.from("rooms").update({ image_url: data.publicUrl }).eq("id", room_id);
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

/** 任意のPINを手動設定 (Airbnbのおすすめコード等に合わせる)。 */
export async function setPin(formData: FormData) {
  requireAdmin();
  const id = String(formData.get("id") || "");
  const pin = String(formData.get("pin") || "").replace(/\D/g, "").slice(0, 6);
  if (!id || pin.length < 4) return;
  await supabaseAdmin.from("reservations").update({ unlock_pin: pin }).eq("id", id);
  revalidatePath("/admin");
}
