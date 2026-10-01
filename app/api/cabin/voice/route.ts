import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * スマホ (HIROSHI DRIVE / AGENT KAKU) が 1 秒ごとに聞きに来る: 「iPad が話したい声はある？」
 *   ?t=送迎の ID &after=最後に受け取った番号 &ready=1 (今ちゃんと鳴らせる) &ack=鳴らし始めた声の番号
 *   ready=1 のときだけ voice_seen に残す (5 秒に 1 回だけ書く)。iPad はこれを見て「声はスマホから」にする。
 *   ack は voice_ack に残す (migration_cabin_voice_ack.sql)。iPad は返事が来なければ自分で鳴らす。
 * iPad が返事を見に来る: ?t=送迎の ID &peek=1 → { ack } (voice_seen は書かない)
 */
export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const sp = req.nextUrl.searchParams;
  const t = sp.get("t"), after = Number(sp.get("after") || 0);
  if (!isId(t)) return J({ ok: false, error: "BAD" }, 400);

  if (sp.get("peek") === "1") {
    const { data, error } = await supabaseAdmin.from("cabin_trips").select("voice_ack").eq("id", t).maybeSingle();
    if (error) return J({ ok: false, error: /voice_ack/.test(error.message) ? "SETUP_ACK" : error.message });
    return J({ ok: true, ack: Number((data as any)?.voice_ack ?? 0), now: Date.now() });
  }

  // 古いスマホ (ready を送らない) は、今までどおり「いる」扱い
  const ready = sp.get("ready") !== "0";
  const ack = Number(sp.get("ack") || 0);
  const nowIso = new Date().toISOString(), old = new Date(Date.now() - 5000).toISOString();
  const [{ data, error }] = await Promise.all([
    supabaseAdmin.from("cabin_trips").select("voice_q, status").eq("id", t).maybeSingle(),
    ready
      ? supabaseAdmin.from("cabin_trips").update({ voice_seen: nowIso }).eq("id", t).eq("status", "active").or(`voice_seen.is.null,voice_seen.lt.${old}`)
      : Promise.resolve(null),
    // 返事は大きくなるときだけ書く (列が無ければ何もしない)
    ack > 0
      ? supabaseAdmin.from("cabin_trips").update({ voice_ack: ack }).eq("id", t).or(`voice_ack.is.null,voice_ack.lt.${ack}`).then((r) => r, () => null)
      : Promise.resolve(null),
  ]);
  if (error) return J({ ok: false, error: /voice_q/.test(error.message) ? "SETUP" : error.message });
  if (!data || (data as any).status !== "active") return J({ ok: true, active: false, items: [] });
  const now = Date.now();
  const items = (Array.isArray((data as any).voice_q) ? (data as any).voice_q : []).filter((x: any) => x && Number(x.n) > after && now - Number(x.n) < 20000);
  return J({ ok: true, active: true, items, now });
}
