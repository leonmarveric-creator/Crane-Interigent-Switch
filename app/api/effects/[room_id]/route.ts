import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeRoomRequest } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { LIGHT_FX, FX_DAILY_LIMIT, FX_RESTORE, fxFrameCommands, drawFortune, jstDayKey, type LightFx } from "@/lib/lightEffects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 隠しコマンドの光の演出 (和風ライト)。画面の演出に合わせて、ブラウザが 1 コマずつ呼ぶ。
 *   POST /api/effects/[room_id]  body: { fx, frame: number | "restore", startedAt? }
 *   認証: 部屋の PIN セッション Cookie (管理画面テストは管理者 Cookie)。
 *   frame 0 で 1 日の上限 (FX_DAILY_LIMIT) を確認 → 超えていたら limited (画面の演出だけ流す)。
 *   演出中にゲストが他の灯りを操作したら stop を返して演出をやめる (操作を上書きしない)。
 */
export async function POST(req: NextRequest, { params }: { params: { room_id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { fx?: string; frame?: number | "restore"; startedAt?: string };
  const fx = body.fx as LightFx;
  if (!LIGHT_FX.includes(fx)) return NextResponse.json({ ok: false, error: "BAD_FX" }, { status: 400 });

  let room: any = null;
  let reservationId: string | null = null;
  const stay = await authorizeRoomRequest(params.room_id);
  if (stay) { room = stay.room; reservationId = stay.reservation.id; }
  else {
    const token = cookies().get(ADMIN_COOKIE)?.value;
    if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
    }
    const { data } = await supabaseAdmin.from("rooms").select("*").eq("slug", params.room_id).maybeSingle();
    room = data;
  }
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });
  if (!room.switchbot_wafu_device_id) return NextResponse.json({ ok: true, noLight: true });
  const source = stay ? "guest" as const : "admin" as const;

  // 演出の開始後に、ゲストが灯りを操作していたらやめる
  if (body.frame !== 0 && body.startedAt) {
    const { data: touched } = await supabaseAdmin.from("device_logs").select("id")
      .eq("room_id", room.id).gt("created_at", body.startedAt).neq("source", "cron").not("action", "like", "fx_%").limit(1);
    if (touched?.length) return NextResponse.json({ ok: true, stop: true });
  }

  const cmds = body.frame === "restore"
    ? [{ action: "wafu_temp" as const, value: String(FX_RESTORE.kelvin) }, { action: "wafu_brightness" as const, value: String(FX_RESTORE.brightness) }]
    : fxFrameCommands(fx, Number(body.frame), fx === "omikuji" ? drawFortune(room.slug, jstDayKey()).rgb : undefined);
  if (!cmds.length) return NextResponse.json({ ok: true, stop: true });

  let startedAt: string | undefined;
  if (body.frame === 0) {
    // 1 部屋 1 日の上限 (日本時間の 0 時から数える)
    const since = new Date(`${jstDayKey()}T00:00:00+09:00`).toISOString();
    const { count } = await supabaseAdmin.from("device_logs").select("id", { count: "exact", head: true })
      .eq("room_id", room.id).eq("action", "fx_start").gte("created_at", since);
    if ((count ?? 0) >= FX_DAILY_LIMIT) return NextResponse.json({ ok: true, limited: true });
    startedAt = new Date().toISOString();
    await logDevice({ room_id: room.id, reservation_id: reservationId, action: "fx_start", source, success: true });
  }

  // 命令は 1 つずつ順番に (点灯 → 色 → 明るさ の順が崩れないように)。
  // 灯りの操作なので、Dream Fade 中なら Dream Fade は止まる (演出の後は電球色に戻る)。
  let ok = true;
  for (const c of cmds) {
    try {
      const r = await executeDeviceAction(room, c.action, "Light FX", c.value);
      ok = ok && r.ok;
    } catch { ok = false; }
  }
  return NextResponse.json({ ok, startedAt });
}
