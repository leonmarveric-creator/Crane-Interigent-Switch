import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveStays } from "@/lib/auth";
import { verifySession, roomCookieName } from "@/lib/roomSession";
import { isLang, type Lang } from "@/lib/i18n";
import AccessDenied from "@/components/AccessDenied";
import PinGate from "@/components/PinGate";
import WafuDetail from "@/components/WafuDetail";

export const dynamic = "force-dynamic";

/**
 * 和風ライトの詳細設定ページ (ゲスト用)。
 * ゲスト操作画面と同じ PIN認証セッションで保護。
 * /room/[room_id]/light?lang=ja
 */
export default async function WafuLightPage({
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

  if (!stays || !primary) return <AccessDenied lang={lang} />;

  // 和風ライト未対応の部屋なら操作画面へ戻す。
  if (!stays.room.switchbot_wafu_device_id) redirect(`/room/${params.room_id}?lang=${lang}`);

  const token = cookies().get(roomCookieName(params.room_id))?.value;
  const v = verifySession(token);
  const matched = v ? stays.reservations.find((r) => r.id === v.reservationId) : undefined;

  if (!matched) {
    return (
      <PinGate roomSlug={params.room_id} roomName={stays.room.display_name} initialLang={lang} />
    );
  }

  return <WafuDetail roomSlug={params.room_id} lang={lang} />;
}
