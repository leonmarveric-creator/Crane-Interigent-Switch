import { NextRequest, NextResponse } from "next/server";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type GalaxyAutoOffRoom = {
  id: string;
  switchbot_galaxy_device_id: string | null;
  switchbot_token: string | null;
  switchbot_secret: string | null;
  galaxy_auto_off_at: string | null;
};

/**
 * ギャラクシーモード自動OFF Cron (1〜5分毎推奨)。
 * galaxy_auto_off_at を過ぎた部屋のプラネタリウムをOFFにする。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: rooms, error } = await supabaseAdmin
    .from("rooms")
    .select("id, switchbot_galaxy_device_id, switchbot_token, switchbot_secret, galaxy_auto_off_at")
    .eq("is_active", true)
    .not("switchbot_galaxy_device_id", "is", null)
    .not("galaxy_auto_off_at", "is", null)
    .lte("galaxy_auto_off_at", nowIso);

  if (error) {
    console.error("galaxy auto-off query failed", error);
    return NextResponse.json({ ok: false, error: "QUERY_FAILED" }, { status: 500 });
  }

  const dueRooms = (rooms ?? []) as GalaxyAutoOffRoom[];
  let turnedOff = 0;
  let failed = 0;
  await Promise.all(dueRooms.map(async (room) => {
    const dueAt = typeof room.galaxy_auto_off_at === "string" ? room.galaxy_auto_off_at : undefined;
    if (!dueAt) return;

    const { data: claimed } = await supabaseAdmin
      .from("rooms")
      .update({ galaxy_auto_off_at: null })
      .eq("id", room.id)
      .eq("galaxy_auto_off_at", dueAt)
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    const r = await executeDeviceAction(room, "galaxy_off", "Galaxy Auto Off", dueAt);
    await logDevice({ room_id: room.id, action: "galaxy_off", source: "cron", success: r.ok });
    if (r.ok) turnedOff++;
    else {
      failed++;
      await supabaseAdmin
        .from("rooms")
        .update({ galaxy_auto_off_at: dueAt })
        .eq("id", room.id)
        .is("galaxy_auto_off_at", null);
    }
  }));

  return NextResponse.json({
    ok: true,
    scanned: dueRooms.length,
    turnedOff,
    failed,
    ranAt: nowIso,
  });
}
