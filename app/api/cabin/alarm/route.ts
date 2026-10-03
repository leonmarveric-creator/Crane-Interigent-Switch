import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getActiveStays } from "@/lib/auth";
import { getWafuAutoOffAtMs, isWakeLightMode } from "@/lib/wakePrewake";
import { logDevice } from "@/lib/deviceControl";
import { bulbSetBrightness, bulbSetColorTemperature, deviceTurnOff, deviceTurnOn, lightTurnOff, lightTurnOn, type SwitchBotCreds } from "@/lib/switchbot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 車内 iPad (⚙) からスタッフが光目覚ましを設定・確認する。認証はスタッフのログイン。
 *   GET                      全部屋の「今の設定」と「動いたかどうか」
 *   POST { roomId, hh, mm, mode }   次に来るその時刻 (日本時間) に 1 回だけ鳴らす。保存後に読み直して返す
 *   POST { roomId, clear:true }     解除
 *   POST { roomId, test:"on"|"off", mode }  今すぐ試す (点ける / 消す)
 * 滞在中の予約があればその予約のアラームとして保存する (ゲストのスマホにも同じ設定が見える)。
 */
const LATE_MS = 8 * 60 * 1000; // 時刻を過ぎてこれだけ経っても点いていなければ「動かず」
type St = "set" | "run" | "ok" | "ng";
const COLS = "id, reservation_id, room_id, fire_at, is_enabled, triggered_at, wake_mode";

function view(a: any, now: number) {
  if (!a) return null;
  const at = Date.parse(a.fire_at);
  const state: St = a.triggered_at ? "ok" : at > now ? "set" : now - at > LATE_MS ? "ng" : "run";
  return { fireAt: a.fire_at as string, mode: a.wake_mode as string, state, firedAt: (a.triggered_at as string | null) ?? null };
}

/** その部屋で今いちばん意味のあるアラーム (これから鳴る分を優先、なければ直近の分) */
async function currentAlarm(room: any, resIds: string[], now: number) {
  const since = new Date(now - 20 * 3600e3).toISOString();
  const rows: any[] = [];
  const a = await supabaseAdmin.from("alarms").select(COLS).eq("room_id", room.id).eq("is_enabled", true).gte("fire_at", since);
  rows.push(...((a.data ?? []) as any[]));
  if (resIds.length) {
    const b = await supabaseAdmin.from("alarms").select(COLS).in("reservation_id", resIds).eq("is_enabled", true).gte("fire_at", since);
    for (const r of (b.data ?? []) as any[]) if (!rows.some((x) => x.id === r.id)) rows.push(r);
  }
  const future = rows.filter((r) => !r.triggered_at && Date.parse(r.fire_at) > now).sort((x, y) => Date.parse(x.fire_at) - Date.parse(y.fire_at));
  if (future[0]) return future[0];
  return rows.sort((x, y) => Date.parse(y.fire_at) - Date.parse(x.fire_at))[0] ?? null;
}

async function stayIds(room: any): Promise<string[]> {
  const s = await getActiveStays(room.slug).catch(() => null);
  return s ? s.reservations.map((r: any) => r.id) : [];
}

export async function GET() {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const now = Date.now();
  const { data } = await supabaseAdmin.from("rooms").select("id, slug, switchbot_wafu_device_id, switchbot_light_device_id").eq("is_active", true);
  const rooms = (data ?? []) as any[];
  // 記録: Cron が実際に照明を動かした結果 (直近 3 日)
  const logs: Record<string, { at: string; action: string; ok: boolean }[]> = {};
  try {
    const { data: lg } = await supabaseAdmin.from("device_logs").select("room_id, action, success, created_at")
      .eq("source", "cron").in("action", ["light_on", "wafu_prewake"]).gte("created_at", new Date(now - 3 * 86400e3).toISOString())
      .order("created_at", { ascending: false }).limit(200);
    for (const l of (lg ?? []) as any[]) (logs[l.room_id] ||= []).push({ at: l.created_at, action: l.action, ok: !!l.success });
  } catch { /* 記録が読めなくても設定は出す */ }
  const out: Record<string, any> = {};
  await Promise.all(rooms.map(async (r) => {
    const ids = await stayIds(r);
    out[r.id] = { alarm: view(await currentAlarm(r, ids, now), now), staying: ids.length > 0, hasLight: !!r.switchbot_light_device_id, hasWafu: !!r.switchbot_wafu_device_id, logs: (logs[r.id] ?? []).slice(0, 8) };
  }));
  return NextResponse.json({ ok: true, now, rooms: out });
}

export async function POST(req: NextRequest) {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { roomId?: string; hh?: number; mm?: number; mode?: unknown; clear?: boolean; test?: string };
  if (!b.roomId) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 400 });
  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", b.roomId).eq("is_active", true).maybeSingle();
  if (!room) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 404 });
  const now = Date.now();

  /* ---- 今すぐ試す ---- */
  if (b.test === "on" || b.test === "off") {
    const wafu = b.mode === "horizon_rise";
    const dev = wafu ? room.switchbot_wafu_device_id : room.switchbot_light_device_id;
    if (!dev) return NextResponse.json({ ok: false, error: wafu ? "NO_WAFU" : "NO_LIGHT" }, { status: 400 });
    const creds: SwitchBotCreds = { token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!, secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET! };
    let ok = false, detail = "";
    try {
      if (b.test === "off") ok = (wafu ? await deviceTurnOff(creds, dev) : await lightTurnOff(creds, dev)).ok;
      else if (wafu) {
        const on = await deviceTurnOn(creds, dev);
        const t = await bulbSetColorTemperature(creds, dev, 2700);
        const br = await bulbSetBrightness(creds, dev, 100);
        ok = on.ok && t.ok && br.ok;
      } else ok = (await lightTurnOn(creds, dev)).ok;
    } catch (e: any) { detail = String(e?.message ?? e).slice(0, 120); }
    await logDevice({ room_id: room.id, action: wafu ? (b.test === "on" ? "wafu_on" : "wafu_off") : (b.test === "on" ? "light_on" : "light_off"), source: "admin", success: ok });
    return NextResponse.json({ ok, error: ok ? undefined : "DEVICE_FAILED", detail });
  }

  const ids = await stayIds(room);
  const wipe = async () => {
    if (ids.length) await supabaseAdmin.from("alarms").delete().in("reservation_id", ids);
    await supabaseAdmin.from("alarms").delete().eq("room_id", room.id).is("reservation_id", null);
  };

  /* ---- 解除 ---- */
  if (b.clear) {
    await wipe();
    const left = await currentAlarm(room, ids, now);
    const still = left && !left.triggered_at && Date.parse(left.fire_at) > now;
    return NextResponse.json({ ok: !still, cleared: !still, error: still ? "CLEAR_FAILED" : undefined });
  }

  /* ---- 設定 ---- */
  const hh = Number(b.hh), mm = Number(b.mm);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return NextResponse.json({ ok: false, error: "BAD_TIME" }, { status: 400 });
  if (!isWakeLightMode(b.mode)) return NextResponse.json({ ok: false, error: "BAD_MODE" }, { status: 400 });
  const mode = b.mode;
  if (mode === "horizon_rise" && !room.switchbot_wafu_device_id) return NextResponse.json({ ok: false, error: "NO_WAFU" }, { status: 400 });
  if (!room.switchbot_light_device_id) return NextResponse.json({ ok: false, error: "NO_LIGHT" }, { status: 400 });
  // 次に来るその時刻 (日本時間)。iPad の時計の設定に左右されないようサーバで計算する
  const JST = 9 * 3600e3;
  const j = new Date(now + JST);
  let fireMs = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), hh, mm) - JST;
  if (fireMs <= now + 60e3) fireMs += 86400e3;
  const fireIso = new Date(fireMs).toISOString();

  await wipe();
  const { error } = await supabaseAdmin.from("alarms").insert({
    reservation_id: ids[0] ?? null, room_id: room.id, fire_at: fireIso, is_enabled: true, wake_mode: mode,
    wafu_auto_off_at: mode === "horizon_rise" ? new Date(getWafuAutoOffAtMs(fireMs)).toISOString() : null,
  });
  if (error) {
    console.error("[cabin alarm] insert failed", error);
    return NextResponse.json({ ok: false, error: "SAVE_FAILED", detail: `${error.code ?? ""} ${error.message ?? ""}`.trim() }, { status: 500 });
  }
  // 読み直して、本当に入ったかを確かめてから返す
  const saved = await currentAlarm(room, ids, Date.now());
  const good = !!saved && saved.fire_at && Date.parse(saved.fire_at) === fireMs && saved.wake_mode === mode;
  if (!good) return NextResponse.json({ ok: false, error: "VERIFY_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true, alarm: view(saved, Date.now()), staying: ids.length > 0 });
}
