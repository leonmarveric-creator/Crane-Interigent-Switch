import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rpFromRequest, setChallenge } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** Face ID / 指紋ログインを始める。 */
export async function POST(req: NextRequest) {
  const { data, error } = await supabaseAdmin.from("staff_passkeys").select("id, transports");
  if (error || !data?.length) return NextResponse.json({ ok: false, error: "NO_PASSKEYS" }, { status: 404 });
  const { rpID } = rpFromRequest(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: data.map((c: any) => ({ id: c.id, transports: c.transports ?? [] })),
  });
  const res = NextResponse.json({ ok: true, options });
  setChallenge(res, "auth", options.challenge);
  return res;
}
