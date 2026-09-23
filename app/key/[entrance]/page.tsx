import type { Metadata, Viewport } from "next";
import { resolveGuestKey } from "@/lib/smartkey";
import { toSkLang } from "@/lib/smartkeyI18n";
import SmartKeyGuest from "@/components/smartkey/SmartKeyGuest";
import AccessDenied from "@/components/AccessDenied";

export const dynamic = "force-dynamic"; // 常に現在時刻で判定

export const metadata: Metadata = { title: "Smart Key" };
export const viewport: Viewport = { themeColor: "#0b2f6e" };

/**
 * エントランスのスマートキー (エントランスに貼るQRから開く)。
 *   /key/[entrance]?lang=ja
 *   未確認 → 本人確認 (名前 + 電話番号の下4桁)
 *   確認済 → エントランス / お部屋 の鍵画面
 */
export default async function EntranceKeyPage({
  params, searchParams,
}: { params: { entrance: string }; searchParams: { lang?: string } }) {
  const ctx = await resolveGuestKey(params.entrance);
  if (!ctx) return <AccessDenied lang="en" />;

  const lang = toSkLang(searchParams.lang ?? ctx.reservation?.guest_lang, "en");
  return <SmartKeyGuest data={ctx.data} settings={ctx.settings} state={ctx.state} initialLang={lang} />;
}
