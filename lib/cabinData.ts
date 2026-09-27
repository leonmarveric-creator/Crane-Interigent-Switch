/**
 * 車内 iPad (/cabin) のデータ (サーバ専用)。
 *   migration_cabin.sql 未実行でも落ちないように、テーブルが無ければ「未設定」で返す。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { roomColor } from "@/lib/driverLogic";
import { CRANE_NEST, type GLang, type LL } from "@/lib/cabinGeo";
import { BUILTIN_PHOTOS as BUILTIN, DEFAULT_PHOTO, type CabinSpots, type Spot } from "@/lib/cabinPhotos";
export type { CabinSpots, Spot } from "@/lib/cabinPhotos";

export interface CabinRoom {
  id: string; slug: string; kanji: string; en: string; accent: string; fx: "petal" | "firefly" | "leaf" | "snow";
  photo: string | null; photoKey: string | null; spots: CabinSpots; home: LL; building: string;
}
export interface CabinDevice { id: string; name: string; hasGps: boolean | null; lastSeen: string | null }
export interface CabinTrip {
  id: string; deviceId: string | null; resId: string | null; dir: "in" | "out";
  placeKey: string; placeName: string | null; placeLL: LL | null;
  roomId: string | null; lang: GLang; ac: "cool" | "heat" | "none"; startedAt: string;
  phone: { ll: LL; kmh: number | null; at: string } | null;
}

const SEASON: [RegExp, string, string, CabinRoom["fx"]][] = [
  [/spring|haru/, "春", "HARU", "petal"], [/summer|natsu|natu/, "夏", "NATSU", "firefly"], [/autumn|aki/, "秋", "AKI", "leaf"], [/winter|fuyu/, "冬", "FUYU", "snow"],
  [/matsu/, "松", "MATSU", "snow"], [/take/, "竹", "TAKE", "firefly"], [/ume/, "梅", "UME", "petal"], [/hayashi/, "林", "HAYASHI", "leaf"], [/(^|-)ni$/, "荷", "NI", "firefly"],
];
const fxOfMonth = (ms: number): CabinRoom["fx"] => { const m = new Date(ms + 9 * 3600e3).getUTCMonth() + 1; return m <= 2 || m === 12 ? "snow" : m <= 5 ? "petal" : m <= 8 ? "firefly" : "leaf"; };

export const cabinPublicUrl = (path: string) => supabaseAdmin.storage.from("driver-music").getPublicUrl(path).data.publicUrl;

/** rooms の行 → iPad に出す部屋の情報 */
export function toCabinRoom(r: any, nowMs = Date.now()): CabinRoom {
  const slug = String(r.slug || "").toLowerCase();
  const s = SEASON.find(([re]) => re.test(slug));
  const nm = String(r.display_name || r.slug || "");
  const photoKey: string | null = r.cabin_photo ?? DEFAULT_PHOTO.find(([re]) => re.test(slug))?.[1] ?? null;
  let photo: string | null = null, spots: CabinSpots = { ac: null, lamp: null, wifi: null };
  if (photoKey) {
    const k = photoKey.replace(/^builtin:/, "");
    if (BUILTIN[k]) { photo = BUILTIN[k].src; spots = BUILTIN[k].spots; } else if (photoKey.startsWith("rooms/")) photo = cabinPublicUrl(photoKey);
  }
  const cs = r.cabin_spots;
  if (cs && typeof cs === "object") spots = { ac: okSpot(cs.ac), lamp: okSpot(cs.lamp), wifi: okSpot(cs.wifi) };
  const home: LL = typeof r.lat === "number" && typeof r.lng === "number" ? [r.lat, r.lng] : CRANE_NEST;
  return {
    id: r.id, slug, kanji: s?.[1] ?? (/[㐀-鿿]/.test(nm) ? nm.match(/[㐀-鿿]/)![0] : nm.slice(0, 1)),
    en: s?.[2] ?? nm.toUpperCase(), accent: roomColor(slug), fx: s?.[3] ?? fxOfMonth(nowMs),
    photo, photoKey: photoKey ? (BUILTIN[photoKey.replace(/^builtin:/, "")] ? "builtin:" + photoKey.replace(/^builtin:/, "") : photoKey) : null,
    spots, home, building: r.building || "Crane Nest",
  };
}
function okSpot(v: any): Spot {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && n >= 0 && n <= 100) ? [v[0], v[1]] : null;
}

export function toCabinTrip(t: any): CabinTrip {
  return {
    id: t.id, deviceId: t.device_id ?? null, resId: t.reservation_id ?? null, dir: t.direction === "out" ? "out" : "in",
    placeKey: t.place_key, placeName: t.place_name ?? null,
    placeLL: typeof t.place_lat === "number" && typeof t.place_lng === "number" ? [t.place_lat, t.place_lng] : null,
    roomId: t.room_id ?? null, lang: (["ja", "en", "zh", "ko"].includes(t.guest_lang) ? t.guest_lang : "en") as GLang,
    ac: t.ac_mode === "heat" ? "heat" : t.ac_mode === "none" ? "none" : "cool", startedAt: t.started_at,
    phone: typeof t.phone_lat === "number" && typeof t.phone_lng === "number" && t.phone_at ? { ll: [t.phone_lat, t.phone_lng], kmh: t.phone_speed ?? null, at: t.phone_at } : null,
  };
}
export function toCabinDevice(d: any): CabinDevice {
  return { id: d.id, name: d.name, hasGps: typeof d.has_gps === "boolean" ? d.has_gps : null, lastSeen: d.last_seen_at ?? null };
}

/** 送迎は 4 時間たったら自動で終わり扱い (終了の押し忘れ対策) */
export const TRIP_MAX_MS = 4 * 3600e3;

/** 今動いている送迎 (deviceId が null の送迎は全部の iPad に出す) */
export async function activeTrip(deviceId: string | null): Promise<CabinTrip | null> {
  const since = new Date(Date.now() - TRIP_MAX_MS).toISOString();
  let q = supabaseAdmin.from("cabin_trips").select("*").eq("status", "active").gt("started_at", since);
  if (deviceId && /^[0-9a-f-]{36}$/i.test(deviceId)) q = q.or(`device_id.eq.${deviceId},device_id.is.null`);
  const { data, error } = await q.order("started_at", { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  return toCabinTrip(data[0]);
}

export async function loadCabinDevices(): Promise<{ devices: CabinDevice[]; missing: boolean }> {
  const { data, error } = await supabaseAdmin.from("cabin_devices").select("*").order("sort").order("created_at");
  if (error) return { devices: [], missing: true };
  return { devices: (data ?? []).map(toCabinDevice), missing: false };
}

export async function cabinRoomById(id: string | null): Promise<CabinRoom | null> {
  if (!id) return null;
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("id", id).maybeSingle();
  return data ? toCabinRoom(data) : null;
}
