import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendSesameCommand, SESAME_CMD } from "@/lib/sesame";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { resolveGuestKey, entranceCreds, logEntrance, recentCommandCount } from "@/lib/smartkey";
import { CMD_LIMIT_PER_MIN, checkGeofence } from "@/lib/smartkeyLogic";

export const runtime = "nodejs"; // aes-cmac のため Edge 不可

/**
 * ゲストの鍵操作。
 * POST /api/key/[entrance]/cmd   body: { door: "entrance" | "room", action: "unlock" | "lock" }
 *  - 本人確認済み (ek_ Cookie) かつ 滞在期間中のみ
 *  - 緊急停止中は拒否
 *  - 1分あたり CMD_LIMIT_PER_MIN 回まで
 *  - エントランスの解錠は、位置制限があれば近くにいるときだけ (body.pos = { lat, lng, acc })
 *    位置情報は判定だけに使い、保存しない (ログには距離だけ残す)
 */
export async function POST(req: NextRequest, { params }: { params: { entrance: string } }) {
  const { door, action, pos } = (await req.json().catch(() => ({}))) as {
    door?: string; action?: string; pos?: { lat?: unknown; lng?: unknown; acc?: unknown } | null;
  };
  if ((door !== "entrance" && door !== "room") || (action !== "unlock" && action !== "lock")) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const ctx = await resolveGuestKey(params.entrance);
  if (!ctx) return NextResponse.json({ ok: false, error: "NO_ENTRANCE" }, { status: 404 });
  if (!ctx.reservation || ctx.state === "verify") {
    return NextResponse.json({ ok: false, error: "NOT_VERIFIED" }, { status: 401 });
  }
  if (ctx.state === "before") return NextResponse.json({ ok: false, error: "NOT_STARTED" }, { status: 403 });
  if (ctx.state === "expired") return NextResponse.json({ ok: false, error: "EXPIRED" }, { status: 403 });
  if (!ctx.settings.app_unlock_enabled) {
    return NextResponse.json({ ok: false, error: "STOPPED" }, { status: 423 });
  }
  if ((await recentCommandCount(ctx.reservation.id)) >= CMD_LIMIT_PER_MIN) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
  }

  const guestName = ctx.data.guestName || null;
  const history = `Key:${ctx.reservation.id.slice(0, 8)}`;

  try {
    if (door === "entrance") {
      const creds = entranceCreds(ctx.entrance);
      if (!creds) return NextResponse.json({ ok: false, error: "NO_LOCK" }, { status: 409 });
      // 離れた場所からの誤解錠を防ぐ (施錠はどこからでも可)
      if (action === "unlock") {
        const g = checkGeofence(ctx.entrance, pos);
        if (!g.ok) {
          await logEntrance({
            entrance_id: ctx.entrance.id, room_id: ctx.room?.id ?? null, reservation_id: ctx.reservation.id,
            guest_name: guestName, action: g.error === "GEO_FAR" ? `unlock_far_${g.distance}m` : "unlock_no_location", success: false,
          });
          return NextResponse.json({ ok: false, error: g.error, distance: g.distance }, { status: 403 });
        }
      }
      const r = await sendSesameCommand(creds, action === "unlock" ? SESAME_CMD.UNLOCK : SESAME_CMD.LOCK, history);
      await logEntrance({
        entrance_id: ctx.entrance.id, room_id: ctx.room?.id ?? null, reservation_id: ctx.reservation.id,
        guest_name: guestName, action, success: r.ok,
      });
      return NextResponse.json({ ok: r.ok, error: r.ok ? undefined : "DEVICE_ERROR" }, { status: r.ok ? 200 : 502 });
    }

    // お部屋: 入力した番号に一致した予約の部屋だけ
    if (!ctx.room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });
    const r = await executeDeviceAction(ctx.room, action, history);
    await logEntrance({
      entrance_id: ctx.entrance.id, room_id: ctx.room.id, reservation_id: ctx.reservation.id,
      guest_name: guestName, action: `room_${action}`, success: r.ok,
    });
    await logDevice({ room_id: ctx.room.id, reservation_id: ctx.reservation.id, action, source: "guest", success: r.ok });

    // 部屋の初回解錠で自動ウェルカム (既存 /api/devices と同じ挙動: 1滞在1回)
    if (action === "unlock" && r.ok && !ctx.reservation.welcomed_at) {
      const w = await executeDeviceAction(ctx.room, "welcome", "Auto Welcome");
      await supabaseAdmin.from("reservations").update({ welcomed_at: new Date().toISOString() }).eq("id", ctx.reservation.id);
      await logDevice({ room_id: ctx.room.id, reservation_id: ctx.reservation.id, action: "welcome", source: "guest", success: w.ok });
    }
    return NextResponse.json({ ok: r.ok, error: r.ok ? undefined : (r.error ?? "DEVICE_ERROR") }, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error("smartkey cmd error", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}
