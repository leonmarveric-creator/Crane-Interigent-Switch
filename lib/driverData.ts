/**
 * お父さんの送迎画面 (/driver) のデータ読み込み (サーバ専用)。
 *   migration_driver.sql 未実行でも、送迎の情報なしで表示だけはできるようにする。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingColumn } from "@/lib/stayTimes";
import { langOf, monthKey, type DRoom, type DRes } from "@/lib/driverLogic";

export type DriverDesign = "hybrid" | "bike";
export interface DriverSettings { design: DriverDesign; autoPrep: boolean; autoPrepMin: number; flightAuto: boolean }
export interface DriverTrack { id: string; purpose: "in" | "out"; lang: "ja" | "en" | "zh" | "ko"; title: string; artist: string | null; url: string; lrc: string | null; sort: number }
export interface DriverPlace { id: string; name: string; mapQuery: string | null; sort: number }
export interface DriverAlert { id: number; roomId: string | null; kind: string; battery: number | null; dueAt: string | null; createdAt: string }
export interface EntranceInfo { building: string; keypad: string | null; wifiSsid: string | null; wifiPass: string | null }
export interface DriverData {
  rooms: DRoom[]; res: DRes[]; places: DriverPlace[]; tracks: DriverTrack[];
  settings: DriverSettings; alerts: DriverAlert[]; flightUsed: number;
  battery: Record<string, { battery: number | null; checkedAt: string }>;
  entrances: EntranceInfo[]; setupMissing: boolean;
}

export const DEFAULT_SETTINGS: DriverSettings = { design: "hybrid", autoPrep: true, autoPrepMin: 30, flightAuto: true };

export async function getDriverSettings(): Promise<DriverSettings> {
  try {
    const { data, error } = await supabaseAdmin.from("app_settings")
      .select("driver_design, driver_auto_prep, driver_auto_prep_min, driver_flight_auto").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    const d: any = data;
    return {
      design: d.driver_design === "bike" ? "bike" : "hybrid",
      autoPrep: d.driver_auto_prep !== false,
      autoPrepMin: Number(d.driver_auto_prep_min) > 0 ? Number(d.driver_auto_prep_min) : 30,
      flightAuto: d.driver_flight_auto !== false,
    };
  } catch { return DEFAULT_SETTINGS; }
}

export function toDRoom(r: any): DRoom {
  return {
    id: r.id, slug: r.slug, name: r.display_name || r.slug, building: r.building || "Crane Nest",
    hasLock: !!(r.sesame_device_uuid && r.sesame_secret_key && r.sesame_api_key),
    hasAc: !!r.switchbot_ac_device_id, hasLight: !!r.switchbot_light_device_id,
    hasWafu: !!r.switchbot_wafu_device_id, hasGalaxy: !!r.switchbot_galaxy_device_id,
    lat: typeof r.lat === "number" ? r.lat : null, lng: typeof r.lng === "number" ? r.lng : null,
  };
}

export function toDRes(r: any): DRes {
  return {
    id: r.id, roomId: r.assigned_room_id || r.room_id,
    guest: r.entrance_name || r.guest_name || null, lang: langOf(r.guest_lang),
    checkIn: r.early_checkin_at || r.check_in, checkOut: r.late_checkout_at || r.check_out,
    pin: r.unlock_pin ?? null,
    pickupPlace: r.pickup_place ?? null, pickupAt: r.pickup_at ?? null, pickupNone: !!r.pickup_none,
    flightNo: r.flight_no ?? null, flightInfo: r.flight_info ?? null, flightCheckedAt: r.flight_checked_at ?? null,
    preparedAt: r.prepared_at ?? null,
  };
}

/** 予約 (from〜to に重なるもの)。列が無ければ基本の列だけで読む */
export async function loadReservations(fromMs: number, toMs: number): Promise<{ res: DRes[]; missing: boolean }> {
  const base = "id, room_id, guest_name, guest_lang, unlock_pin, status, check_in, check_out";
  const extra = ", assigned_room_id, entrance_name, early_checkin_at, late_checkout_at";
  const drv = ", pickup_place, pickup_at, pickup_none, flight_no, flight_info, flight_checked_at, prepared_at";
  const q = (c: string) => supabaseAdmin.from("reservations").select(c).neq("status", "cancelled")
    .lt("check_in", new Date(toMs).toISOString()).gt("check_out", new Date(fromMs).toISOString()).order("check_in");
  let r: any = await q(base + extra + drv);
  let missing = false;
  if (isMissingColumn(r.error)) { missing = true; r = await q(base + extra); }
  if (isMissingColumn(r.error)) r = await q(base);
  return { res: ((r.data ?? []) as any[]).map(toDRes), missing };
}

export async function loadDriverData(nowMs = Date.now()): Promise<DriverData> {
  const [roomsQ, resR, settings] = await Promise.all([
    supabaseAdmin.from("rooms").select("*").eq("is_active", true).order("building").order("slug"),
    loadReservations(nowMs - 3 * 86400e3, nowMs + 5 * 86400e3),
    getDriverSettings(),
  ]);
  const rooms = ((roomsQ.data ?? []) as any[]).map(toDRoom);
  const safe = async <T,>(p: PromiseLike<{ data: any; error: any }>, map: (d: any) => T, fb: T): Promise<T> => {
    try { const { data, error } = await p; return error ? fb : map(data); } catch { return fb; }
  };
  const pub = (path: string) => supabaseAdmin.storage.from("driver-music").getPublicUrl(path).data.publicUrl;
  const [places, tracks, alerts, flightUsed, battery, entrances] = await Promise.all([
    safe(supabaseAdmin.from("driver_places").select("*").order("sort").order("created_at"), (d) => (d ?? []).map((p: any) => ({ id: p.id, name: p.name, mapQuery: p.map_query ?? null, sort: p.sort })), [] as DriverPlace[]),
    safe(supabaseAdmin.from("driver_tracks").select("*").order("sort").order("created_at"), (d) => (d ?? []).map((t: any) => ({ id: t.id, purpose: t.purpose, lang: t.lang, title: t.title, artist: t.artist ?? null, url: pub(t.file_path), lrc: t.lrc ?? null, sort: t.sort })), [] as DriverTrack[]),
    safe(supabaseAdmin.from("driver_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(20), (d) => (d ?? []).map((a: any) => ({ id: a.id, roomId: a.room_id, kind: a.kind, battery: a.battery, dueAt: a.due_at, createdAt: a.created_at })), [] as DriverAlert[]),
    safe(supabaseAdmin.from("driver_flight_usage").select("used").eq("month", monthKey(nowMs)).maybeSingle(), (d) => Number(d?.used ?? 0), 0),
    safe(supabaseAdmin.from("lock_battery_logs").select("room_id, battery, checked_at").order("checked_at", { ascending: false }).limit(200), (d) => {
      const m: Record<string, { battery: number | null; checkedAt: string }> = {};
      for (const l of d ?? []) if (!m[l.room_id]) m[l.room_id] = { battery: l.battery, checkedAt: l.checked_at };
      return m;
    }, {} as Record<string, { battery: number | null; checkedAt: string }>),
    safe(supabaseAdmin.from("entrances").select("building, keypad_code, wifi_ssid, wifi_password").eq("is_active", true), (d) => (d ?? []).map((e: any) => ({ building: e.building || "Crane Nest", keypad: e.keypad_code ?? null, wifiSsid: e.wifi_ssid ?? null, wifiPass: e.wifi_password ?? null })), [] as EntranceInfo[]),
  ]);
  const roomIds = new Set(rooms.map((r) => r.id));
  return {
    rooms, res: resR.res.filter((r) => roomIds.has(r.roomId)), places, tracks, settings, alerts, flightUsed, battery, entrances,
    setupMissing: resR.missing,
  };
}
