import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { craneNestPassportPhotos } from "@/lib/craneNest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 管理画面「LIVE」の顔写真: そのゲスト (送迎予約 drop) のパスポート写真を、画像そのもの (data:) で返す。
 *   ブラウザで顔の部分だけ切り抜く (canvas) ので、別のサイトの画像だと切り抜けない → ここで取ってきて渡す。
 *   保存はしない (cache-control: no-store)。スタッフ・管理者だけ
 */
export async function GET(req: NextRequest) {
  const H = { "cache-control": "no-store, private" };
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: H });
  const drop = req.nextUrl.searchParams.get("drop") || "";
  try {
    const r = await craneNestPassportPhotos(drop);
    if (!r.on) return NextResponse.json({ ok: false, error: "NO_CRANENEST" }, { headers: H });
    const photos = await Promise.all(r.photos.slice(0, 8).map(async (p) => {
      try {
        const res = await fetch(p.url, { cache: "no-store" }); if (!res.ok) return null;
        const type = res.headers.get("content-type") || "image/jpeg"; if (!type.startsWith("image/")) return null;
        const buf = Buffer.from(await res.arrayBuffer()); if (buf.length > 6e6) return null;
        return { name: p.name, data: `data:${type};base64,${buf.toString("base64")}` };
      } catch { return null; }
    }));
    return NextResponse.json({ ok: true, photos: photos.filter(Boolean) }, { headers: H });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { headers: H });
  }
}
