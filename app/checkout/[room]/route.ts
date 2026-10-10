import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";
import { findCheckoutStay } from "@/lib/guestCheckout";
import { CO_T, checkoutWindow, coLang } from "@/lib/checkoutText";
import { CHECKOUT_HTML } from "@/lib/checkoutPage";
import { LANG_COOKIE } from "@/lib/langCookie";
import { CHEER_A, CHEER_B, CHEER_C, CHEER_COUNTRIES, CHEER_POPULAR, CHEER_UI } from "@/lib/cheerText";

/**
 * ゲストのチェックアウト画面 (お部屋の操作画面・コンシェルジュの「チェックアウトする」から開く)。
 *   /checkout/haru?via=room|concierge&lang=ja   ·   スタッフの確認用: ?demo=1 (電源は切らない・記録しない)
 *   本人確認ができなければ、コンシェルジュ (4 桁の確認) へ。
 */
export const dynamic = "force-dynamic";
const H = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" };

export async function GET(req: NextRequest, { params }: { params: { room: string } }) {
  const slug = decodeURIComponent(params.room || "").trim().toLowerCase();
  const sp = req.nextUrl.searchParams;
  const via = sp.get("via") === "concierge" ? "concierge" : "room";
  const demo = sp.get("demo") === "1" && isStaff();

  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("slug", slug).maybeSingle();
  if (!room) return NextResponse.redirect(new URL("/g/lounge", req.url), { status: 302, headers: { "cache-control": "no-store" } });

  let open = true, done: string | null = null, guestLang: string | null = null;
  if (!demo) {
    const stay = await findCheckoutStay(slug);
    if (!stay) return NextResponse.redirect(new URL(`/g/${encodeURIComponent(slug)}${req.nextUrl.search || ""}`, req.url), { status: 302, headers: { "cache-control": "no-store" } });
    done = stay.reservation.guest_checkout_at ?? null;
    open = checkoutWindow(stay.reservation.check_out, Date.now()).open;
    guestLang = stay.reservation.guest_lang ?? null;
  }
  const saved = cookies().get(LANG_COOKIE)?.value;
  const q = encodeURIComponent(slug);
  const data = {
    room: `${room.display_name ?? slug}`,
    lang: coLang(saved || guestLang || "en"),
    via, demo, open, done,
    api: `/api/checkout/${q}`,
    back: via === "concierge" ? `/g/${q}` : demo ? `/admin/test/${q}` : `/room/${q}`,
    concierge: `/g/${q}`,
    devs: {
      ac: !!room.switchbot_ac_device_id, light: !!room.switchbot_light_device_id,
      wafu: !!room.switchbot_wafu_device_id, galaxy: !!room.switchbot_galaxy_device_id,
    },
    T: CO_T,
    // 最後にひとこと (みんなの声)
    cheer: { P: { A: CHEER_A, B: CHEER_B, C: CHEER_C }, CT: CHEER_COUNTRIES, POP: CHEER_POPULAR, UI: CHEER_UI },
  };
  const html = CHECKOUT_HTML.replace("__DATA__", JSON.stringify(data).replace(/</g, "\\u003c"));
  return new NextResponse(html, { headers: H });
}
