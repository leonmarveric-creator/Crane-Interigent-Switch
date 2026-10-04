import { NextRequest, NextResponse } from "next/server";
import { inviteByToken } from "@/lib/keepsake";
import { guestHtml } from "@/lib/keepsakeGuest";

/** 旅の記念 (ゲスト用): 招待くじ → 申し込み → 完成品。合言葉つきのリンク (30 日)。?cabin=1 は車内 iPad 用 (最後に QR を出す) */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await inviteByToken(params.token).catch(() => ({ inv: null, expired: false }));
  const al = (req.headers.get("accept-language") || "").toLowerCase();
  const lang = al.startsWith("ja") ? "ja" : al.startsWith("zh") ? "zh" : al.startsWith("ko") ? "ko" : "en";
  const html = await guestHtml({ inv: r.inv, expired: r.expired, cabin: req.nextUrl.searchParams.get("cabin") === "1", origin: req.nextUrl.origin, token: params.token, lang });
  return new NextResponse(html, { status: r.inv ? 200 : 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
