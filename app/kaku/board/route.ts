import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { KS_ASSET_V } from "@/lib/keepsakeGuest";

/** GUEST BOARD (スタッフ): チェックイン済みのゲスト一覧 (出発・到着・パスポート・光目覚まし) と、旅の記念の招待・申し込み・見本 */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!isStaff()) return NextResponse.redirect(new URL("/staff/login?next=/kaku/board", req.url), { status: 302 });
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0d1519"><title>GUEST BOARD</title><link rel="stylesheet" href="/keepsake/board.css?v=${KS_ASSET_V}"></head><body><div class="wrap" id="app"></div><div class="zm" id="zm"></div><script src="/keepsake/board.js?v=${KS_ASSET_V}"></script></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
