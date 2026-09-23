import { NextRequest, NextResponse } from "next/server";
import { staffToken } from "@/lib/staffAuth";
import { setStaffCookie } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** スタッフのパスワード照合 → Cookie 発行 (60日)。 */
export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const token = staffToken();
  // 環境変数が未設定 (または設定後に再デプロイしていない) ときは、それが分かるように返す
  if (!token) return NextResponse.json({ ok: false, error: "NOT_CONFIGURED" }, { status: 500 });
  // 前後の空白は無視して比べる (コピペで入った空白・改行対策)
  if (!password || password.trim() !== (process.env.STAFF_PASSWORD ?? "").trim()) {
    await new Promise((r) => setTimeout(r, 600)); // 総当たり対策の遅延
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setStaffCookie(res);
  return res;
}
