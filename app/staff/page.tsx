import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";
import { isMissingColumn } from "@/lib/stayTimes";
import type { StaffRoom, StaffRes, HistoryItem } from "@/lib/staffLogic";
import StaffClient from "@/components/staff/StaffClient";

export const dynamic = "force-dynamic";

/** お母さん用のスタッフ画面。 */
export default async function StaffPage() {
  if (!isStaff()) redirect("/staff/login");

  const h = headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const now = Date.now();

  // 部屋 (cleaned_at は migration_staff.sql で追加。未実行でも表示はする)
  let rq: any = await supabaseAdmin.from("rooms")
    .select("id, slug, display_name, building, is_active, cleaned_at, sesame_device_uuid, sesame_secret_key, sesame_api_key, switchbot_light_device_id, switchbot_wafu_device_id, switchbot_nest_device_id")
    .eq("is_active", true).order("building").order("slug");
  const setupMissing = isMissingColumn(rq.error);
  if (setupMissing) {
    rq = await supabaseAdmin.from("rooms")
      .select("id, slug, display_name, building, is_active, sesame_device_uuid, sesame_secret_key, sesame_api_key, switchbot_light_device_id, switchbot_wafu_device_id, switchbot_nest_device_id")
      .eq("is_active", true).order("building").order("slug");
  }
  const rooms: StaffRoom[] = ((rq.data ?? []) as any[]).map((r) => ({
    id: r.id, slug: r.slug, name: r.display_name, building: r.building || "Crane Nest",
    cleaned_at: r.cleaned_at ?? null,
    has_lock: !!(r.sesame_device_uuid && r.sesame_secret_key && r.sesame_api_key),
    has_light: !!(r.switchbot_light_device_id || r.switchbot_wafu_device_id || r.switchbot_nest_device_id),
  }));

  // 予約: 3日前〜8日後 (キャンセル以外)
  const cols = "id, room_id, assigned_room_id, guest_name, guest_lang, unlock_pin, status, check_in, check_out";
  const q = (c: string) => supabaseAdmin.from("reservations").select(c)
    .neq("status", "cancelled")
    .lt("check_in", new Date(now + 8 * 86400e3).toISOString())
    .gt("check_out", new Date(now - 3 * 86400e3).toISOString())
    .order("check_in");
  let resq: any = await q(`${cols}, entrance_name, early_checkin_at, late_checkout_at`);
  const resMissing = isMissingColumn(resq.error);
  if (resMissing) resq = await q(cols);
  const reservations: StaffRes[] = ((resq.data ?? []) as any[]).map((r) => ({
    id: r.id, room_id: r.assigned_room_id || r.room_id,
    guest_name: r.entrance_name || r.guest_name || null, lang: r.guest_lang || "en", pin: r.unlock_pin ?? null,
    status: r.status, check_in: r.check_in, check_out: r.check_out,
    early_checkin_at: r.early_checkin_at ?? null, late_checkout_at: r.late_checkout_at ?? null,
  }));

  // 棟 → エントランスの URL (ゲストへの案内文用) と、暗証番号 (密码一览)
  const { data: ents } = await supabaseAdmin.from("entrances").select("id, slug, building, display_name, keypad_code").eq("is_active", true).order("building");
  const entranceCodes = ((ents ?? []) as any[]).map((e) => ({ id: e.id, name: e.display_name as string, building: e.building as string, code: (e.keypad_code ?? null) as string | null }));
  // お部屋の暗証番号 (migration_room_codes.sql 未実行なら null)
  const rc = await supabaseAdmin.from("rooms").select("id, keypad_code").eq("is_active", true);
  const roomCodes: Record<string, string | null> | null = rc.error ? null : Object.fromEntries(((rc.data ?? []) as any[]).map((r) => [r.id, r.keypad_code ?? null]));
  const entranceUrlByBuilding: Record<string, string> = {};
  for (const e of (ents ?? []) as any[]) entranceUrlByBuilding[e.building] ??= `${baseUrl}/key/${e.slug}`;

  // がんばり記録: 今年の予約 (退室 = 清掃した部屋、入室 = お迎えしたゲスト)
  const yearStart = `${new Date(now + 9 * 3600e3).toISOString().slice(0, 4)}-01-01T00:00:00+09:00`;
  const hq = (c: string) => supabaseAdmin.from("reservations").select(c)
    .neq("status", "cancelled")
    .gte("check_out", new Date(yearStart).toISOString())
    .lt("check_in", new Date(now).toISOString())
    .limit(5000);
  let hres: any = await hq("check_in, check_out, early_checkin_at, late_checkout_at");
  if (isMissingColumn(hres.error)) hres = await hq("check_in, check_out");
  const history: HistoryItem[] = ((hres.data ?? []) as any[]).map((r) => ({
    in: r.early_checkin_at || r.check_in, out: r.late_checkout_at || r.check_out,
  }));

  // 天気用の位置 (部屋に lat/lng があれば。なければ天気カードは出さない)
  let geo: { lat: number; lng: number } | null = null;
  try {
    const { data: g } = await supabaseAdmin.from("rooms").select("lat, lng").eq("is_active", true)
      .not("lat", "is", null).not("lng", "is", null).limit(1).maybeSingle();
    if (g && typeof (g as any).lat === "number" && typeof (g as any).lng === "number") geo = { lat: (g as any).lat, lng: (g as any).lng };
  } catch { /* 列が無い場合など */ }

  // Face ID / 指紋 (migration_staff_passkeys.sql 未実行なら null)
  const pk = await supabaseAdmin.from("staff_passkeys").select("id, device_name, created_at, last_used_at").order("created_at");
  const passkeys = pk.error ? null : (pk.data ?? []);

  return (
    <StaffClient history={history} geo={geo} passkeys={passkeys} entranceCodes={entranceCodes} roomCodes={roomCodes} rooms={rooms} reservations={reservations} baseUrl={baseUrl}
      entranceUrlByBuilding={entranceUrlByBuilding} setupMissing={setupMissing || resMissing} />
  );
}
