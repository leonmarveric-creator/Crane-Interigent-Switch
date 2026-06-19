import { headers } from "next/headers";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listDevices } from "@/lib/switchbot";
import AdminClient, { type Room, type Reservation, type SwitchBotInfo } from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  const { data: roomRows } = await supabaseAdmin
    .from("rooms")
    .select("id, slug, display_name, is_active")
    .order("slug");

  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("id, room_id, source, check_in, check_out, status, guest_name, guest_lang, unlock_pin")
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
      return { ...r, url, qr };
    })
  );

  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const enriched: Reservation[] = (reservations ?? []).map((r) => {
    const room = roomMap.get(r.room_id);
    return {
      id: r.id,
      room_name: room?.display_name ?? "—",
      room_slug: room?.slug ?? "",
      source: r.source,
      status: r.status,
      guest_name: r.guest_name,
      guest_lang: r.guest_lang,
      check_in: r.check_in,
      check_out: r.check_out,
      unlock_pin: r.unlock_pin,
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

  return <AdminClient rooms={rooms} reservations={enriched} switchbot={switchbot} />;
}
