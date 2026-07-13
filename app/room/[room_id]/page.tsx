import { cookies } from "next/headers";
import { getActiveStays } from "@/lib/auth";
import { verifySession, roomCookieName } from "@/lib/roomSession";
import { isLang, type Lang } from "@/lib/i18n";
import AccessDenied from "@/components/AccessDenied";
import PinGate from "@/components/PinGate";
import ControlPanel from "@/components/ControlPanel";

export const dynamic = "force-dynamic"; // 常に現在時刻で再検証

/**
 * ゲスト操作画面のエントリ (固定QR方式)。
 *  /room/[room_id]?lang=en   ← トークンはURLに無い
 *  1. 現在アクティブな滞在(複数可)があるか (時刻判定)
 *  2. PIN認証済みのセッションCookieが、その滞在のいずれかと一致するか
 *  3. 無ければ PinGate、無効ならアクティブ滞在なしで AccessDenied
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { room_id: string };
  searchParams: { lang?: string };
}) {
  const stays = await getActiveStays(params.room_id);
  const primary = stays?.reservations[0];

  const lang: Lang = isLang(searchParams.lang)
    ? searchParams.lang
    : isLang(primary?.guest_lang)
    ? (primary!.guest_lang as Lang)
    : "en";

  if (!stays || !primary) {
    return <AccessDenied lang={lang} />;
  }

  // セッションが有効滞在のいずれかと一致するか
  const token = cookies().get(roomCookieName(params.room_id))?.value;
  const v = verifySession(token);
  const matched = v ? stays.reservations.find((r) => r.id === v.reservationId) : undefined;

  if (!matched) {
    return (
      <PinGate
        roomSlug={params.room_id}
        roomName={stays.room.display_name}
        initialLang={lang}
      />
    );
  }

  return (
    <ControlPanel
      roomSlug={params.room_id}
      roomName={stays.room.display_name}
      checkOut={matched.check_out}
      initialLang={lang}
      imageUrl={stays.room.image_url}
      lat={stays.room.lat}
      lng={stays.room.lng}
      radiusM={stays.room.geofence_radius_m}
      hasGalaxy={!!stays.room.switchbot_galaxy_device_id}
      hasWafu={!!stays.room.switchbot_wafu_device_id}
    />
  );
}
