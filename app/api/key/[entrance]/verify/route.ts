import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, roomCookieName, signScopedSession } from "@/lib/roomSession";
import {
  getEntranceBySlug, getBuildingRooms, logEntrance, ENTRANCE_SCOPE, entranceCookieName,
} from "@/lib/smartkey";
import { pickReservation, effectiveRoomId, VERIFY_EARLY_MS, SESSION_GRACE_MS } from "@/lib/smartkeyLogic";

export const runtime = "nodejs";

// ブルートフォース対策 (pin_attempts を流用)
//  - 同じ端末(IP): 10分で6回失敗 → 一時ロック
//  - エントランス全体: 10分で40回失敗 → 一時ロック (分散攻撃対策)
const WINDOW_MIN = 10;
const MAX_FAILS_IP = 6;
const MAX_FAILS_ENTRANCE = 40;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * エントランスの本人確認。名前 + 電話番号の下4桁(= 予約の unlock_pin)を照合し、
 * この棟に泊まる予約が見つかれば、エントランス用セッションと部屋用セッションを発行。
 * POST /api/key/[entrance]/verify   body: { name, digits }
 */
export async function POST(req: NextRequest, { params }: { params: { entrance: string } }) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; digits?: string };
  const name = String(body.name ?? "").trim().slice(0, 60);
  const digits = String(body.digits ?? "").replace(/\D/g, "").slice(0, 6);
  if (!name || digits.length < 4) {
    return NextResponse.json({ ok: false, error: "MISSING" }, { status: 400 });
  }

  const entrance = await getEntranceBySlug(params.entrance);
  if (!entrance) return NextResponse.json({ ok: false, error: "NO_ENTRANCE" }, { status: 404 });

  const ipKey = `entrance:${entrance.slug}:${clientIp(req)}`;
  const allKey = `entrance:${entrance.slug}`;
  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const [{ count: ipFails }, { count: allFails }] = await Promise.all([
    supabaseAdmin.from("pin_attempts").select("id", { count: "exact", head: true }).eq("room_slug", ipKey).gte("created_at", since),
    supabaseAdmin.from("pin_attempts").select("id", { count: "exact", head: true }).like("room_slug", `${allKey}:%`).gte("created_at", since),
  ]);
  if ((ipFails ?? 0) >= MAX_FAILS_IP || (allFails ?? 0) >= MAX_FAILS_ENTRANCE) {
    return NextResponse.json({ ok: false, error: "LOCKED", retryAfterMin: WINDOW_MIN }, { status: 429 });
  }

  const rooms = await getBuildingRooms(entrance.building);
  const roomIds = rooms.map((r) => r.id);
  const now = Date.now();

  let candidates: any[] = [];
  if (roomIds.length > 0) {
    const ids = roomIds.join(",");
    const { data } = await supabaseAdmin
      .from("reservations")
      .select("id, room_id, assigned_room_id, unlock_pin, guest_name, entrance_name, check_in, check_out, status")
      .eq("status", "active")
      .eq("unlock_pin", digits)
      .gt("check_out", new Date(now).toISOString())
      .lte("check_in", new Date(now + VERIFY_EARLY_MS).toISOString())
      .or(`assigned_room_id.in.(${ids}),and(assigned_room_id.is.null,room_id.in.(${ids}))`);
    candidates = data ?? [];
  }

  const picked = pickReservation(candidates, { name, digits }, roomIds, now);
  if (!picked.ok) {
    if (picked.error === "BAD_CODE") await supabaseAdmin.from("pin_attempts").insert({ room_slug: ipKey });
    await logEntrance({ entrance_id: entrance.id, guest_name: name, action: "verify_fail", success: false });
    return NextResponse.json({ ok: false, error: picked.error }, { status: picked.error === "AMBIGUOUS" ? 409 : 401 });
  }

  const r = picked.reservation;
  const room = rooms.find((x) => x.id === effectiveRoomId(r));
  await supabaseAdmin.from("pin_attempts").delete().eq("room_slug", ipKey);
  await supabaseAdmin.from("reservations")
    .update({ entrance_name: name, entrance_verified_at: new Date().toISOString() })
    .eq("id", r.id);
  await logEntrance({ entrance_id: entrance.id, room_id: room?.id ?? null, reservation_id: r.id, guest_name: name, action: "verify", success: true });

  const checkOut = new Date(r.check_out).getTime();
  const keyExp = checkOut + SESSION_GRACE_MS;
  const res = NextResponse.json({ ok: true });
  const cookieBase = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  res.cookies.set(entranceCookieName(entrance.slug), signScopedSession(ENTRANCE_SCOPE, r.id, keyExp), {
    ...cookieBase, expires: new Date(keyExp),
  });
  // 部屋の操作パネル(/room/[slug])も PIN 入力なしで開けるよう、同じ予約の部屋セッションも発行
  if (room) {
    res.cookies.set(roomCookieName(room.slug), signSession(r.id, checkOut), {
      ...cookieBase, expires: new Date(checkOut),
    });
  }
  return res;
}

/** 本人確認をやり直す (エントランスのセッションを破棄)。 */
export async function DELETE(_req: NextRequest, { params }: { params: { entrance: string } }) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(entranceCookieName(params.entrance), "", { path: "/", expires: new Date(0) });
  return res;
}
