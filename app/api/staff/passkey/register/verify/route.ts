import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";
import { b64u, clearChallenge, deviceName, readChallenge, rpFromRequest } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** 登録の確認 → 公開鍵を保存。 */
export async function POST(req: NextRequest) {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const challenge = readChallenge(req, "reg");
  if (!challenge) return NextResponse.json({ ok: false, error: "EXPIRED" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const { rpID, origin } = rpFromRequest(req);
  try {
    const v = await verifyRegistrationResponse({
      response: body, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    });
    if (!v.verified || !v.registrationInfo) return NextResponse.json({ ok: false, error: "NOT_VERIFIED" }, { status: 400 });
    const c = v.registrationInfo.credential;
    const { error } = await supabaseAdmin.from("staff_passkeys").upsert({
      id: c.id, public_key: b64u.enc(c.publicKey), counter: c.counter, transports: c.transports ?? [],
      device_name: deviceName(req.headers.get("user-agent")),
    });
    if (error) return NextResponse.json({ ok: false, error: "SAVE_FAILED" }, { status: 500 });
    const res = NextResponse.json({ ok: true });
    clearChallenge(res);
    return res;
  } catch (e) {
    console.error("passkey register", e);
    return NextResponse.json({ ok: false, error: "NOT_VERIFIED" }, { status: 400 });
  }
}
