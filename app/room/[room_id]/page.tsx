import { cookies, headers } from "next/headers";
import { getActiveStays } from "@/lib/auth";
import { verifySession, roomCookieName } from "@/lib/roomSession";
import { isLang, type Lang } from "@/lib/i18n";
import { roomLangFromHeader } from "@/lib/acceptLang";
import { LANG_COOKIE } from "@/lib/langCookie";
import AccessDenied from "@/components/AccessDenied";
import PinGate from "@/components/PinGate";
import RoomModeSwitch from "@/components/RoomModeSwitch";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBootVoice } from "@/lib/bootVoice";

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
  // 滞在の確認と、エントランス一覧の取得を同時に (切り替えを速く)
  const [stays, entRes, bootVoice] = await Promise.all([
    getActiveStays(params.room_id),
    supabaseAdmin.from("entrances").select("slug, building").eq("is_active", true).order("slug")
      .then((r) => r, () => ({ data: null })),
    getBootVoice(),
  ]);
  const primary = stays?.reservations[0];

  // 言語: ?lang= → ゲストが前に選んだ言語 (Cookie) → スマホの言語設定 → 予約の言語 → 英語
  const savedRaw = cookies().get(LANG_COOKIE)?.value;
  const saved = savedRaw?.startsWith("zh") ? "zh" : savedRaw;
  const phoneLang = roomLangFromHeader(headers().get("accept-language"));
  const lang: Lang = isLang(searchParams.lang)
    ? searchParams.lang
    : isLang(saved)
    ? saved
    : phoneLang
    ? phoneLang
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

  // 「ようこそ、◯◯様」用の名前と、同じ棟のエントランス鍵画面へのリンク
  // (スマートキーのSQLが未実行でも部屋画面は表示できるよう、エラーは無視)
  const { data: nameRow } = await supabaseAdmin.from("reservations").select("guest_name, entrance_name").eq("id", matched.id).maybeSingle();
  const ent = ((entRes as any)?.data ?? []).find((e: any) => e.building === (stays.room.building || "Crane Nest")) ?? null;
  const guestName = (nameRow as any)?.entrance_name || (nameRow as any)?.guest_name || null;
  const entranceHref = ent?.slug ? `/key/${ent.slug}` : null;

  return (
    <RoomModeSwitch
      guestName={guestName}
      entranceHref={entranceHref}
      roomSlug={params.room_id}
      roomName={stays.room.display_name}
      checkOut={matched.check_out}
      initialLang={lang}
      imageUrl={stays.room.image_url}
      posterUrl={`/rooms/poster-${params.room_id}.jpg`}
      lat={stays.room.lat}
      lng={stays.room.lng}
      radiusM={stays.room.geofence_radius_m}
      hasGalaxy={!!stays.room.switchbot_galaxy_device_id}
      hasNest={!!stays.room.switchbot_nest_device_id}
      hasWafu={!!stays.room.switchbot_wafu_device_id}
      bootVoice={bootVoice}
    />
  );
}
