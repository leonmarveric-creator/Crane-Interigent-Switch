import { getActiveStay, hasValidSession } from "@/lib/auth";
import { isLang, type Lang } from "@/lib/i18n";
import AccessDenied from "@/components/AccessDenied";
import PinGate from "@/components/PinGate";
import ControlPanel from "@/components/ControlPanel";

export const dynamic = "force-dynamic"; // 常に現在時刻で再検証

/**
 * ゲスト操作画面のエントリ (固定QR方式)。
 *  /room/[room_id]?lang=en   ← トークンはURLに無い
 *  1. 現在アクティブな滞在があるか (時刻判定)
 *  2. PIN認証済みのセッションCookieがあるか
 *     - 無ければ PinGate (PIN入力画面)
 *     - 有れば ControlPanel
 *  3. アクティブな滞在が無ければ AccessDenied
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { room_id: string };
  searchParams: { lang?: string };
}) {
  const stay = await getActiveStay(params.room_id);

  const lang: Lang = isLang(searchParams.lang)
    ? searchParams.lang
    : isLang(stay?.reservation.guest_lang)
    ? (stay!.reservation.guest_lang as Lang)
    : "en";

  if (!stay) {
    return <AccessDenied lang={lang} />;
  }

  const authed = hasValidSession(params.room_id, stay.reservation.id);
  if (!authed) {
    return (
      <PinGate
        roomSlug={params.room_id}
        roomName={stay.room.display_name}
        initialLang={lang}
      />
    );
  }

  return (
    <ControlPanel
      roomSlug={params.room_id}
      roomName={stay.room.display_name}
      checkOut={stay.reservation.check_out}
      initialLang={lang}
    />
  );
}
