import { NextRequest, NextResponse } from "next/server";
import { nfcData, nfcHtml } from "@/lib/nfcGuide";

/** NFC シール / QR から開くゲスト用ガイド。例: /g/haru · /g/haru?s=wc (トイレの画面から) · /g/lounge?s=gacha */
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, { params }: { params: { room: string } }) {
  const html = nfcHtml(await nfcData(params.room));
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
