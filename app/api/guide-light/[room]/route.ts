import { NextRequest, NextResponse } from "next/server";
import { authorizeRoomRequest } from "@/lib/auth";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { isLightPref, saveLightPref } from "@/lib/arrivalLight";
import { guideRidFromKey } from "@/lib/nfcGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * コンシェルジュの「お部屋の明かり」: 和の灯り / ふつうの明かり
 * POST /api/guide-light/[room]  body: { mode: "wafu" | "normal", k?: コンシェルジュの URL の署名 }
 * - まだ部屋に入っていない (送迎中など) → 選んだ明かりを保存するだけ。着いて鍵を開けたときにその明かりがつく (電気代の節約)
 * - 部屋に入ったあと → その場で切り替える
 * 認証: お部屋の Cookie (宿泊中)。チェックイン時刻前の送迎中は Cookie が無いので、コンシェルジュの署名 (k) で確かめる
 */
export async function POST(req: NextRequest, { params }: { params: { room: string } }) {
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown; k?: unknown };
  const mode = body.mode;
  if (!isLightPref(mode)) return NextResponse.json({ ok: false, error: "BAD" }, { status: 400 });
  const deny = (e: string) => NextResponse.json({ ok: false, error: e }, { status: 403 });

  let rid: string | null = null, room: any = null;
  const stay = await authorizeRoomRequest(params.room);
  if (stay) { rid = stay.reservation.id; room = stay.room; }
  else {
    rid = guideRidFromKey(typeof body.k === "string" ? body.k : null);
    if (!rid) return deny("ACCESS_DENIED");
    const { data: r } = await supabaseAdmin.from("reservations").select("room_id, assigned_room_id, check_out").eq("id", rid).maybeSingle();
    if (!r || Date.parse(r.check_out) < Date.now()) return deny("ACCESS_DENIED");
    const { data: rm } = await supabaseAdmin.from("rooms").select("*").eq("id", r.assigned_room_id || r.room_id).maybeSingle();
    if (!rm || String(rm.slug).toLowerCase() !== decodeURIComponent(params.room).toLowerCase()) return deny("ACCESS_DENIED");
    room = rm;
  }
  let st = await supabaseAdmin.from("reservations").select("welcomed_at, guest_checkout_at").eq("id", rid).maybeSingle();
  if (st.error) st = await supabaseAdmin.from("reservations").select("welcomed_at").eq("id", rid).maybeSingle() as any;
  const cur: any = st.data ?? {};
  if (cur.guest_checkout_at) return deny("CHECKED_OUT");

  const saved = await saveLightPref(rid, mode).catch(() => false);
  // まだ部屋に入っていない → 保存だけ。Cookie が無い (チェックイン前) ときも、その場では点けない
  if (!cur.welcomed_at || !stay) {
    return NextResponse.json(saved ? { ok: true, live: false } : { ok: false, error: "SETUP" }, { status: saved ? 200 : 500 });
  }
  const action = mode === "wafu" ? "wafu_mode" : "normal";
  try {
    const r = await executeDeviceAction(room, action, "Concierge light");
    await logDevice({ room_id: room.id, reservation_id: rid, action, source: "guest", success: r.ok }).catch(() => {});
    return NextResponse.json({ ok: r.ok, live: true, error: r.error }, { status: r.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}
