import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { redirect } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import AccessDenied from "@/components/AccessDenied";
import WafuDetail from "@/components/WafuDetail";

export const dynamic = "force-dynamic";

/**
 * 和風ライト詳細設定 (管理画面テスト用・PIN不要)。
 * /admin/test/[room_id]/light?lang=ja  (middlewareで /admin 配下は保護済み)
 */
export default async function AdminWafuLightPage({
  params,
  searchParams,
}: {
  params: { room_id: string };
  searchParams: { lang?: string };
}) {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("slug, display_name, switchbot_wafu_device_id")
    .eq("slug", params.room_id)
    .maybeSingle();

  const lang: Lang = isLang(searchParams.lang) ? searchParams.lang : "ja";

  if (!room) return <AccessDenied lang={lang} />;
  if (!room.switchbot_wafu_device_id) redirect(`/admin/test/${params.room_id}?lang=${lang}`);

  return <WafuDetail roomSlug={room.slug} lang={lang} admin />;
}
