import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ControlPanel from "@/components/ControlPanel";
import AccessDenied from "@/components/AccessDenied";
import { isLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * 管理画面からのテスト用: ゲスト操作画面を PIN不要 で表示 (admin認証済み前提)。
 * /admin/test/[room_id]?lang=ja   (middlewareで /admin 配下は保護済み)
 * デバイス操作は admin専用エンドポイント経由 (ControlPanel admin モード)。
 */
export default async function AdminTestRoomPage({
  params,
  searchParams,
}: {
  params: { room_id: string };
  searchParams: { lang?: string };
}) {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("slug, display_name, image_url, switchbot_galaxy_device_id, switchbot_wafu_device_id")
    .eq("slug", params.room_id)
    .maybeSingle();

  const lang: Lang = isLang(searchParams.lang) ? searchParams.lang : "ja";

  if (!room) return <AccessDenied lang={lang} />;

  return (
    <ControlPanel
      roomSlug={room.slug}
      roomName={room.display_name}
      checkOut={new Date().toISOString()}
      initialLang={lang}
      admin
      imageUrl={room.image_url}
      hasGalaxy={!!room.switchbot_galaxy_device_id}
      hasWafu={!!room.switchbot_wafu_device_id}
    />
  );
}
