import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeRoomRequest } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 音声で質問されたときの答え (Wi-Fi / チェックアウト / エントランス・お部屋の暗証番号 / 緊急時のホスト連絡先)。
 *   GET /api/room-info/[room_id]
 *   認証: 部屋の PIN セッション Cookie (管理画面テストは管理者 Cookie)。
 *   暗証番号・Wi-Fi はページの HTML には入れず、聞かれたときだけこの API で返す。
 *   スマートキー設定で「表示しない」にしている項目は返さない。
 */
export async function GET(_req: NextRequest, { params }: { params: { room_id: string } }) {
  let room: any = null;
  let checkOut: string | null = null;

  const stay = await authorizeRoomRequest(params.room_id);
  if (stay) {
    room = stay.room;
    checkOut = stay.reservation.check_out;
  } else {
    const token = cookies().get(ADMIN_COOKIE)?.value;
    if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
    }
    const { data } = await supabaseAdmin.from("rooms").select("*").eq("slug", params.room_id).maybeSingle();
    room = data;
  }
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });

  // エントランス (同じ棟) と表示設定。テーブルが無い場合は空で返す。
  let entrance: any = null;
  let settings: any = null;
  try {
    const [e, st] = await Promise.all([
      supabaseAdmin.from("entrances").select("keypad_code, wifi_ssid, wifi_password, support_url")
        .eq("building", room.building || "Crane Nest").eq("is_active", true).limit(1).maybeSingle(),
      supabaseAdmin.from("smartkey_settings").select("show_keypad_code, show_wifi, show_support").eq("id", 1).maybeSingle(),
    ]);
    entrance = e.data;
    settings = st.data;
  } catch { /* ignore */ }
  const showCode = settings?.show_keypad_code !== false;
  const showWifi = settings?.show_wifi !== false;

  return NextResponse.json({
    ok: true,
    checkOut,
    wifi: showWifi && (entrance?.wifi_ssid || entrance?.wifi_password)
      ? { ssid: entrance.wifi_ssid ?? null, password: entrance.wifi_password ?? null } : null,
    entranceCode: showCode ? entrance?.keypad_code ?? null : null,
    roomCode: room.keypad_code ?? null,
    // 緊急時に出すホストの連絡先 (LINE / WhatsApp / tel:)
    supportUrl: settings?.show_support !== false ? entrance?.support_url ?? null : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
