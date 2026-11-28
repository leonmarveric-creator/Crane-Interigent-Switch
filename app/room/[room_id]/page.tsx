import { cookies, headers } from "next/headers";
import ConciergeLink from "@/components/ConciergeLink";
import { getActiveStays } from "@/lib/auth";
import { verifySession, roomCookieName } from "@/lib/roomSession";
import { isLang, type Lang } from "@/lib/i18n";
import { roomLangFromHeader } from "@/lib/acceptLang";
import { LANG_COOKIE } from "@/lib/langCookie";
import AccessDenied from "@/components/AccessDenied";
import PinGate from "@/components/PinGate";
import RoomModeSwitch from "@/components/RoomModeSwitch";
import CheckedOutScreen from "@/components/CheckedOutScreen";
import { getWakeState } from "@/lib/wakeAuto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBootVoice } from "@/lib/bootVoice";
import { passportNameFor } from "@/lib/passportName";
import { guideKeyFor } from "@/lib/nfcGate";
import { loadCraneNestDrops } from "@/lib/craneNest";
import { toCountryCode } from "@/lib/countryCode";
import { toCabinRoom } from "@/lib/cabinData";
import { seasonOf } from "@/lib/roomSeason";

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

  // チェックアウトボタンで退室済み → 操作はもうできない (コンシェルジュの案内だけ)
  if (matched.guest_checkout_at) {
    return <CheckedOutScreen roomSlug={params.room_id} roomName={stays.room.display_name} lang={lang} at={matched.guest_checkout_at} />;
  }

  // 「ようこそ、◯◯様」用の名前と、同じ棟のエントランス鍵画面へのリンク
  // (スマートキーのSQLが未実行でも部屋画面は表示できるよう、エラーは無視)
  const { data: nameRow } = await supabaseAdmin.from("reservations").select("id, guest_name, entrance_name, check_out, guest_token").eq("id", matched.id).maybeSingle();
  // 名前がまだ無ければ、パスポート登録 (チェックイン) の名前を入れる
  if (nameRow && !String((nameRow as any).guest_name ?? "").trim()) {
    const pn = await passportNameFor(nameRow, stays.room);
    if (pn) (nameRow as any).guest_name = pn;
  }
  const ent = ((entRes as any)?.data ?? []).find((e: any) => e.building === (stays.room.building || "Crane Nest")) ?? null;
  const guestName = (nameRow as any)?.guest_name || (nameRow as any)?.entrance_name || null;
  const entranceHref = ent?.slug ? `/key/${ent.slug}` : null;

  // 早朝便の自動光目覚まし (チェックアウトが近い予約だけ送迎予約を見る)
  const wake = await getWakeState(matched.id, stays.room).catch(() => null);

  // あなた専用のコンシェルジュのリンク (チェックアウト + 2 日まで 4 桁なしで開ける) と、ウェルカム映像の名前・国 (パスポート登録から)
  const coAt = (matched as any).late_checkout_at || matched.check_out;
  const myLink = `/g/${encodeURIComponent(params.room_id)}?k=${encodeURIComponent(guideKeyFor({ rid: matched.id, roomSlug: params.room_id, checkOut: coAt }))}`;
  let welcome: { nm: string; cc: string | null; np: number } | null = null;
  try {
    const drops = await loadCraneNestDrops([{ id: matched.id, roomKanji: toCabinRoom(stays.room as any).kanji, checkOut: coAt, token: (nameRow as any)?.guest_token ?? null }]);
    const d = drops[matched.id];
    if (d?.names?.length) welcome = { nm: String(d.names[0]).slice(0, 60), cc: toCountryCode(d.nationality ?? null), np: Math.max(Number(d.pax) || 0, d.names.length) };
  } catch { /* Crane Nest のシステムに繋がらなくても画面は出す */ }
  if (!welcome && guestName) welcome = { nm: String(guestName).slice(0, 60), cc: null, np: 1 };

  return (
    <>
    <RoomModeSwitch
      wake={wake}
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
      myLink={myLink}
      welcome={welcome}
      season={seasonOf(stays.room.display_name)}
    />
    <ConciergeLink room={params.room_id} lang={lang} />
    </>
  );
}
