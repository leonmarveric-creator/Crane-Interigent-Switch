import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { loadCheers, markCheersSeen } from "@/lib/guestCheers";
import { VOICES_HTML } from "@/lib/voicesPage";

/**
 * お母さんの画面「来自世界的声音」: ゲストがチェックアウトで送ったひとことが、星空に流れる。
 *   新しい声から先に流し、開いたら「見た」にする (スタッフ画面のお知らせが消える)。
 */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!isStaff()) return NextResponse.redirect(new URL("/staff/login", req.url), { status: 302 });
  const { voices } = await loadCheers();
  await markCheersSeen();
  const html = VOICES_HTML.replace("__DATA__", JSON.stringify({ voices }).replace(/</g, "\\u003c"));
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
