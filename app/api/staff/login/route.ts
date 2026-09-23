import { NextRequest, NextResponse } from "next/server";
import { staffToken } from "@/lib/staffAuth";
import { setStaffCookie } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** スタッフのパスワード照合 → Cookie 発行 (60日)。 */
export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const token = staffToken();
  if (!token || !password || password !== process.env.STAFF_PASSWORD) {
    await new Promise((r) => setTimeout(r, 600)); // 総当たり対策の遅延
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setStaffCookie(res);
  return res;
}
