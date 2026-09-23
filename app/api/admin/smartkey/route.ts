import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/lib/adminAuth";
import { sendSesameCommand, getSesameStatus, SESAME_CMD } from "@/lib/sesame";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { entranceCreds, logEntrance } from "@/lib/smartkey";

export const runtime = "nodejs";

/**
 * 管理画面からの実機操作 (マスター専用・緊急停止中でも操作可)。
 * POST /api/admin/smartkey
 *   { target: "entrance", entranceId, action: "unlock" | "lock" | "status" }
 *   { target: "room", roomSlug, action: "unlock" | "lock" }
 */
export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { target, entranceId, roomSlug, action } = (await req.json().catch(() => ({}))) as {
    target?: string; entranceId?: string; roomSlug?: string; action?: string;
  };

  try {
    if (target === "entrance") {
      const { data: e } = await supabaseAdmin.from("entrances").select("*").eq("id", entranceId ?? "").maybeSingle();
      if (!e) return NextResponse.json({ ok: false, error: "NO_ENTRANCE" }, { status: 404 });
      const creds = entranceCreds(e);
      if (!creds) return NextResponse.json({ ok: false, error: "NO_LOCK" }, { status: 409 });

      if (action === "status") {
        const s = await getSesameStatus(creds);
        return NextResponse.json({ ...s, error: s.ok ? undefined : "DEVICE_ERROR" }, { status: s.ok ? 200 : 502 });
      }
      if (action !== "unlock" && action !== "lock") return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
      const r = await sendSesameCommand(creds, action === "unlock" ? SESAME_CMD.UNLOCK : SESAME_CMD.LOCK, "Admin");
      await logEntrance({ entrance_id: e.id, action, source: "admin", success: r.ok });
      return NextResponse.json({ ok: r.ok, error: r.ok ? undefined : "DEVICE_ERROR" }, { status: r.ok ? 200 : 502 });
    }

    if (target === "room") {
      if (action !== "unlock" && action !== "lock") return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
      const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("slug", roomSlug ?? "").maybeSingle();
      if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });
      const r = await executeDeviceAction(room, action, "Admin");
      await logDevice({ room_id: room.id, action, source: "admin", success: r.ok });
      await logEntrance({ entrance_id: null, room_id: room.id, action: `room_${action}`, source: "admin", success: r.ok });
      return NextResponse.json({ ok: r.ok, error: r.ok ? undefined : (r.error ?? "DEVICE_ERROR") }, { status: r.ok ? 200 : 502 });
    }

    return NextResponse.json({ ok: false, error: "BAD_TARGET" }, { status: 400 });
  } catch (e) {
    console.error("admin smartkey error", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}
