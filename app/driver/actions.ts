"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffAuth";
import { executeDeviceAction, logDevice, type DeviceAction } from "@/lib/deviceControl";
import { fetchFlight, normFlightNo } from "@/lib/flight";
import { FLIGHT_REUSE_MS, type FlightInfo } from "@/lib/driverLogic";
import { loadDriverData, type DriverData, type DriverDesign } from "@/lib/driverData";
import { langOf } from "@/lib/driverLogic";
import { toCabinTrip, type CabinTrip, type CabinSpots } from "@/lib/cabinData";

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: any): { ok: false; error: string } => ({ ok: false, error: String(e?.message || e || "ERROR") });
const guard = () => { try { requireStaff(); return null; } catch { return fail("UNAUTHORIZED"); } };

/** 画面の再読み込み用 (予約・設定・曲をまとめて) */
export async function driverRefresh(): Promise<R<{ data: DriverData }>> {
  const g = guard(); if (g) return g;
  return { ok: true, data: await loadDriverData() };
}

/* ---------------- 部屋の操作 ---------------- */
const ALLOWED: DeviceAction[] = ["unlock", "lock", "ac_on", "ac_off", "light_on", "light_off", "wafu_on_warm", "wafu_off", "galaxy_on", "galaxy_off", "welcome", "welcome_cozy", "away", "good_night", "normal"];
async function roomById(id: string) {
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("id", id).maybeSingle();
  return data;
}
export async function driverRoomAction(roomId: string, action: DeviceAction): Promise<R> {
  const g = guard(); if (g) return g;
  if (!ALLOWED.includes(action)) return fail("BAD_ACTION");
  const room = await roomById(roomId); if (!room) return fail("NO_ROOM");
  try {
    const r = await executeDeviceAction(room, action, "Driver");
    await logDevice({ room_id: room.id, action, source: "admin", success: r.ok });
    return r.ok ? { ok: true } : fail(r.error || "DEVICE");
  } catch (e) { return fail(e); }
}

/** お出迎え準備: welcome = 快適モード (エアコン + 照明) / wafu = 和みモード (エアコン + 和風ライト暖色)。鍵は触らない。準備済みを記録 */
export async function driverPrepare(resIds: string[], mode: "welcome" | "wafu" = "welcome"): Promise<R<{ done: string[] }>> {
  const g = guard(); if (g) return g;
  const done: string[] = [];
  for (const id of resIds) {
    const { data: res } = await supabaseAdmin.from("reservations").select("id, room_id, assigned_room_id").eq("id", id).maybeSingle();
    if (!res) continue;
    const room = await roomById(res.assigned_room_id || res.room_id); if (!room) continue;
    const action = mode === "wafu" && room.switchbot_wafu_device_id ? "welcome_cozy" : "welcome";
    const r = await executeDeviceAction(room, action, "Driver Prep").catch(() => ({ ok: false }));
    await logDevice({ room_id: room.id, reservation_id: id, action, source: "admin", success: r.ok });
    if (r.ok) {
      done.push(id);
      await supabaseAdmin.from("reservations").update({ prepared_at: new Date().toISOString() }).eq("id", id).then(() => {}, () => {});
    }
  }
  return done.length ? { ok: true, done } : fail("DEVICE");
}

/** 部屋の設備を全部 OFF (エアコン・照明・和風ライト・ギャラクシー・NEST)。鍵はそのまま。準備済みの記録も外す */
export async function driverAllOff(roomId: string, resId?: string): Promise<R> {
  const g = guard(); if (g) return g;
  const room = await roomById(roomId); if (!room) return fail("NO_ROOM");
  const r = await executeDeviceAction(room, "away", "Driver All Off").catch(() => ({ ok: false }));
  await logDevice({ room_id: room.id, reservation_id: resId ?? null, action: "away", source: "admin", success: r.ok });
  if (resId) await supabaseAdmin.from("reservations").update({ prepared_at: null }).eq("id", resId).then(() => {}, () => {});
  return r.ok ? { ok: true } : fail("DEVICE");
}

/** チェックアウト処理: 外出モード (全部オフ) + 施錠。清掃はスタッフ画面に「清掃待ち」で出る */
export async function driverCheckout(resId: string): Promise<R> {
  const g = guard(); if (g) return g;
  const { data: res } = await supabaseAdmin.from("reservations").select("room_id, assigned_room_id").eq("id", resId).maybeSingle();
  if (!res) return fail("NO_RES");
  const room = await roomById(res.assigned_room_id || res.room_id); if (!room) return fail("NO_ROOM");
  const a = await executeDeviceAction(room, "away", "Driver Checkout").catch(() => ({ ok: false }));
  const l = await executeDeviceAction(room, "lock", "Driver Checkout").catch(() => ({ ok: false }));
  await logDevice({ room_id: room.id, reservation_id: resId, action: "away", source: "admin", success: a.ok && l.ok });
  return a.ok || l.ok ? { ok: true } : fail("DEVICE");
}

/* ---------------- お迎え情報 ---------------- */
export async function driverSavePickup(resId: string, v: { place: string | null; at: string | null; none: boolean }): Promise<R> {
  const g = guard(); if (g) return g;
  const at = v.at && !isNaN(Date.parse(v.at)) ? new Date(v.at).toISOString() : null;
  const { error } = await supabaseAdmin.from("reservations").update({ pickup_place: v.none ? null : v.place, pickup_at: v.none ? null : at, pickup_none: v.none }).eq("id", resId);
  return error ? fail(error.message) : { ok: true };
}

export async function driverSetFlight(resId: string, flightNo: string): Promise<R> {
  const g = guard(); if (g) return g;
  const no = flightNo.trim() ? normFlightNo(flightNo) : null;
  const { error } = await supabaseAdmin.from("reservations").update({ flight_no: no, flight_info: null, flight_checked_at: null }).eq("id", resId);
  return error ? fail(error.message) : { ok: true };
}

/** 飛行機の確認 (押したときだけ。5 分以内なら前回の結果) */
export async function driverCheckFlight(resId: string): Promise<R<{ info: FlightInfo | null; checkedAt: string; reused: boolean }>> {
  const g = guard(); if (g) return g;
  const { data: r } = await supabaseAdmin.from("reservations").select("id, check_in, pickup_at, flight_no, flight_info, flight_checked_at").eq("id", resId).maybeSingle();
  if (!r?.flight_no) return fail("NO_FLIGHT");
  if (r.flight_checked_at && Date.now() - Date.parse(r.flight_checked_at) < FLIGHT_REUSE_MS) return { ok: true, info: r.flight_info, checkedAt: r.flight_checked_at, reused: true };
  const f = await fetchFlight(r.flight_no, r.pickup_at || r.check_in);
  if (!f.ok) return fail(f.error || "FLIGHT");
  const checkedAt = new Date().toISOString();
  await supabaseAdmin.from("reservations").update({ flight_info: f.info ?? null, flight_checked_at: checkedAt }).eq("id", resId);
  return { ok: true, info: f.info ?? null, checkedAt, reused: false };
}

/* ---------------- よく使うお迎え場所 ---------------- */
export async function driverSavePlaces(list: { id?: string; name: string }[]): Promise<R> {
  const g = guard(); if (g) return g;
  try {
    const { data: cur } = await supabaseAdmin.from("driver_places").select("id");
    const keep = new Set(list.filter((p) => p.id).map((p) => p.id));
    const del = (cur ?? []).map((p: any) => p.id).filter((id: string) => !keep.has(id));
    if (del.length) await supabaseAdmin.from("driver_places").delete().in("id", del);
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; const name = p.name.trim(); if (!name) continue;
      if (p.id) await supabaseAdmin.from("driver_places").update({ name, sort: i }).eq("id", p.id);
      else await supabaseAdmin.from("driver_places").insert({ name, sort: i });
    }
    return { ok: true };
  } catch (e) { return fail(e); }
}

/* ---------------- 設定 ---------------- */
export async function driverSaveSettings(v: Partial<{ design: DriverDesign; autoPrep: boolean; autoPrepMin: number; flightAuto: boolean }>): Promise<R> {
  const g = guard(); if (g) return g;
  const up: any = { updated_at: new Date().toISOString() };
  if (v.design) up.driver_design = v.design === "bike" ? "bike" : "hybrid";
  if (typeof v.autoPrep === "boolean") up.driver_auto_prep = v.autoPrep;
  if (typeof v.autoPrepMin === "number") up.driver_auto_prep_min = Math.min(120, Math.max(5, Math.round(v.autoPrepMin)));
  if (typeof v.flightAuto === "boolean") up.driver_flight_auto = v.flightAuto;
  const { error } = await supabaseAdmin.from("app_settings").update(up).eq("id", 1);
  return error ? fail(error.message) : { ok: true };
}

export async function driverResolveAlert(id: number): Promise<R> {
  const g = guard(); if (g) return g;
  const { error } = await supabaseAdmin.from("driver_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error.message) : { ok: true };
}

/* ---------------- 車内の音楽 ---------------- */
/** 曲のアップロード先 (ブラウザから Storage へ直接送る。Vercel の 4.5MB 制限を避ける) */
export async function driverTrackUploadUrl(fileName: string): Promise<R<{ path: string; token: string; signedUrl: string }>> {
  const g = guard(); if (g) return g;
  const ext = (fileName.match(/\.([a-z0-9]{2,4})$/i)?.[1] || "mp3").toLowerCase();
  const path = `tracks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("driver-music").createSignedUploadUrl(path);
  if (error || !data) return fail(error?.message || "UPLOAD_URL");
  return { ok: true, path, token: data.token, signedUrl: data.signedUrl };
}
/** カバー画像のアップロード先 (ブラウザで 800×800 に縮めてから直接送る) */
export async function driverCoverUploadUrl(trackId: string, ext: "webp" | "jpg"): Promise<R<{ path: string; signedUrl: string }>> {
  const g = guard(); if (g) return g;
  const path = `covers/${trackId}-${Date.now().toString(36)}.${ext === "webp" ? "webp" : "jpg"}`;
  const { data, error } = await supabaseAdmin.storage.from("driver-music").createSignedUploadUrl(path);
  if (error || !data) return fail(error?.message || "UPLOAD_URL");
  return { ok: true, path, signedUrl: data.signedUrl };
}
/** カバーを付ける / 外す (path = null)。前の画像は消して容量を残さない */
export async function driverSetCover(trackId: string, path: string | null): Promise<R<{ url: string | null }>> {
  const g = guard(); if (g) return g;
  if (path && !/^covers\/[\w.-]+\.(webp|jpg)$/.test(path)) return fail("BAD_PATH");
  const { data: old } = await supabaseAdmin.from("driver_tracks").select("cover_path").eq("id", trackId).maybeSingle();
  const { error } = await supabaseAdmin.from("driver_tracks").update({ cover_path: path }).eq("id", trackId);
  if (error) return fail(error.message);
  if (old?.cover_path && old.cover_path !== path) await supabaseAdmin.storage.from("driver-music").remove([old.cover_path]).catch(() => null);
  return { ok: true, url: path ? supabaseAdmin.storage.from("driver-music").getPublicUrl(path).data.publicUrl : null };
}
export async function driverAddTrack(v: { purpose: "in" | "out" | "boost"; lang: string; title: string; path: string }): Promise<R<{ id: string; url: string }>> {
  const g = guard(); if (g) return g;
  const { count } = await supabaseAdmin.from("driver_tracks").select("id", { count: "exact", head: true }).eq("purpose", v.purpose).eq("lang", v.lang);
  const { data, error } = await supabaseAdmin.from("driver_tracks").insert({ purpose: v.purpose, lang: v.lang, title: v.title.slice(0, 120), file_path: v.path, sort: count ?? 0 }).select("id").single();
  if (error || !data) return fail(error?.message || "INSERT");
  return { ok: true, id: data.id, url: supabaseAdmin.storage.from("driver-music").getPublicUrl(v.path).data.publicUrl };
}
export async function driverUpdateTrack(id: string, v: Partial<{ title: string; lrc: string | null; sort: number; startSec: number }>): Promise<R> {
  const g = guard(); if (g) return g;
  const up: any = {};
  if (typeof v.title === "string") up.title = v.title.slice(0, 120);
  if (v.lrc !== undefined) up.lrc = v.lrc;
  if (typeof v.sort === "number") up.sort = v.sort;
  if (typeof v.startSec === "number") up.start_sec = Math.max(0, Math.min(3600, Math.round(v.startSec)));
  const { error } = await supabaseAdmin.from("driver_tracks").update(up).eq("id", id);
  return error ? fail(error.message) : { ok: true };
}
export async function driverReorderTracks(ids: string[]): Promise<R> {
  const g = guard(); if (g) return g;
  for (let i = 0; i < ids.length; i++) await supabaseAdmin.from("driver_tracks").update({ sort: i }).eq("id", ids[i]);
  return { ok: true };
}
export async function driverDeleteTrack(id: string): Promise<R> {
  const g = guard(); if (g) return g;
  const { data } = await supabaseAdmin.from("driver_tracks").select("*").eq("id", id).maybeSingle();
  const files = [data?.file_path, (data as any)?.cover_path].filter(Boolean) as string[];
  if (files.length) await supabaseAdmin.storage.from("driver-music").remove(files).catch(() => null);
  const { error } = await supabaseAdmin.from("driver_tracks").delete().eq("id", id);
  return error ? fail(error.message) : { ok: true };
}

/* ---------------- 車内 iPad (お客さん用の画面) ---------------- */
const isId = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
/** 送迎を始める (iPad が 3 秒以内に切り替わる)。同じ iPad の前の送迎は終わりにする */
export async function cabinStart(v: {
  deviceId: string | null; resId: string | null; dir: "in" | "out"; placeKey: string; placeName: string | null;
  placeLL: [number, number] | null; roomId: string | null; lang: string; ac: "cool" | "heat" | "none";
}): Promise<R<{ trip: CabinTrip }>> {
  const g = guard(); if (g) return g;
  if (!/^(kix|kix2|rinku|r833|hineno|other)$/.test(v.placeKey)) return fail("BAD_PLACE");
  if (v.placeKey === "other" && !v.placeLL) return fail("NO_PLACE");
  const now = new Date().toISOString();
  let end = supabaseAdmin.from("cabin_trips").update({ status: "ended", ended_at: now }).eq("status", "active");
  if (isId(v.deviceId)) end = end.or(`device_id.eq.${v.deviceId},device_id.is.null`);
  const e1 = await end; if (e1.error) return fail(/cabin_trips/.test(e1.error.message) ? "SETUP" : e1.error.message);
  const { data, error } = await supabaseAdmin.from("cabin_trips").insert({
    device_id: isId(v.deviceId) ? v.deviceId : null, reservation_id: isId(v.resId) ? v.resId : null,
    direction: v.dir === "out" ? "out" : "in", place_key: v.placeKey, place_name: v.placeName?.slice(0, 80) ?? null,
    place_lat: v.placeLL?.[0] ?? null, place_lng: v.placeLL?.[1] ?? null, room_id: isId(v.roomId) ? v.roomId : null,
    guest_lang: langOf(v.lang), ac_mode: v.ac === "heat" ? "heat" : v.ac === "none" ? "none" : "cool",
  }).select("*").single();
  if (error || !data) return fail(error?.message || "INSERT");
  return { ok: true, trip: toCabinTrip(data) };
}
/** スマホの位置を送る (3 秒ごと)。送迎が終わっていたら active = false */
export async function cabinPos(tripId: string, lat: number, lng: number, kmh: number | null): Promise<R<{ active: boolean }>> {
  const g = guard(); if (g) return g;
  if (!isId(tripId) || !isFinite(lat) || !isFinite(lng)) return fail("BAD");
  const { data, error } = await supabaseAdmin.from("cabin_trips")
    .update({ phone_lat: lat, phone_lng: lng, phone_speed: kmh != null && isFinite(kmh) ? Math.max(0, Math.min(250, kmh)) : null, phone_at: new Date().toISOString() })
    .eq("id", tripId).eq("status", "active").select("id");
  if (error) return fail(error.message);
  return { ok: true, active: !!data?.length };
}
export async function cabinEnd(tripId: string): Promise<R> {
  const g = guard(); if (g) return g;
  if (!isId(tripId)) return fail("BAD");
  const { error } = await supabaseAdmin.from("cabin_trips").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", tripId);
  return error ? fail(error.message) : { ok: true };
}
export async function cabinRenameDevice(id: string, name: string): Promise<R> {
  const g = guard(); if (g) return g;
  const n = name.trim().slice(0, 30); if (!isId(id) || !n) return fail("BAD");
  const { error } = await supabaseAdmin.from("cabin_devices").update({ name: n }).eq("id", id);
  return error ? fail(error.message) : { ok: true };
}
export async function cabinDeleteDevice(id: string): Promise<R> {
  const g = guard(); if (g) return g;
  if (!isId(id)) return fail("BAD");
  const { error } = await supabaseAdmin.from("cabin_devices").delete().eq("id", id);
  return error ? fail(error.message) : { ok: true };
}
/** 部屋の写真 (iPad 用) のアップロード先。ブラウザで 1280px の WebP に縮めてから直接送る */
export async function cabinPhotoUploadUrl(roomId: string, ext: "webp" | "jpg"): Promise<R<{ path: string; signedUrl: string }>> {
  const g = guard(); if (g) return g;
  if (!isId(roomId)) return fail("BAD");
  const path = `rooms/${roomId}-${Date.now().toString(36)}.${ext === "webp" ? "webp" : "jpg"}`;
  const { data, error } = await supabaseAdmin.storage.from("driver-music").createSignedUploadUrl(path);
  if (error || !data) return fail(error?.message || "UPLOAD_URL");
  return { ok: true, path, signedUrl: data.signedUrl };
}
/** 部屋の写真を決める (photo: 'builtin:r1'〜'r4' / アップロードした 'rooms/…' / null = 最初の写真) と 位置 */
export async function cabinSetRoomPhoto(roomId: string, photo: string | null, spots: CabinSpots | null): Promise<R> {
  const g = guard(); if (g) return g;
  if (!isId(roomId)) return fail("BAD");
  if (photo && !/^(builtin:r[1-4]|rooms\/[\w.-]+\.(webp|jpg))$/.test(photo)) return fail("BAD_PATH");
  const { data: old } = await supabaseAdmin.from("rooms").select("cabin_photo").eq("id", roomId).maybeSingle();
  const { error } = await supabaseAdmin.from("rooms").update({ cabin_photo: photo, cabin_spots: spots }).eq("id", roomId);
  if (error) return fail(/cabin_photo|cabin_spots/.test(error.message) ? "SETUP" : error.message);
  const prev = (old as any)?.cabin_photo as string | null;
  if (prev && prev.startsWith("rooms/") && prev !== photo) await supabaseAdmin.storage.from("driver-music").remove([prev]).catch(() => null);
  return { ok: true };
}
