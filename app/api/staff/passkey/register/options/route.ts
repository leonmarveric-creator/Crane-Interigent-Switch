import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";
import { RP_NAME, rpFromRequest, setChallenge } from "@/lib/staffPasskey";

export const runtime = "nodejs";

/** Face ID / 指紋の登録を始める (ログイン済みのスタッフだけ)。 */
export async function POST(req: NextRequest) {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("staff_passkeys").select("id, transports");
  if (error) return NextResponse.json({ ok: false, error: "SETUP_MISSING" }, { status: 500 });
  const { rpID } = rpFromRequest(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: "Xiaobo",
    userDisplayName: "Xiaobo",
    userID: new TextEncoder().encode("crane-staff"),
    attestationType: "none",
    excludeCredentials: (data ?? []).map((c: any) => ({ id: c.id, transports: c.transports ?? [] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  const res = NextResponse.json({ ok: true, options });
  setChallenge(res, "reg", options.challenge);
  return res;
}
