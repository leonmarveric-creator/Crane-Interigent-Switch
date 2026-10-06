import { NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

/**
 * 「すぐ知らせる」ための接続先 (Supabase Realtime)。スタッフだけに渡す。
 *   環境変数 SUPABASE_ANON_KEY (Supabase の anon / publishable キー) が無ければ key は null。
 *   そのときは、今までどおり一定の間隔で聞きに行くだけになる (遅くなるだけで、動きは同じ)。
 *   ここで流すのは「変わったよ」の合図だけ。中身は今までどおりこのサーバーから読む。
 */
export async function GET() {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const url = process.env.SUPABASE_URL || null, key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
  return NextResponse.json({ ok: true, url, key: url ? key : null }, { headers: { "cache-control": "no-store" } });
}
