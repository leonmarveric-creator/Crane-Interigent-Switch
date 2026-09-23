import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { b64u, clearChallenge, readChallenge, rpFromRequest, setStaffCookie } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** Face ID / 指紋ログインの確認 → パスワードログインと同じ Cookie (60日) を発行。 */
export async function POST(req: NextRequest) {
  const challenge = readChallenge(req, "auth");
  if (!challenge) return NextResponse.json({ ok: false, error: "EXPIRED" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const { data: cred } = await supabaseAdmin.from("staff_passkeys").select("*").eq("id", id).maybeSingle();
  if (!cred) return NextResponse.json({ ok: false, error: "UNKNOWN" }, { status: 401 });
  const { rpID, origin } = rpFromRequest(req);
  try {
    const v = await verifyAuthenticationResponse({
      response: body, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: cred.id, publicKey: b64u.dec(cred.public_key), counter: Number(cred.counter) || 0, transports: cred.transports ?? [] },
    });
    if (!v.verified) return NextResponse.json({ ok: false, error: "NOT_VERIFIED" }, { status: 401 });
    await supabaseAdmin.from("staff_passkeys")
      .update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", cred.id);
    const res = NextResponse.json({ ok: true });
    if (!setStaffCookie(res)) return NextResponse.json({ ok: false, error: "NO_STAFF_PASSWORD" }, { status: 500 });
    clearChallenge(res);
    return res;
  } catch (e) {
    console.error("passkey login", e);
    return NextResponse.json({ ok: false, error: "NOT_VERIFIED" }, { status: 401 });
  }
}
