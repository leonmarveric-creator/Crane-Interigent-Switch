import { NextRequest, NextResponse } from "next/server";
import { nfcData, nfcHtml } from "@/lib/nfcGuide";
import { guideAccess, gateHtml } from "@/lib/nfcGate";

/** NFC シール / QR から開くゲスト用ガイド (コンシェルジュ)。例: /g/haru · /g/haru?s=wc (トイレの画面から) · /g/lounge?s=gacha
 *  ゲストの 4 桁 (エントランスの鍵と同じ) で確認してから見られる。確認済みならそのまま入れる (チェックアウトまで) */
export const dynamic = "force-dynamic";
const H = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" };
export async function GET(req: NextRequest, { params }: { params: { room: string } }) {
  const acc = await guideAccess(params.room);
  if (!acc.ok) {
    if (!("entranceSlug" in acc)) return NextResponse.redirect(new URL(acc.redirect + (req.nextUrl.search || ""), req.url), { status: 302, headers: { "cache-control": "no-store" } });
    return new NextResponse(gateHtml({ entranceSlug: acc.entranceSlug, roomSlug: acc.roomSlug, roomKanji: acc.roomKanji }), { headers: H });
  }
  const html = nfcHtml(await nfcData(params.room, acc.codes, acc.co ?? null));
  return new NextResponse(html, { headers: H });
}
