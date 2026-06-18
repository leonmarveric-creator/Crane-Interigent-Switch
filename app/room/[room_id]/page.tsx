import { validateStay } from "@/lib/auth";
import { isLang, type Lang } from "@/lib/i18n";
import AccessDenied from "@/components/AccessDenied";
import ControlPanel from "@/components/ControlPanel";

export const dynamic = "force-dynamic"; // 常に現在時刻で再検証

/**
 * ゲスト操作画面のエントリ。
 *  /room/[room_id]?token=xxxx&lang=en
 *  - サーバ側で滞在を検証 -> 期間内のみ ControlPanel を表示
 *  - 無効/期間外 -> サイバー風 AccessDenied
 *  ※ ControlPanel には秘密情報を一切渡さない (slug と token のみ)。
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { room_id: string };
  searchParams: { token?: string; lang?: string };
}) {
  const stay = await validateStay(params.room_id, searchParams.token);

  const lang: Lang = isLang(searchParams.lang)
    ? searchParams.lang
    : isLang(stay?.reservation.guest_lang)
    ? (stay!.reservation.guest_lang as Lang)
    : "en";

  if (!stay) {
    return <AccessDenied lang={lang} />;
  }

  return (
    <ControlPanel
      roomSlug={params.room_id}
      token={searchParams.token!}
      roomName={stay.room.display_name}
      checkOut={stay.reservation.check_out}
      initialLang={lang}
    />
  );
}
