import { headers } from "next/headers";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBootVoice } from "@/lib/bootVoice";
import { listDevices } from "@/lib/switchbot";
import AdminClient, { type Room, type Reservation, type SwitchBotInfo, type LogEntry } from "./AdminClient";
import type { AdminEntrance, EntranceLog, AdminSesameLock } from "./SmartKeyTab";
import { getSmartKeySettings } from "@/lib/smartkey";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  const { data: roomRows } = await supabaseAdmin
    .from("rooms")
    .select("id, slug, display_name, building, is_active, switchbot_ac_device_id, switchbot_light_device_id, switchbot_galaxy_device_id, switchbot_nest_device_id, switchbot_wafu_device_id, image_url, lat, lng, geofence_radius_m, sesame_device_uuid, sesame_secret_key, sesame_api_key")
    .order("building")
    .order("slug");

  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, assigned_room_id, source, check_in, check_out, status, guest_name, guest_lang, unlock_pin, airbnb_reservation_url")
    .order("check_in", { ascending: false })
    .limit(100);

  // 部屋ごとの固定URL + 印刷用QR (これをドアに貼る)
  const rooms: Room[] = await Promise.all(
    (roomRows ?? []).map(async (r) => {
      const url = `${baseUrl}/room/${r.slug}`;
      const qr = await QRCode.toDataURL(url, {
        width: 480, margin: 1,
        color: { dark: "#0b0f1a", light: "#ffffff" },
      });
      return {
        id: r.id, slug: r.slug, display_name: r.display_name, building: r.building ?? null, is_active: r.is_active,
        ac_device_id: r.switchbot_ac_device_id ?? null,
        light_device_id: r.switchbot_light_device_id ?? null,
        galaxy_device_id: r.switchbot_galaxy_device_id ?? null,
        nest_device_id: r.switchbot_nest_device_id ?? null,
        wafu_device_id: r.switchbot_wafu_device_id ?? null,
        image_url: r.image_url ?? null,
        lat: r.lat ?? null, lng: r.lng ?? null, radius: r.geofence_radius_m ?? 150,
        has_lock: !!(r.sesame_device_uuid && r.sesame_secret_key && r.sesame_api_key),
        url, qr,
      };
    })
  );

  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const enriched: Reservation[] = (reservations ?? []).map((r) => {
    const room = roomMap.get(r.room_id);
    const aroom = r.assigned_room_id ? roomMap.get(r.assigned_room_id) : undefined;
    return {
      id: r.id,
      room_name: room?.display_name ?? "—",
      room_slug: room?.slug ?? "",
      assigned_room_id: r.assigned_room_id ?? null,
      assigned_room_name: aroom?.display_name ?? null,
      assigned_room_slug: aroom?.slug ?? null,
      source: r.source,
      status: r.status,
      guest_name: r.guest_name,
      guest_lang: r.guest_lang,
      check_in: r.check_in,
      check_out: r.check_out,
      unlock_pin: r.unlock_pin,
      airbnb_reservation_url: r.airbnb_reservation_url ?? null,
    };
  });

  // SwitchBotデバイス一覧 (ID確認用)。env未設定なら error メッセージ。
  let switchbot: SwitchBotInfo;
  if (process.env.SWITCHBOT_TOKEN && process.env.SWITCHBOT_SECRET) {
    const r = await listDevices({
      token: process.env.SWITCHBOT_TOKEN,
      secret: process.env.SWITCHBOT_SECRET,
    });
    switchbot = r;
  } else {
    switchbot = { error: "SWITCHBOT_TOKEN / SECRET が未設定です", deviceList: [], infraredRemoteList: [] };
  }

  // 操作ログ (直近200件)
  const { data: logRows } = await supabaseAdmin
    .from("device_logs")
    .select("id, room_id, action, source, success, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const logs: LogEntry[] = (logRows ?? []).map((l) => ({
    id: l.id,
    room_name: roomMap.get(l.room_id)?.display_name ?? "—",
    room_slug: roomMap.get(l.room_id)?.slug ?? "",
    action: l.action,
    source: l.source,
    success: l.success,
    created_at: l.created_at,
  }));

  // ---- スマートキー（エントランス） ----
  // テーブル未作成 (migration_smartkey.sql 未実行) でも管理画面が落ちないよう、エラーは空扱い。
  const { data: entranceRows, error: entranceErr } = await supabaseAdmin
    .from("entrances")
    .select("id, slug, display_name, building, is_active, sesame_device_uuid, sesame_secret_key, sesame_api_key, keypad_code, wifi_ssid, wifi_password, support_url")
    .order("building")
    .order("slug");
  const entrances: AdminEntrance[] = await Promise.all(
    (entranceRows ?? []).map(async (e) => {
      const url = `${baseUrl}/key/${e.slug}`;
      const qr = await QRCode.toDataURL(url, { width: 720, margin: 1, color: { dark: "#0b2f6e", light: "#ffffff" } });
      return {
        id: e.id, slug: e.slug, display_name: e.display_name, building: e.building, is_active: e.is_active,
        sesame_device_uuid: e.sesame_device_uuid ?? null,
        has_secret: !!e.sesame_secret_key,
        has_api_key: !!e.sesame_api_key || !!process.env.SESAME_API_KEY,
        api_key_from_env: !e.sesame_api_key && !!process.env.SESAME_API_KEY,
        keypad_code: e.keypad_code ?? null, wifi_ssid: e.wifi_ssid ?? null, wifi_password: e.wifi_password ?? null,
        support_url: e.support_url ?? null,
        url, qr,
      };
    })
  );
  // 位置制限 (migration_entrance_geofence.sql 未実行でも落ちないよう別クエリ)
  const { data: geoRows } = await supabaseAdmin.from("entrances").select("id, lat, lng, geofence_radius_m");
  for (const g of (geoRows ?? []) as any[]) {
    const e = entrances.find((x) => x.id === g.id);
    if (e) { e.lat = g.lat ?? null; e.lng = g.lng ?? null; e.geofence_radius_m = g.geofence_radius_m ?? null; }
  }
  const smartkeySettings = await getSmartKeySettings();

  // ---- Sesame 一覧（鍵の台帳） ----
  // migration_sesame_locks.sql 未実行でも落ちないよう、別クエリでエラーは無視する。
  const [{ data: lockRows, error: lockErr }, { data: roomLockRows }, { data: entLockRows }] = await Promise.all([
    supabaseAdmin.from("sesame_locks").select("id, name, device_uuid, secret_key, api_key, note").order("name"),
    supabaseAdmin.from("rooms").select("id, sesame_lock_id"),
    supabaseAdmin.from("entrances").select("id, sesame_lock_id"),
  ]);
  const roomLockMap = new Map<string, string | null>((roomLockRows ?? []).map((r: any) => [r.id, r.sesame_lock_id ?? null]));
  const entLockMap = new Map<string, string | null>((entLockRows ?? []).map((e: any) => [e.id, e.sesame_lock_id ?? null]));
  rooms.forEach((r) => { r.sesame_lock_id = roomLockMap.get(r.id) ?? null; });
  entrances.forEach((e) => { e.sesame_lock_id = entLockMap.get(e.id) ?? null; });
  const locks: AdminSesameLock[] = (lockRows ?? []).map((l: any) => ({
    id: l.id, name: l.name, device_uuid: l.device_uuid, note: l.note ?? null,
    has_secret: !!l.secret_key,
    has_api_key: !!l.api_key || !!process.env.SESAME_API_KEY,
    used_by: [
      ...rooms.filter((r) => r.sesame_lock_id === l.id).map((r) => r.display_name),
      ...entrances.filter((e) => e.sesame_lock_id === l.id).map((e) => e.display_name),
    ],
  }));
  const entranceMap = new Map(entrances.map((e) => [e.id, e]));
  const { data: elogRows } = await supabaseAdmin
    .from("entrance_logs")
    .select("id, entrance_id, room_id, guest_name, action, source, success, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  const entranceLogs: EntranceLog[] = (elogRows ?? []).map((l) => ({
    id: l.id,
    entrance_name: l.entrance_id ? entranceMap.get(l.entrance_id)?.display_name ?? "—" : null,
    room_name: l.room_id ? roomMap.get(l.room_id)?.display_name ?? "—" : null,
    guest_name: l.guest_name ?? null,
    action: l.action, source: l.source, success: l.success, created_at: l.created_at,
  }));

  return (
    <AdminClient rooms={rooms} reservations={enriched} switchbot={switchbot} logs={logs} bootVoice={await getBootVoice()}
      smartkey={{ entrances, settings: smartkeySettings, logs: entranceLogs, setupMissing: !!entranceErr, locks, locksMissing: !!lockErr }} />
  );
}
