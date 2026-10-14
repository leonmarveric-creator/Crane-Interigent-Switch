import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { toCabinRoom } from "@/lib/cabinData";
import { holoRoomOf } from "@/lib/cabinHolo";
import { fromLogs, withHooks, occupancy, needsAlert, type Part, type RoomLive } from "@/lib/buildingState";
import { withEffectiveTimes } from "@/lib/stayTimes";
import { webhookQuery, webhookSetup } from "@/lib/switchbot";
import { webhookUrl } from "@/lib/switchbotWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 管理画面「LIVE」: 建物の今の状態 (lib/buildingState.ts)。
 *   GET  … 部屋ごとの明かり・エアコン・宿泊の状態。データベースを読むだけ (SwitchBot への問い合わせはしない)
 *   POST { op: "hook" }       … SwitchBot に知らせの URL を登録 (アカウントごと・1 回だけでよい)
 *   POST { op: "hookStatus" } … 登録されているか確かめる
 */
const admin = () => { const t = cookies().get(ADMIN_COOKIE)?.value; return !!t && t === process.env.ADMIN_SESSION_TOKEN; };
const COL: Record<Part, string> = { ceil: "switchbot_light_device_id", wa: "switchbot_wafu_device_id", ac: "switchbot_ac_device_id", galaxy: "switchbot_galaxy_device_id", nest: "switchbot_nest_device_id" };

export async function GET() {
  if (!admin()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const now = Date.now();
  const { data: rs } = await supabaseAdmin.from("rooms").select("*").eq("is_active", true);
  const rooms = (rs ?? []) as any[];
  const ids = rooms.map((r) => r.id);
  const [logsQ, resQ, hookQ] = await Promise.all([
    supabaseAdmin.from("device_logs").select("room_id, action, source, success, created_at").in("room_id", ids)
      .gt("created_at", new Date(now - 4 * 86400e3).toISOString()).order("created_at", { ascending: false }).limit(1500),
    supabaseAdmin.from("reservations").select("*").eq("status", "active")
      .gt("check_out", new Date(now - 6 * 3600e3).toISOString()).lt("check_in", new Date(now + 2 * 86400e3).toISOString()),
    supabaseAdmin.from("device_state").select("device_id, power, updated_at").then((x) => x, () => ({ data: null, error: { message: "device_state" } } as any)),
  ]);
  const logs = (logsQ.data ?? []) as any[], resv = ((resQ.data ?? []) as any[]).map((r) => withEffectiveTimes(r) as any), hooks = (hookQ.data ?? []) as any[];
  const out: RoomLive[] = rooms.map((r) => {
    const c = toCabinRoom(r);
    const idsOf: Partial<Record<Part, string | null>> = {}; const has: Part[] = [];
    (Object.keys(COL) as Part[]).forEach((p) => { const v = r[COL[p]] ? String(r[COL[p]]) : null; idsOf[p] = v; if (v) has.push(p); });
    const parts0 = fromLogs(logs.filter((l) => l.room_id === r.id), now);
    const parts = withHooks(parts0, idsOf, hooks);
    for (const p of Object.keys(parts) as Part[]) if (!has.includes(p)) delete parts[p];
    const occ = occupancy(resv.filter((x) => (x.assigned_room_id || x.room_id) === r.id), now);
    return { id: r.id, slug: String(r.slug), name: c.kanji && /[㐀-鿿]/.test(c.kanji) ? c.kanji : String(r.display_name || r.slug), holo: holoRoomOf(c), occ, parts, has, alert: needsAlert(occ, parts) };
  });
  out.sort((a, b) => (a.holo ? ["haru", "natsu", "aki", "fuyu"].indexOf(a.holo) : 9) - (b.holo ? ["haru", "natsu", "aki", "fuyu"].indexOf(b.holo) : 9) || a.slug.localeCompare(b.slug));
  return NextResponse.json({ ok: true, at: now, rooms: out, hooks: { setup: !hookQ.error, n: hooks.length } }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!admin()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { op?: string };
  const url = webhookUrl(req.nextUrl.origin);
  if (!url) return NextResponse.json({ ok: false, error: "NO_SECRET" }, { status: 500 });
  // 部屋ごとに別のアカウントを使っていることもあるので、アカウントごとに
  const { data: rs } = await supabaseAdmin.from("rooms").select("switchbot_token, switchbot_secret").eq("is_active", true);
  const accts = new Map<string, { token: string; secret: string }>();
  for (const r of [{ switchbot_token: null, switchbot_secret: null }, ...((rs ?? []) as any[])]) {
    const token = r.switchbot_token ?? process.env.SWITCHBOT_TOKEN, secret = r.switchbot_secret ?? process.env.SWITCHBOT_SECRET;
    if (token && secret) accts.set(token, { token, secret });
  }
  const res: { ok: boolean; registered: boolean; other: boolean }[] = [];
  for (const cr of accts.values()) {
    const q = await webhookQuery(cr);
    const mine = q.urls.includes(url), other = q.urls.some((u) => u !== url);
    if (b.op === "hook" && !mine && !other) { const ok = await webhookSetup(cr, url); res.push({ ok, registered: ok, other: false }); }
    else res.push({ ok: q.ok, registered: mine, other: !mine && other });
  }
  // 別の URL が登録済みのアカウントは上書きしない (ほかのサービスで使っているかもしれない)
  return NextResponse.json({ ok: res.every((x) => x.ok), accounts: res.length, registered: res.filter((x) => x.registered).length, other: res.filter((x) => x.other).length });
}
