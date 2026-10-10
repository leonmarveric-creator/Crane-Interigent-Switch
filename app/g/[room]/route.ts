import { NextRequest, NextResponse } from "next/server";
import { nfcData, nfcHtml } from "@/lib/nfcGuide";
import { guideAccess, guideAccessByKey, guideKeyFor, gateHtml } from "@/lib/nfcGate";

/** NFC シール / QR から開くゲスト用ガイド (コンシェルジュ)。例: /g/haru · /g/haru?s=wc (トイレの画面から) · /g/lounge?s=gacha
 *  ゲストの 4 桁 (エントランスの鍵と同じ) で確認してから見られる。確認できたら /g/[自分の部屋]?k=… に移す。
 *  この URL をホーム画面に追加すれば、次からは 4 桁なしで開ける (チェックアウトまで) */
export const dynamic = "force-dynamic";
const H = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" };
const noStore = { "cache-control": "no-store" };

/** 今の URL の ?s= / ?lang= などは残して、行き先と k を差し替える */
function withParams(req: NextRequest, path: string, k?: string | null) {
  const u = new URL(path, req.url);
  req.nextUrl.searchParams.forEach((v, key) => { if (key !== "k") u.searchParams.set(key, v); });
  if (k) u.searchParams.set("k", k);
  return u;
}

export async function GET(req: NextRequest, { params }: { params: { room: string } }) {
  // 1) ホーム画面の URL (?k=…) で開いた
  const k = req.nextUrl.searchParams.get("k");
  if (k) {
    const a = await guideAccessByKey(params.room, k);
    if (a && !a.ok) return NextResponse.redirect(withParams(req, a.redirect, k), { status: 302, headers: noStore });
    if (a && a.ok) {
      const res = new NextResponse(nfcHtml(await nfcData(a.roomSlug, a.codes, a.co)), { headers: H });
      for (const c of a.cookies) res.cookies.set(c.name, c.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: c.expires });
      return res;
    }
    // 期限切れなど → いつもの確認へ (下)
  }

  // 2) Cookie (エントランス・お部屋で確認済み) / 4 桁の画面
  const acc = await guideAccess(params.room);
  if (!acc.ok) {
    if (!("entranceSlug" in acc)) return NextResponse.redirect(withParams(req, acc.redirect, null), { status: 302, headers: noStore });
    return new NextResponse(gateHtml({ entranceSlug: acc.entranceSlug, roomSlug: acc.roomSlug, roomKanji: acc.roomKanji }), { headers: H });
  }
  // 確認済みのゲスト → ホーム画面に追加できる URL (?k=…) へ
  if (acc.guest) return NextResponse.redirect(withParams(req, `/g/${encodeURIComponent(acc.guest.roomSlug)}`, guideKeyFor(acc.guest)), { status: 302, headers: noStore });
  const html = nfcHtml(await nfcData(params.room, acc.codes, acc.co ?? null));
  return new NextResponse(html, { headers: H });
}
