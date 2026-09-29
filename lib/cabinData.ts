/**
 * 車内 iPad (/cabin) のデータ (サーバ専用)。
 *   migration_cabin.sql 未実行でも落ちないように、テーブルが無ければ「未設定」で返す。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { roomColor } from "@/lib/driverLogic";
import { CRANE_NEST, type GLang, type LL } from "@/lib/cabinGeo";
import { BUILTIN_PHOTOS as BUILTIN, DEFAULT_PHOTO, type CabinSpots, type Spot } from "@/lib/cabinPhotos";
import { toNowPlaying, type CabinTrack, type MusicCmdRow, type NowPlaying } from "@/lib/cabinMusic";
export type { CabinSpots, Spot } from "@/lib/cabinPhotos";

export interface CabinRoom {
  id: string; slug: string; kanji: string; en: string; accent: string; fx: "petal" | "firefly" | "leaf" | "snow";
  photo: string | null; photoKey: string | null; spots: CabinSpots; home: LL; building: string;
  /** 到着画面の QR 用: お部屋のページ (/room/[roomSlug]) と、同じ棟のエントランスの鍵 (/key/[entrance]) */
  roomSlug: string | null; entrance: string | null;
  /** エントランスの暗証番号 (入り方ガイド用。無ければ null) */
  keypad: string | null;
  /** お部屋の暗証番号 (rooms.keypad_code。入り方ガイド用) */
  roomCode: string | null;
  /** 和風ライトがあるか (ゲストの「明かりをつけて」で使う) */
  hasWafu: boolean;
}
export interface CabinDevice { id: string; name: string; hasGps: boolean | null; lastSeen: string | null }
export interface CabinTrip {
  id: string; deviceId: string | null; resId: string | null; dir: "in" | "out";
  placeKey: string; placeName: string | null; placeLL: LL | null;
  roomId: string | null; lang: GLang; ac: "cool" | "heat" | "none"; startedAt: string;
  phone: { ll: LL; kmh: number | null; at: string } | null;
  /** お父さんのスマホで流れている曲 */
  np: NowPlaying | null;
  /** お父さんから ASTRAEA への指示 (最後の 1 つ) */
  aiCmd: { c: string; n: number } | null;
  /** iPad から スマホへの再生の操作 (最後の 1 つ) */
  cmd: MusicCmdRow | null;
  /** migration_cabin_music.sql を実行済みか (now_playing の列があるか) */
  npReady: boolean;
  /** 静かモード (AI のひと言を止める。お父さんのスマホで切り替え) */
  aiQuiet: boolean;
  /** スマホが声を取りに来た最後の時刻 (これが新しければ、声はスマホから流す) */
  voiceSeen: string | null;
  /** dead = 回送 (ゲストなし: 迎えに行く途中・送ったあとの帰り道) / guest = ゲストが乗っている */
  phase: "dead" | "guest";
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
    roomSlug: r.slug ? String(r.slug) : null, entrance: null, keypad: null, roomCode: r.keypad_code ? String(r.keypad_code) : null, hasWafu: !!r.switchbot_wafu_device_id,
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
    aiCmd: t.ai_cmd && typeof t.ai_cmd === "object" && typeof t.ai_cmd.n === "number" ? { c: String(t.ai_cmd.c), n: t.ai_cmd.n } : null,
    np: toNowPlaying(t.now_playing), npReady: "now_playing" in t, aiQuiet: t.ai_quiet === true, voiceSeen: t.voice_seen ?? null, phase: t.phase === "dead" ? "dead" : "guest",
    cmd: t.music_cmd && typeof t.music_cmd === "object" && typeof t.music_cmd.n === "number" ? t.music_cmd : null,
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
  if (!data) return null;
  const room = toCabinRoom(data);
  // 同じ棟のエントランス (スマートキーの SQL が未実行でも落ちないように)
  try {
    const { data: ents } = await supabaseAdmin.from("entrances").select("slug, building, keypad_code").eq("is_active", true).order("slug");
    const ent = ((ents ?? []) as any[]).find((e) => (e.building || "Crane Nest") === room.building);
    room.entrance = ent?.slug ?? null; room.keypad = ent?.keypad_code ? String(ent.keypad_code) : null;
  } catch { /* ignore */ }
  return room;
}

/** チェックイン QR の画像 (全員共通。app_settings.cabin_checkin_qr = Storage のパス) */
export async function checkinQrUrl(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("app_settings").select("cabin_checkin_qr").eq("id", 1).maybeSingle();
  if (error || !data?.cabin_checkin_qr) return null;
  return cabinPublicUrl(String(data.cabin_checkin_qr));
}

/** iPad に出す曲の情報 (曲名・歌手・カバー・歌詞) */
export async function cabinTrackById(id: string): Promise<CabinTrack | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin.from("driver_tracks").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  // select("*"): カバーの列 (cover_path) がまだ無い古いデータベースでも歌詞は出す
  return { id: data.id, title: data.title, artist: data.artist ?? null, cover: data.cover_path ? cabinPublicUrl(data.cover_path) : null, lrc: data.lrc ?? null };
}
