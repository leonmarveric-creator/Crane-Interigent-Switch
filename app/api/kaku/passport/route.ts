import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { craneNestPassportPhotos } from "@/lib/craneNest";

/** K-OPS のゲスト画面: ボタンを押したときだけ、そのゲストのパスポート写真 (5 分だけ見られるリンク) を返す */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const drop = req.nextUrl.searchParams.get("drop") || "";
  try {
    const r = await craneNestPassportPhotos(drop);
    return NextResponse.json(r.on ? { ok: true, photos: r.photos } : { ok: false, error: "NO_CRANENEST" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { headers: { "cache-control": "no-store" } });
  }
}
